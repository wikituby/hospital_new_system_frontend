import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom, timeout, catchError, of } from 'rxjs';
import {
  API_CONTEXT_PATH,
  API_DEFAULT_PORT,
  API_HEALTH_PATH,
  HEALTH_CHECK_TIMEOUT_MS,
  getDevProxyBase,
  isAngularDevServer,
} from '../config/api-server.config';
import { ApiConfigService } from './api-config.service';

export interface DiscoveredClinicServer {
  ip: string;
  baseUrl: string;
  healthUrl: string;
  fromSaved?: boolean;
}

export interface LanScanResult {
  servers: DiscoveredClinicServer[];
  subnets: string[];
  deviceIp?: string;
  knownServersChecked?: number;
}

export type LanScanProgressHandler = (progress: {
  phase: 'known' | 'network';
  checked: number;
  total: number;
  healthyCount: number;
  /** Server / IP currently being health-checked. */
  currentTarget?: string;
}) => void;

const SKIP_CONNECTION_HEADER = 'X-Skip-Connection-Modal';
const DISCOVERY_TIMEOUT_MS = 1800;
const DISCOVERY_BATCH_SIZE = 10;

@Injectable({
  providedIn: 'root',
})
export class ServerDiscoveryService {
  constructor(
    private http: HttpClient,
    private apiConfig: ApiConfigService
  ) {}

  /**
   * Phase 1: health-check saved/known server URLs.
   * Phase 2: sweep Wi-Fi /24 and test every remaining IP.
   * All healthy hosts are listed for the user to pick.
   */
  async discoverServersOnLan(
    onProgress?: LanScanProgressHandler,
    onServerFound?: (server: DiscoveredClinicServer) => void,
    shouldCancel?: () => boolean
  ): Promise<LanScanResult> {
    const isCancelled = () => shouldCancel?.() === true;
    const discovered: DiscoveredClinicServer[] = [];
    const seenIps = new Set<string>();

    const addHealthy = (baseUrl: string, fromSaved: boolean) => {
      const ip = this.extractIpFromBase(baseUrl) ?? baseUrl;
      if (seenIps.has(ip)) return;
      seenIps.add(ip);
      const normalized = this.apiConfig.normalizeBaseUrl(baseUrl);
      const server: DiscoveredClinicServer = {
        ip,
        baseUrl: normalized,
        healthUrl: `${normalized}${API_HEALTH_PATH}`,
        fromSaved,
      };
      discovered.push(server);
      onServerFound?.(server);
    };

    const knownBases = this.buildKnownServerBases();
    const knownIps = knownBases
      .map((base) => this.extractIpFromBase(base))
      .filter((ip): ip is string => !!ip);
    let knownChecked = 0;
    for (const base of knownBases) {
      if (isCancelled()) {
        return {
          servers: discovered,
          subnets: [],
          deviceIp: undefined,
          knownServersChecked: knownBases.length,
        };
      }
      knownChecked++;
      onProgress?.({
        phase: 'known',
        checked: knownChecked,
        total: knownBases.length,
        healthyCount: discovered.length,
        currentTarget: this.apiConfig.normalizeBaseUrl(base),
      });
      if (await this.checkHealthForBase(base, HEALTH_CHECK_TIMEOUT_MS)) {
        addHealthy(base, true);
      }
      onProgress?.({
        phase: 'known',
        checked: knownChecked,
        total: knownBases.length,
        healthyCount: discovered.length,
        currentTarget: this.apiConfig.normalizeBaseUrl(base),
      });
    }

    const plan = await this.buildLanNetworkScanPlan(seenIps, knownIps);
    let networkChecked = 0;

    for (let i = 0; i < plan.candidates.length; i += DISCOVERY_BATCH_SIZE) {
      if (isCancelled()) {
        break;
      }
      const batch = plan.candidates.slice(i, i + DISCOVERY_BATCH_SIZE);
      onProgress?.({
        phase: 'network',
        checked: networkChecked,
        total: plan.candidates.length,
        healthyCount: discovered.length,
        currentTarget: batch.length === 1 ? this.baseUrlForIp(batch[0]) : `batch ${batch[0]} … ${batch[batch.length - 1]}`,
      });
      const results = await Promise.all(
        batch.map(async (ip) =>
          (await this.checkHealthForIp(ip, DISCOVERY_TIMEOUT_MS)) ? ip : null
        )
      );

      networkChecked += batch.length;

      for (const ip of results) {
        if (!ip || seenIps.has(ip)) continue;
        seenIps.add(ip);
        const baseUrl = this.baseUrlForIp(ip);
        const server: DiscoveredClinicServer = {
          ip,
          baseUrl,
          healthUrl: `${baseUrl}${API_HEALTH_PATH}`,
          fromSaved: false,
        };
        discovered.push(server);
        onServerFound?.(server);
      }

      onProgress?.({
        phase: 'network',
        checked: networkChecked,
        total: plan.candidates.length,
        healthyCount: discovered.length,
        currentTarget: batch.length === 1 ? this.baseUrlForIp(batch[0]) : `batch ${batch[0]} … ${batch[batch.length - 1]}`,
      });
    }

    return {
      servers: discovered,
      subnets: plan.subnets,
      deviceIp: plan.deviceIp,
      knownServersChecked: knownBases.length,
    };
  }

  async checkHealthForIp(
    ip: string,
    timeoutMs = HEALTH_CHECK_TIMEOUT_MS
  ): Promise<boolean> {
    return this.checkHealthForBase(this.baseUrlForIp(ip), timeoutMs);
  }

