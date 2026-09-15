import { Injectable } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { ApiService } from './api.service';
import { SUBSCRIPTION_NAV_MODULES } from '../config/subscription-modules';
import { API_CLOUD_BASE, STORAGE_KEY_ACTIVE_BASE } from '../config/api-server.config';

export interface SubscriptionStatus {
  facilityId?: number | null;
  facilityName?: string;
  facilityAddress?: string;
  active: boolean;
  status: string;
  subscribedModuleKeys?: string;
  periodStart?: string;
  periodEnd?: string;
  message?: string;
}

@Injectable({ providedIn: 'root' })
export class SubscriptionService {
  /** Show warning when subscription ends within this many days. */
  readonly expiryWarningDays = 1;

  private readonly expiryBannerDismissStorageKey = 'subscription_expiry_banner_dismissed_period';

  private loaded = false;
  private status: SubscriptionStatus = { active: false, status: 'none' };
  private moduleKeys = new Set<string>();

  constructor(private api: ApiService) {}

  /**
   * Localhost / LAN clinic servers are licensed on-prem — do not gate the UI
   * on cloud subscription status (which is often missing or inactive locally).
   */
  isOnPremClinicApi(): boolean {
    if (typeof localStorage === 'undefined') {
      return false;
    }
    const raw = (localStorage.getItem(STORAGE_KEY_ACTIVE_BASE) || '').trim().toLowerCase();
    if (!raw) {
      return false;
    }
    if (raw.replace(/\/+$/, '') === API_CLOUD_BASE.toLowerCase().replace(/\/+$/, '')) {
      return false;
    }
    if (raw.includes('onrender.com') || raw.includes('venerandahospital.org')) {
      return false;
    }
    try {
      const host = new URL(raw).hostname.toLowerCase();
      if (host === 'localhost' || host === '127.0.0.1') {
        return true;
      }
      if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
        const [a, b] = host.split('.').map(Number);
        if (a === 10) return true;
        if (a === 192 && b === 168) return true;
        if (a === 172 && b >= 16 && b <= 31) return true;
      }
    } catch {
      /* fall through */
    }
    return false;
  }

  refreshFromSession(): void {
    this.loaded = true;
    if (this.isOnPremClinicApi()) {
      this.status = {
        active: true,
        status: 'on-prem',
        subscribedModuleKeys: 'all',
        facilityName: sessionStorage.getItem('facilityName') || '',
        facilityAddress: sessionStorage.getItem('facilityAddress') || '',
        message: 'Local clinic server — full modules enabled',
      };
      this.moduleKeys = new Set(['all']);
      return;
    }
    const active = sessionStorage.getItem('subscriptionActive') === 'true';
    const status = sessionStorage.getItem('subscriptionStatus') || 'none';
    const modules = sessionStorage.getItem('subscribedModuleKeys') || '';
    this.status = {
      active,
      status,
      facilityId: this.readNumber(sessionStorage.getItem('facilityId')),
      facilityName: sessionStorage.getItem('facilityName') || '',
      facilityAddress: sessionStorage.getItem('facilityAddress') || '',
      subscribedModuleKeys: modules,
      periodEnd: sessionStorage.getItem('subscriptionPeriodEnd') || undefined,
      message: sessionStorage.getItem('subscriptionMessage') || '',
    };
    this.applyModuleKeys(modules);
  }

  loadStatus(): Observable<any> {
    return this.api.getSubscriptionStatus().pipe(
      tap((res: any) => this.applyStatusResponse(res))
    );
  }

  activate(token: string): Observable<any> {
    return this.api.activateSubscription(token).pipe(
      tap((res: any) => this.applyStatusResponse(res?.data))
    );
  }

  cancel(): Observable<any> {
    return this.api.cancelSubscription().pipe(
      tap((res: any) => this.applyStatusResponse(res?.data))
    );
  }

  applyStatusResponse(data: any): void {
    if (!data) {
      return;
    }
    const active = !!data.active;
    this.status = {
      facilityId: data.facilityId,
      facilityName: data.facilityName,
      facilityAddress: data.facilityAddress,
      active,
      status: data.status || 'none',
      subscribedModuleKeys: data.subscribedModuleKeys || '',
      periodStart: data.periodStart,
      periodEnd: data.periodEnd,
      message: data.message || '',
    };
    this.loaded = true;
    sessionStorage.setItem('subscriptionActive', String(active));
    sessionStorage.setItem('subscriptionStatus', this.status.status);
    sessionStorage.setItem('subscribedModuleKeys', this.status.subscribedModuleKeys || '');
    sessionStorage.setItem('facilityId', data.facilityId != null ? String(data.facilityId) : '');
    sessionStorage.setItem('facilityName', this.status.facilityName || '');
    sessionStorage.setItem('facilityAddress', this.status.facilityAddress || '');
    sessionStorage.setItem('subscriptionPeriodEnd', this.status.periodEnd || '');
    sessionStorage.setItem('subscriptionMessage', this.status.message || '');
    this.applyModuleKeys(this.status.subscribedModuleKeys || '');
  }

  clearSessionCache(): void {
    this.loaded = false;
    this.status = { active: false, status: 'none' };
    this.moduleKeys = new Set();
    [
      'subscriptionActive',
      'subscriptionStatus',
      'subscribedModuleKeys',
      'facilityId',
      'facilityName',
      'facilityAddress',
      'subscriptionPeriodEnd',
      'subscriptionMessage',
    ].forEach(k => sessionStorage.removeItem(k));
  }

  getStatus(): SubscriptionStatus {
    this.ensureLoaded();
    return { ...this.status };
  }

  isActive(): boolean {
    this.ensureLoaded();
    if (this.isOnPremClinicApi()) {
      return true;
    }
    return this.status.active;
  }

  canManageSubscription(): boolean {
    const role = (sessionStorage.getItem('userrole') || '').toLowerCase().trim();
    return role === 'md' || role === 'admin';
  }

  hasModule(moduleKey: string): boolean {
    this.ensureLoaded();
    if (this.isOnPremClinicApi()) {
      return true;
    }
    if (!this.isActive()) {
      return false;
    }
    if (this.moduleKeys.has('all')) {
      return true;
    }
    return this.moduleKeys.has(moduleKey);
  }

  canAccessNavGroup(navGroupKey: string): boolean {
    const role = (sessionStorage.getItem('userrole') || '').toLowerCase().trim();
    if (role === 'admin' || role === 'md') {
      return true;
    }
    if (this.isOnPremClinicApi()) {
      return true;
    }
    if (!this.isActive()) {
      return navGroupKey === 'administration';
    }
    const moduleKey = SUBSCRIPTION_NAV_MODULES[navGroupKey] || navGroupKey;
    if (navGroupKey === 'administration') {
      return true;
    }
    return this.hasModule(moduleKey);
  }

  getModuleLabels(): string[] {
    this.ensureLoaded();
    if (this.moduleKeys.has('all')) {
      return ['All modules'];
    }
    return Array.from(this.moduleKeys);
  }

  /** Hide the overview expiry banner until the subscription period end changes. */
  dismissExpiryBanner(): void {
    this.ensureLoaded();
    localStorage.setItem(
      this.expiryBannerDismissStorageKey,
      this.status.periodEnd || '_none_'
    );
  }

  clearExpiryBannerDismissal(): void {
    localStorage.removeItem(this.expiryBannerDismissStorageKey);
  }

  isExpiryBannerDismissed(): boolean {
    this.ensureLoaded();
    const dismissed = localStorage.getItem(this.expiryBannerDismissStorageKey);
    if (!dismissed) {
      return false;
    }
    return dismissed === (this.status.periodEnd || '_none_');
  }

  getExpiryWarningInfo(): {
    showWarning: boolean;
    message: string;
    remainingLabel: string;
    periodEnd?: string;
    urgent: boolean;
  } | null {
    this.ensureLoaded();
    if (this.isExpiryBannerDismissed()) {
      return null;
    }
    if (!this.status.periodEnd) {
      return null;
    }

    const end = this.parsePeriodEnd(this.status.periodEnd);
    if (!end) {
      return null;
    }

    const msRemaining = end.getTime() - Date.now();
    if (msRemaining <= 0) {
      return {
        showWarning: true,
        message: 'Your subscription has expired',
        remainingLabel: 'Expired',
        periodEnd: this.status.periodEnd,
        urgent: true,
      };
    }

    const daysRemaining = msRemaining / (1000 * 60 * 60 * 24);
    if (daysRemaining > this.expiryWarningDays) {
      return null;
    }

    return {
      showWarning: true,
      message: 'Your subscription is expiring soon',
      remainingLabel: this.formatTimeRemaining(msRemaining),
      periodEnd: this.status.periodEnd,
      urgent: true,
    };
  }

  formatPeriodEndDate(periodEnd?: string): string {
    const end = this.parsePeriodEnd(periodEnd || this.status.periodEnd);
    if (!end) {
      return 'N/A';
    }
    return end.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  formatTimeRemaining(msRemaining: number): string {
    if (msRemaining <= 0) {
      return 'Expired';
    }

    const totalMinutes = Math.floor(msRemaining / (1000 * 60));
    const days = Math.floor(totalMinutes / (60 * 24));
    const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
    const minutes = totalMinutes % 60;

    if (days >= 1) {
      return hours > 0 ? `${days} day(s), ${hours} hour(s)` : `${days} day(s)`;
    }
    if (hours >= 1) {
      return minutes > 0 ? `${hours} hour(s), ${minutes} minute(s)` : `${hours} hour(s)`;
    }
    return `${Math.max(minutes, 1)} minute(s)`;
  }

  private parsePeriodEnd(value?: string): Date | null {
    if (!value) {
      return null;
    }
    const normalized = value.includes('T') ? value : value.replace(' ', 'T');
    const parsed = new Date(normalized);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private applyModuleKeys(csv: string): void {
    const raw = (csv || '').trim();
    if (!raw || raw.toLowerCase() === 'all') {
      this.moduleKeys = new Set(['all']);
      return;
    }
    this.moduleKeys = new Set(
      raw.split(',').map(s => s.trim()).filter(Boolean)
    );
  }

  private ensureLoaded(): void {
    if (!this.loaded) {
      this.refreshFromSession();
    }
  }

  private readNumber(value: string | null): number | null {
    if (!value) {
      return null;
    }
    const n = Number(value);
    return Number.isNaN(n) ? null : n;
  }
}
