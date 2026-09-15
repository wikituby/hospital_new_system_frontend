import { Injectable } from '@angular/core';
import { BehaviorSubject, firstValueFrom, Observable, tap } from 'rxjs';
import { ApiService } from './api.service';
import { FacilityBranding } from '../models/facility-branding.model';

const STORAGE_KEY = 'facilityBranding';
const LOCAL_BRANDING_KEY = 'facilityBrandingLocal';
const LOCAL_NAME_KEY = 'facilityName';
const LOCAL_LOGO_URL_KEY = 'facilityLogoUrl';
/** Cached logo bytes (data URL) for instant login paint without network. */
const LOCAL_LOGO_DATA_KEY = 'facilityLogoLocalDataUrl';
/** Max data-URL length (~1MB binary) kept in localStorage. */
const LOCAL_LOGO_DATA_MAX_CHARS = 1_400_000;
/** Backend placeholder when no facility name is configured yet. */
const BACKEND_PLACEHOLDER_NAME = 'Health Facility';

export const DEFAULT_FACILITY_NAME = 'Veneranda Hospital';
export const DEFAULT_FACILITY_LOGO = 'assets/images/logo.jpg';

@Injectable({ providedIn: 'root' })
export class FacilityBrandingService {
  private cached: FacilityBranding | null = null;
  private readonly sidebarStackedSubject = new BehaviorSubject<boolean>(true);
  readonly sidebarStacked$ = this.sidebarStackedSubject.asObservable();

  private readonly loginNameSubject = new BehaviorSubject<string>(DEFAULT_FACILITY_NAME);
  private readonly loginLogoSubject = new BehaviorSubject<string>(DEFAULT_FACILITY_LOGO);
  /** Reactive brand for login screens (local cache / defaults / server). */
  readonly loginFacilityName$ = this.loginNameSubject.asObservable();
  readonly loginFacilityLogo$ = this.loginLogoSubject.asObservable();

  private brandingLoadInFlight: Promise<void> | null = null;

  constructor(private api: ApiService) {
    // Start with defaults (or any older local cache) until a server is chosen.
    this.hydrateFromLocalAssets();
  }

  load(): Observable<FacilityBranding> {
    return this.api.getBusinessSettings().pipe(
      tap((data) => this.applyCache(data))
    );
  }

  save(payload: FacilityBranding): Observable<FacilityBranding> {
    return this.api.updateBusinessSettings(payload).pipe(
      tap((data) => this.applyCache(data))
    );
  }

