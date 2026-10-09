import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ApiConfigService } from '../services/api-config.service';
import {
  DiscoveredClinicServer,
  LanScanResult,
  ServerDiscoveryService,
} from '../services/server-discovery.service';
import {
  API_CLOUD_BASE,
  API_LOCALHOST_BASE,
  API_DEFAULT_PORT,
  API_CONTEXT_PATH,
  API_HEALTH_PATH,
  CLOUD_HEALTH_CHECK_TIMEOUT_MS,
  getDevProxyBase,
  isAngularDevServer,
} from '../config/api-server.config';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-server-connection',
  templateUrl: './server-connection.component.html',
  styleUrls: ['./server-connection.component.css'],
})
export class ServerConnectionComponent implements OnInit, OnDestroy {
  @ViewChild('customServerInput') customServerInput?: ElementRef<HTMLInputElement>;

  customServer = '';
  savedServers: string[] = [];
  discoveredServers: DiscoveredClinicServer[] = [];
  scanSubnets: string[] = [];
  deviceIp?: string;
  checking = false;
  scanning = false;
  autoChecking = false;
  showCustomIp = false;
  errorMessage = '';
  scanMessage = '';
  /** Server currently being health-checked (connect or scan). */
  testingServer = '';
  readonly localhostLabel = API_LOCALHOST_BASE;
  readonly cloudLabel = API_CLOUD_BASE;
  readonly cloudHostLabel = 'backend-mc2d.onrender.com';
  connectingCloud = false;
  readonly healthCheckHint = `http://[IP]:${API_DEFAULT_PORT}${API_CONTEXT_PATH}/health`;
  readonly isDevServer = isAngularDevServer();
  private autoCheckingSub?: Subscription;
  private scanCancelRequested = false;

  constructor(
    private apiConfig: ApiConfigService,
    private serverDiscovery: ServerDiscoveryService
  ) {}

  ngOnInit(): void {
    this.savedServers = this.apiConfig.getSavedServers();
    this.customServer = localStorage.getItem('apiLastManualServer') || '';
    this.autoCheckingSub = this.apiConfig.recoveryChecking$.subscribe((checking) => {
      this.autoChecking = checking;
      if (!checking) {
        if (!this.checking && !this.scanning) {
          this.testingServer = '';
        }
      }
    });
    if (this.apiConfig.requiresPreLoginServerSelection()) {
      this.scanMessage = 'Choose a server to connect before signing in.';
      return;
    }
    void this.scanForServers();
  }

  ngOnDestroy(): void {
    this.stopScan();
    this.autoCheckingSub?.unsubscribe();
  }

  cancelDialog(): void {
    this.stopScan();
    this.checking = false;
    this.connectingCloud = false;
    this.testingServer = '';
    this.apiConfig.dismissServerConnectionDialog();
  }

  async trySaved(url: string): Promise<void> {
    this.stopScan();
    await this.attemptConnect(url);
  }

  async tryDiscovered(server: DiscoveredClinicServer): Promise<void> {
    this.stopScan();
    await this.attemptConnect(server.baseUrl);
  }

  async tryCustom(): Promise<void> {
    this.stopScan();
    if (!this.customServer.trim()) {
      this.errorMessage = 'Enter a server address (IP or full URL).';
      return;
    }
    localStorage.setItem('apiLastManualServer', this.customServer.trim());
    await this.attemptConnect(this.customServer);
  }

  openCustomIpEntry(): void {
    this.stopScan();
    this.showCustomIp = true;
    this.errorMessage = '';
    setTimeout(() => this.customServerInput?.nativeElement?.focus(), 0);
  }

  stopScan(): void {
    if (!this.scanning) {
      return;
    }
    this.scanCancelRequested = true;
    this.scanning = false;
    this.testingServer = '';
    this.scanMessage = 'Scan stopped. Enter a custom IP or https URL below, or use localhost.';
  }