  private async checkHealthForBase(
    baseUrl: string,
    timeoutMs: number
  ): Promise<boolean> {
    const url = `${this.apiConfig.normalizeBaseUrl(baseUrl)}${API_HEALTH_PATH}`;
    try {
      const body = await firstValueFrom(
        this.http
          .get(url, {
            responseType: 'text',
            headers: new HttpHeaders({ [SKIP_CONNECTION_HEADER]: '1' }),
          })
          .pipe(timeout(timeoutMs), catchError(() => of(null)))
      );
      return body != null && String(body).trim().toUpperCase() === 'OK';
    } catch {
      return false;
    }
  }

  private buildKnownServerBases(): string[] {
    const seen = new Set<string>();
    const bases: string[] = [];

    const add = (value?: string | null) => {
      if (!value?.trim()) return;
      const normalized = this.apiConfig.normalizeBaseUrl(value.trim());
      if (seen.has(normalized)) return;
      seen.add(normalized);
      bases.push(normalized);
    };

    for (const saved of this.apiConfig.getSavedServers()) {
      add(saved);
    }

    add(localStorage.getItem('apiActiveBaseUrl'));

    if (isAngularDevServer()) {
      add(getDevProxyBase());
    }

    add('http://127.0.0.1:8080/health_care');

    return bases;
  }

  private baseUrlForIp(ip: string): string {
    return `http://${ip}:${API_DEFAULT_PORT}${API_CONTEXT_PATH}`;
  }

  private async buildLanNetworkScanPlan(
    excludeIps: Set<string>,
    knownIps: string[]
  ): Promise<{
    candidates: string[];
    subnets: string[];
    deviceIp?: string;
  }> {
    const candidates: string[] = [];
    const seen = new Set<string>(excludeIps);
    const prefixes: string[] = [];
    let deviceIp: string | undefined;

    const addIp = (ip?: string | null) => {
      if (!ip || !this.isValidIpv4(ip) || seen.has(ip)) return;
      seen.add(ip);
      candidates.push(ip);
    };

    const prefixForIp = (ip: string): string | null => {
      const parts = ip.split('.');
      if (parts.length !== 4) return null;
      return `${parts[0]}.${parts[1]}.${parts[2]}`;
    };

    const addPrefix = (prefix?: string | null) => {
      if (!prefix || prefixes.includes(prefix)) return;
      prefixes.push(prefix);
    };

    const localIps = await this.detectLocalIpv4Addresses();
    const primaryIp = this.pickPrimaryLocalIp(localIps);
    if (primaryIp) {
      deviceIp = primaryIp;
      addPrefix(prefixForIp(primaryIp));
    }

    for (const ip of knownIps) {
      addPrefix(prefixForIp(ip));
    }

    if (prefixes.length === 0) {
      addPrefix('192.168.1');
    }

    // Only the active Wi-Fi /24, plus at most one extra /24 from a saved server.
    const scanPrefixes = prefixes.length <= 2 ? prefixes : prefixes.slice(0, 2);
    const subnets = scanPrefixes.map((prefix) => `${prefix}.0/24`);

    for (const prefix of scanPrefixes) {
      for (let host = 1; host <= 254; host++) {
        addIp(`${prefix}.${host}`);
      }
    }

    return { candidates, subnets, deviceIp };
  }

  private pickPrimaryLocalIp(ips: string[]): string | undefined {
    if (ips.length === 0) return undefined;
    const score = (ip: string) => {
      if (ip.startsWith('192.168.')) return 30;
      if (ip.startsWith('10.')) return 10;
      return 0;
    };
    return [...ips].sort((a, b) => score(b) - score(a))[0];
  }

  private extractIpFromBase(baseUrl: string): string | null {
    try {
      const normalized = this.apiConfig.normalizeBaseUrl(baseUrl);
      const host = new URL(normalized).hostname;
      return this.isValidIpv4(host) ? host : null;
    } catch {
      return null;
    }
  }

  private async detectLocalIpv4Addresses(): Promise<string[]> {
    if (typeof window === 'undefined' || !window.RTCPeerConnection) {
      return [];
    }

    return new Promise((resolve) => {
      const ips = new Set<string>();
      const pc = new RTCPeerConnection({ iceServers: [] });
      const finish = () => {
        try {
          pc.close();
        } catch {
          /* ignore */
        }
        resolve([...ips]);
      };

      pc.onicecandidate = (event) => {
        if (!event.candidate) {
          finish();
          return;
        }
        const match = /([0-9]{1,3}(?:\.[0-9]{1,3}){3})/.exec(event.candidate.candidate);
        const ip = match?.[1];
        if (ip && this.isPrivateIpv4(ip)) {
          ips.add(ip);
        }
      };

      pc.createDataChannel('lan-scan');
      pc.createOffer()
        .then((offer) => pc.setLocalDescription(offer))
        .catch(() => finish());

      window.setTimeout(finish, 1500);
    });
  }

  private isValidIpv4(ip: string): boolean {
    const parts = ip.trim().split('.');
    if (parts.length !== 4) return false;
    return parts.every((part) => {
      if (!part || part.length > 3) return false;
      const value = Number(part);
      return Number.isInteger(value) && value >= 0 && value <= 255;
    });
  }

  private isPrivateIpv4(ip: string): boolean {
    if (!this.isValidIpv4(ip)) return false;
    const [a, b] = ip.split('.').map(Number);
    return (
      a === 10 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    );
  }
}