  /**
   * After the client connects to a clinic server, pull public name/logo for login.
   * Falls back to Veneranda defaults when the facility has not registered branding yet.
   */
  async loadPublicFromConnectedServer(): Promise<void> {
    if (this.brandingLoadInFlight) {
      return this.brandingLoadInFlight;
    }
    this.brandingLoadInFlight = (async () => {
      try {
        const data = (await Promise.race([
          firstValueFrom(this.api.getPublicBusinessSettings()),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000)),
        ])) as FacilityBranding | null;
        if (data) {
          this.applyPublicServerBranding(data);
        } else {
          this.hydrateFromLocalAssets();
        }
      } catch {
        // Keep prior local cache / defaults so login still works.
        this.hydrateFromLocalAssets();
      } finally {
        this.brandingLoadInFlight = null;
      }
    })();
    return this.brandingLoadInFlight;
  }

  /**
   * Instant branding for login: localStorage (and session) first, then defaults.
   * Safe to call before authentication.
   */
  hydrateFromLocalAssets(): { facilityName: string; facilityLogoUrl: string } {
    const fromStorage = this.readLocalBranding();
    if (fromStorage) {
      this.cached = { ...this.cached, ...fromStorage };
    }
    const name = this.getFacilityName();
    const logo = this.getLoginLogoUrl();
    this.loginNameSubject.next(name);
    this.loginLogoSubject.next(logo);
    return { facilityName: name, facilityLogoUrl: logo };
  }

  /**
   * Apply public `/business-settings/public` payload for pre-login UI.
   * Placeholder backend name ("Health Facility") with no logo → Veneranda defaults.
   */
  private applyPublicServerBranding(data: FacilityBranding | null | undefined): void {
    if (!data) {
      this.applyLoginDefaults();
      return;
    }

    const rawName = (data.facilityName || '').trim();
    const logo = (data.facilityLogoUrl || '').trim();
    const nameIsPlaceholder = !rawName || rawName === BACKEND_PLACEHOLDER_NAME;
    const establishedName = nameIsPlaceholder ? '' : rawName;

    if (!establishedName && !logo) {
      this.applyLoginDefaults();
      return;
    }

    this.applyCache({
      ...data,
      facilityName: establishedName || undefined,
      facilityLogoUrl: logo || undefined,
    });
    this.loginNameSubject.next(this.getFacilityName());
    this.loginLogoSubject.next(this.getLoginLogoUrl());
  }

  private applyLoginDefaults(): void {
    this.cached = {
      ...(this.cached || {}),
      facilityName: '',
      facilityLogoUrl: '',
    };
    this.clearEstablishedBrandLocalKeys();
    this.loginNameSubject.next(DEFAULT_FACILITY_NAME);
    this.loginLogoSubject.next(DEFAULT_FACILITY_LOGO);
  }

  private clearEstablishedBrandLocalKeys(): void {
    try {
      sessionStorage.removeItem(LOCAL_NAME_KEY);
      sessionStorage.removeItem(LOCAL_LOGO_URL_KEY);
      localStorage.removeItem(LOCAL_NAME_KEY);
      localStorage.removeItem(LOCAL_LOGO_URL_KEY);
      localStorage.removeItem(LOCAL_LOGO_DATA_KEY);
    } catch {
      /* ignore */
    }
  }

  getCached(): FacilityBranding | null {
    if (this.cached) {
      return { ...this.cached };
    }
    try {
      const sessionRaw = sessionStorage.getItem(STORAGE_KEY);
      if (sessionRaw) {
        this.cached = JSON.parse(sessionRaw) as FacilityBranding;
        return { ...this.cached };
      }
    } catch {
      /* ignore */
    }
    const local = this.readLocalBranding();
    if (local) {
      this.cached = { ...local };
      return { ...this.cached };
    }
    return null;
  }

  private readonly defaultLogoPath = DEFAULT_FACILITY_LOGO;
  private logoDataUrlCache: string | null | undefined;
  private logoLoadPromise: Promise<string | null> | null = null;

  getFacilityLogoUrl(): string {
    const url = this.getCached()?.facilityLogoUrl?.trim();
    return url || '';
  }

  /** URL for on-screen display (configured logo, local data URL, or default asset). */
  getLogoUrlForDisplay(): string {
    const configured = this.getFacilityLogoUrl();
    if (configured) {
      return configured;
    }
    try {
      const localData = localStorage.getItem(LOCAL_LOGO_DATA_KEY);
      if (localData && localData.startsWith('data:image')) {
        return localData;
      }
    } catch {
      /* ignore */
    }
    try {
      const storedUrl =
        sessionStorage.getItem(LOCAL_LOGO_URL_KEY) ||
        localStorage.getItem(LOCAL_LOGO_URL_KEY);
      if (storedUrl?.trim()) {
        return storedUrl.trim();
      }
    } catch {
      /* ignore */
    }
    return this.defaultLogoPath;
  }

  /**
   * Prefer locally cached logo data URL on login for fast paint;
   * falls back to remote URL then default asset.
   */
  getLoginLogoUrl(): string {
    try {
      const localData = localStorage.getItem(LOCAL_LOGO_DATA_KEY);
      if (localData && localData.startsWith('data:image')) {
        return localData;
      }
    } catch {
      /* ignore */
    }
    return this.getLogoUrlForDisplay();
  }

  getLoginFacilityName(): string {
    return this.getFacilityName();
  }

  /** Loads facility logo as a data URL for jsPDF (cached). */
  loadLogoDataUrl(): Promise<string | null> {
    if (this.logoLoadPromise) {
      return this.logoLoadPromise;
    }
    this.logoLoadPromise = (async () => {
      if (this.logoDataUrlCache !== undefined) {
        return this.logoDataUrlCache;
      }
      try {
        const localData = localStorage.getItem(LOCAL_LOGO_DATA_KEY);
        if (localData?.startsWith('data:image')) {
          this.logoDataUrlCache = localData;
          return localData;
        }
      } catch {
        /* ignore */
      }
      try {
        const path = this.getLogoUrlForDisplay();
        const response = await fetch(path);
        if (!response.ok) {
          this.logoDataUrlCache = null;
          return null;
        }
        const blob = await response.blob();
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(blob);
        });
        this.logoDataUrlCache = dataUrl;
        return dataUrl;
      } catch {
        this.logoDataUrlCache = null;
        return null;
      }
    })();
    return this.logoLoadPromise;
  }

  /** Draw loaded logo on a jsPDF page; call after {@link loadLogoDataUrl}. */
  addLogoToJsPdf(pdf: any, x: number, y: number, w: number, h: number): boolean {
    const dataUrl = this.logoDataUrlCache;
    if (!dataUrl) {
      return false;
    }
    try {
      const format =
        dataUrl.includes('image/png')
          ? 'PNG'
          : dataUrl.includes('image/webp')
            ? 'WEBP'
            : 'JPEG';
      pdf.addImage(dataUrl, format, x, y, w, h, undefined, 'FAST');
      return true;
    } catch {
      return false;
    }
  }

  private invalidateLogoCache(): void {
    this.logoDataUrlCache = undefined;
    this.logoLoadPromise = null;
  }

  getFacilityName(): string {
    const cachedName = this.getCached()?.facilityName?.trim();
    if (cachedName && cachedName !== BACKEND_PLACEHOLDER_NAME) {
      return cachedName;
    }
    try {
      const stored =
        sessionStorage.getItem(LOCAL_NAME_KEY)?.trim() ||
        localStorage.getItem(LOCAL_NAME_KEY)?.trim();
      if (stored && stored !== BACKEND_PLACEHOLDER_NAME) {
        return stored;
      }
    } catch {
      /* ignore */
    }
    return DEFAULT_FACILITY_NAME;
  }

  /** True when admin has saved a custom facility name (not blank). */
  isFacilityNameEstablished(): boolean {
    const name = this.getCached()?.facilityName?.trim();
    return !!name;
  }

  /** True when admin has saved a custom facility logo URL. */
  isFacilityLogoEstablished(): boolean {
    return !!this.getFacilityLogoUrl();
  }

  getMedicalRecordsHeaderLine(): string {
    const b = this.getCached();
    if (b?.medicalRecordsHeaderLine) {
      return b.medicalRecordsHeaderLine;
    }
    const name = this.getFacilityName();
    return `Department of Medical Records-${name}`;
  }

  getContactInquiryLine(): string {
    const b = this.getCached();
    if (b?.contactInquiryLine) {
      return b.contactInquiryLine;
    }
    return 'For inquiries / suggestions call: —';
  }

  /** Default true: sidebar docked and sharing space with main content. */
  getSidebarStacked(): boolean {
    const cached = this.getCached()?.sidebarStacked;
    if (cached === false) {
      return false;
    }
    return true;
  }

  /** Default false: OTC counter sale hides dosage / frequency / duration until staff enable them. */
  getOtcIncludePrescribing(): boolean {
    return this.getCached()?.otcIncludePrescribing === true;
  }

  /** Default true: pharmacy Choose Treatment uses stock batches; false = shop items. */
  getPharmacyUseStockBatch(): boolean {
    return this.getCached()?.pharmacyUseStockBatch !== false;
  }

  getPrivilegeOpenVisitUserIds(): number[] {
    return this.parseUserIds(this.getCached()?.privilegeOpenVisitUserIds);
  }

  getPrivilegeVenerandaGroupUserIds(): number[] {
    return this.parseUserIds(this.getCached()?.privilegeVenerandaGroupUserIds);
  }

  getPrivilegeCreditGroupUserIds(): number[] {
    return this.parseUserIds(this.getCached()?.privilegeCreditGroupUserIds);
  }

  getPrivilegeCreditAllowedGroupIds(): number[] {
    return this.parseUserIds(this.getCached()?.privilegeCreditAllowedGroupIds);
  }

  private parseUserIds(csv: string | null | undefined): number[] {
    if (!csv?.trim()) {
      return [];
    }
    return csv
      .split(',')
      .map((s) => Number(String(s).trim()))
      .filter((n) => Number.isFinite(n) && n > 0);
  }

  private applyCache(data: FacilityBranding | null | undefined): void {
    if (!data) {
      return;
    }
    this.cached = { ...data };
    this.invalidateLogoCache();
    this.writeSessionAndLocal(this.cached);
    this.loginNameSubject.next(this.getFacilityName());
    this.loginLogoSubject.next(this.getLoginLogoUrl());
    this.sidebarStackedSubject.next(this.getSidebarStacked());
    void this.persistLogoToLocalAssets(data.facilityLogoUrl);
  }

  private writeSessionAndLocal(data: FacilityBranding): void {
    const json = JSON.stringify(data);
    try {
      sessionStorage.setItem(STORAGE_KEY, json);
    } catch {
      /* ignore */
    }
    try {
      localStorage.setItem(LOCAL_BRANDING_KEY, json);
    } catch {
      /* ignore */
    }

    const name = data.facilityName?.trim();
    if (name) {
      try {
        sessionStorage.setItem(LOCAL_NAME_KEY, name);
        localStorage.setItem(LOCAL_NAME_KEY, name);
      } catch {
        /* ignore */
      }
    }

    const address = data.facilityAddress?.trim();
    if (address) {
      try {
        sessionStorage.setItem('facilityAddress', address);
        localStorage.setItem('facilityAddress', address);
      } catch {
        /* ignore */
      }
    }

    const logoUrl = data.facilityLogoUrl?.trim();
    if (logoUrl) {
      try {
        sessionStorage.setItem(LOCAL_LOGO_URL_KEY, logoUrl);
        localStorage.setItem(LOCAL_LOGO_URL_KEY, logoUrl);
      } catch {
        /* ignore */
      }
    } else {
      try {
        sessionStorage.removeItem(LOCAL_LOGO_URL_KEY);
        localStorage.removeItem(LOCAL_LOGO_URL_KEY);
        localStorage.removeItem(LOCAL_LOGO_DATA_KEY);
      } catch {
        /* ignore */
      }
    }
  }

  private readLocalBranding(): FacilityBranding | null {
    try {
      const raw = localStorage.getItem(LOCAL_BRANDING_KEY);
      if (raw) {
        return JSON.parse(raw) as FacilityBranding;
      }
    } catch {
      /* ignore */
    }
    try {
      const name = localStorage.getItem(LOCAL_NAME_KEY)?.trim();
      const logo = localStorage.getItem(LOCAL_LOGO_URL_KEY)?.trim();
      if (name || logo) {
        return {
          facilityName: name || undefined,
          facilityLogoUrl: logo || undefined,
        };
      }
    } catch {
      /* ignore */
    }
    return null;
  }

  /**
   * Store a logo data URL from an admin upload (avoids CORS issues fetching Cloudinary later).
   */
  cacheLoginLogoDataUrl(dataUrl: string | null | undefined): void {
    const value = (dataUrl || '').trim();
    if (!value.startsWith('data:image')) {
      return;
    }
    this.storeLocalLogoDataUrl(value);
    this.logoDataUrlCache = value;
    this.loginLogoSubject.next(this.getLoginLogoUrl());
  }

  /**
   * Download the registered logo and keep a data-URL copy in localStorage
   * so the next login paints instantly (even offline / slow network).
   */
  private async persistLogoToLocalAssets(logoUrl: string | null | undefined): Promise<void> {
    const url = (logoUrl || '').trim();
    if (!url) {
      try {
        localStorage.removeItem(LOCAL_LOGO_DATA_KEY);
      } catch {
        /* ignore */
      }
      this.loginLogoSubject.next(this.getLoginLogoUrl());
      return;
    }

    // Already a data URL from upload preview — store if size allows.
    if (url.startsWith('data:image')) {
      this.storeLocalLogoDataUrl(url);
      this.loginLogoSubject.next(this.getLoginLogoUrl());
      return;
    }

    try {
      const response = await fetch(url, { mode: 'cors' });
      if (!response.ok) {
        this.loginLogoSubject.next(url);
        return;
      }
      const blob = await response.blob();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
      this.storeLocalLogoDataUrl(dataUrl);
      this.logoDataUrlCache = dataUrl;
      this.loginLogoSubject.next(this.getLoginLogoUrl());
    } catch {
      // CORS or network — keep remote URL; login still works online.
      this.loginLogoSubject.next(url);
    }
  }

  private storeLocalLogoDataUrl(dataUrl: string): void {
    if (!dataUrl || dataUrl.length > LOCAL_LOGO_DATA_MAX_CHARS) {
      return;
    }
    try {
      localStorage.setItem(LOCAL_LOGO_DATA_KEY, dataUrl);
    } catch {
      // Quota exceeded — keep remote URL only.
      try {
        localStorage.removeItem(LOCAL_LOGO_DATA_KEY);
      } catch {
        /* ignore */
      }
    }
  }
}