  async scanForServers(): Promise<void> {
    if (this.scanning) {
      return;
    }

    this.scanCancelRequested = false;
    this.scanning = true;
    this.testingServer = '';
    this.scanMessage = 'Checking saved servers…';
    this.discoveredServers = [];
    this.scanSubnets = [];
    this.deviceIp = undefined;

    try {
      const result = await this.serverDiscovery.discoverServersOnLan(
        ({ phase, checked, total, healthyCount, currentTarget }) => {
          if (this.scanCancelRequested) {
            return;
          }
          this.testingServer = currentTarget || '';
          if (phase === 'known') {
            this.scanMessage = currentTarget
              ? `Checking saved servers… ${checked} of ${total}`
              : `Checking saved servers… ${checked} of ${total}`;
          } else {
            this.scanMessage =
              healthyCount > 0
                ? `Discovering Wi-Fi devices… ${checked} of ${total} · ${healthyCount} healthy server${healthyCount === 1 ? '' : 's'} found`
                : `Discovering Wi-Fi devices… ${checked} of ${total}`;
          }
        },
        (server) => {
          if (this.scanCancelRequested) {
            return;
          }
          if (this.discoveredServers.some((item) => item.ip === server.ip)) {
            return;
          }
          this.discoveredServers = [...this.discoveredServers, server];
        },
        () => this.scanCancelRequested
      );

      if (this.scanCancelRequested) {
        return;
      }

      this.scanSubnets = result.subnets;
      this.deviceIp = result.deviceIp;
      this.scanMessage = result.servers.length
        ? `Found ${result.servers.length} clinic server${result.servers.length === 1 ? '' : 's'}. Choose one to connect.`
        : this.emptyScanMessage(result);
    } catch {
      if (!this.scanCancelRequested) {
        this.scanMessage =
          'Network scan failed. Enter the server IP manually or use localhost if the API runs on this PC.';
      }
    } finally {
      this.scanning = false;
      if (!this.checking) {
        this.testingServer = '';
      }
    }
  }

  async useLocalhostAnyway(): Promise<void> {
    this.stopScan();
    const target = isAngularDevServer() ? getDevProxyBase() : API_LOCALHOST_BASE;
    await this.attemptConnect(target);
  }

  async useCloudServer(): Promise<void> {
    this.stopScan();
    this.connectingCloud = true;
    await this.attemptConnect(API_CLOUD_BASE, {
      timeoutMs: CLOUD_HEALTH_CHECK_TIMEOUT_MS,
      wakeHint: true,
    });
    this.connectingCloud = false;
  }

  private emptyScanMessage(result: LanScanResult): string {
    const subnetText = result.subnets.length
      ? result.subnets.join(', ')
      : 'your Wi-Fi subnet';
    const deviceText = result.deviceIp ? ` This device is on ${result.deviceIp}.` : '';
    return (
      `No clinic servers found on ${subnetText}.${deviceText} ` +
      'Enter the server IP manually, use localhost if the API runs on this PC, ' +
      `and allow inbound TCP ${API_DEFAULT_PORT} in Windows Firewall.`
    );
  }

  displayServerUrl(baseUrl: string): string {
    return this.apiConfig.toDisplayBaseUrl(this.apiConfig.normalizeBaseUrl(baseUrl));
  }

  private async attemptConnect(
    input: string,
    options?: { timeoutMs?: number; wakeHint?: boolean }
  ): Promise<void> {
    const normalized = this.apiConfig.normalizeBaseUrl(input);
    const displayUrl = this.apiConfig.toDisplayBaseUrl(normalized);
    this.checking = true;
    this.errorMessage = '';
    this.testingServer = `${displayUrl}${API_HEALTH_PATH}`;
    const ok = await this.apiConfig.connectTo(input, { timeoutMs: options?.timeoutMs });
    this.checking = false;
    this.testingServer = '';
    if (!ok) {
      this.errorMessage = options?.wakeHint
        ? 'Could not reach the cloud server. It may still be waking up — wait a moment and try Connect again.'
        : `Server health check failed for ${displayUrl}${API_HEALTH_PATH}. It must return OK before you can continue to login.`;
      this.savedServers = this.apiConfig.getSavedServers();
      return;
    }
    // connectTo also pulls facility name/logo from the server before marking ready.
    this.scanMessage = 'Connected. Loading facility branding for login…';
  }
}
