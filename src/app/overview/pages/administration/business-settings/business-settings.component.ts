import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { ThemeService } from '../../../../services/theme.service';
import { FacilityBrandingService, DEFAULT_FACILITY_LOGO, DEFAULT_FACILITY_NAME } from '../../../../services/facility-branding.service';
import { FacilityBranding } from '../../../../models/facility-branding.model';
import { ApiService } from '../../../../services/api.service';
import { ApiConfigService } from '../../../../services/api-config.service';
import { API_DEFAULT_PORT } from '../../../../config/api-server.config';
import { defaultContactValue } from '../../../../utils/phone-contact.util';

@Component({
  selector: 'app-business-settings',
  templateUrl: './business-settings.component.html',
  styleUrls: ['./business-settings.component.css', '../subscription/subscription.component.css'],
})
export class BusinessSettingsComponent implements OnInit, OnDestroy {
  isDarkMode = false;
  isLoading = false;
  isSaving = false;
  responseMessage = '';
  responseColor = '';

  readonly defaultLogoPath = DEFAULT_FACILITY_LOGO;
  readonly defaultFacilityName = DEFAULT_FACILITY_NAME;
  logoPreviewUrl = this.defaultLogoPath;
  logoUploading = false;
  logoUploadMessage = '';
  logoUploadError = '';
  private readonly logoMaxBytes = 5 * 1024 * 1024;

  form: FacilityBranding = {
    facilityLogoUrl: '',
    facilityName: '',
    facilityAddress: '',
    subsidiaryLabel: '',
    phonePrimary: defaultContactValue(),
    phoneSecondary: defaultContactValue(),
    email: '',
    financeDepartmentName: 'Department of Finance',
    medicalRecordsDepartmentName: 'Department of Medical Records',
    diagnosticsDepartmentName: 'Department of Medical Diagnostics',
    bankName: '',
    ugxAccountNumber: '',
    usdAccountNumber: '',
    thankYouMessage: '',
    invoiceFooterContactLine: '',
    sidebarStacked: true,
    otcIncludePrescribing: false,
    pharmacyUseStockBatch: true,
  };

  preview = {
    financeHeaderLine: '',
    medicalRecordsHeaderLine: '',
    contactInquiryLine: '',
    invoiceFooterMainLine: '',
    thankYouLine: '',
  };

  activeServerLabel = '';
  private apiStateSub?: Subscription;

  /** Dropbox path used only when clicking Update DB (manual restore). */
  dropboxDbPath = '';
  dropboxConnected = false;
  isUpdatingDb = false;
  updateDbMessage = '';
  updateDbColor = '';

  constructor(
    private router: Router,
    private themeService: ThemeService,
    private facilityBranding: FacilityBrandingService,
    private api: ApiService,
    private apiConfig: ApiConfigService
  ) {}

  ngOnInit(): void {
    if (!sessionStorage.getItem('username')) {
      this.router.navigate(['/login']);
      return;
    }
    const role = (sessionStorage.getItem('userrole') || '').toLowerCase().trim();
    if (role !== 'admin' && role !== 'md') {
      this.router.navigate(['/overview/main-dashboard']);
      return;
    }
    this.themeService.isDarkMode$.subscribe((isDark) => (this.isDarkMode = isDark));
    this.refreshActiveServerLabel();
    this.apiStateSub = this.apiConfig.state$.subscribe((state) => {
      if (state === 'ready') {
        this.refreshActiveServerLabel();
      }
    });
    this.load();
    this.loadBackupPath();
  }

  private loadBackupPath(): void {
    this.api.getBackupSettings().subscribe({
      next: (data: any) => {
        this.dropboxDbPath = (data?.dropboxBackupPath || '').trim();
        this.dropboxConnected = !!data?.dropboxConnected;
      },
      error: () => {
        // Path section stays editable; Update DB will surface Dropbox config errors.
      },
    });
  }

  saveDropboxPath(): void {
    const path = (this.dropboxDbPath || '').trim();
    if (!path) {
      this.updateDbColor = 'rgb(238, 16, 16)';
      this.updateDbMessage = 'Enter a Dropbox path first (e.g. Veneranda-Medical/vena.zip).';
      return;
    }
    this.api.saveBackupSettings({ dropboxBackupPath: path }).subscribe({
      next: (res: any) => {
        const data = res?.data ?? res;
        if (data?.dropboxBackupPath) {
          this.dropboxDbPath = data.dropboxBackupPath;
        }
        this.dropboxConnected = data?.dropboxConnected ?? this.dropboxConnected;
        this.updateDbColor = 'rgb(22, 163, 74)';
        this.updateDbMessage = 'Dropbox path saved.';
      },
      error: (err: any) => {
        this.updateDbColor = 'rgb(238, 16, 16)';
        this.updateDbMessage =
          err?.error?.message || err?.message || 'Could not save Dropbox path.';
      },
    });
  }

  updateDbFromDropbox(): void {
    const path = (this.dropboxDbPath || '').trim();
    if (!path) {
      this.updateDbColor = 'rgb(238, 16, 16)';
      this.updateDbMessage = 'Enter a Dropbox path before updating the database.';
      return;
    }
    const ok = confirm(
      'Update this clinic database from Dropbox?\n\n' +
        'This overwrites local MySQL data with the backup at:\n' +
        path +
        '\n\nOnly click Update DB when you intend to restore. This does not run on a schedule.'
    );
    if (!ok) {
      return;
    }
    this.isUpdatingDb = true;
    this.updateDbMessage = '';
    this.api.restoreBackupNow('dropbox', path).subscribe({
      next: (res: any) => {
        this.isUpdatingDb = false;
        const data = res?.data ?? res;
        const success = data?.success !== false;
        this.updateDbColor = success ? 'rgb(22, 163, 74)' : 'rgb(238, 16, 16)';
        this.updateDbMessage =
          data?.message || res?.message || (success ? 'Database updated from Dropbox.' : 'Update failed.');
        if (data?.dropboxPath) {
          this.dropboxDbPath = data.dropboxPath;
        }
      },
      error: (err: any) => {
        this.isUpdatingDb = false;
        this.updateDbColor = 'rgb(238, 16, 16)';
        this.updateDbMessage =
          err?.error?.message || err?.message || 'Could not update database from Dropbox.';
      },
    });
  }

  ngOnDestroy(): void {
    this.apiStateSub?.unsubscribe();
  }

  changeServer(): void {
    this.apiConfig.openServerConnectionDialog();
  }

  private refreshActiveServerLabel(): void {
    this.activeServerLabel = this.formatServerLabel(this.apiConfig.getDisplayBaseUrl());
  }

  private formatServerLabel(baseUrl: string): string {
    const value = (baseUrl || '').trim();
    if (!value) {
      return 'Not configured';
    }
    try {
      const url = new URL(value);
      const port = url.port || String(API_DEFAULT_PORT);
      return `${url.hostname}:${port}`;
    } catch {
      return value;
    }
  }

  load(): void {
    this.isLoading = true;
    this.facilityBranding.load().subscribe({
      next: (data) => {
        this.applyForm(data);
        this.isLoading = false;
      },
      error: (err) => {
        this.isLoading = false;
        this.responseColor = 'rgb(238, 16, 16)';
        this.responseMessage =
          err?.error?.message || err?.message || 'Could not load business settings.';
      },
    });
  }

  save(): void {
    this.isSaving = true;
    this.responseMessage = '';
    this.facilityBranding.save(this.form).subscribe({
      next: (data) => {
        this.applyForm(data);
        this.isSaving = false;
        this.responseColor = 'rgb(22, 163, 74)';
        this.responseMessage = 'Business settings saved. Reports and invoices will use the updated facility details.';
      },
      error: (err) => {
        this.isSaving = false;
        this.responseColor = 'rgb(238, 16, 16)';
        this.responseMessage =
          err?.error?.message || err?.message || 'Could not save business settings.';
      },
    });
  }

  onLogoPreviewError(): void {
    if (this.logoPreviewUrl !== this.defaultLogoPath) {
      this.logoPreviewUrl = this.defaultLogoPath;
    }
  }

  async onFacilityLogoSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    this.logoUploadError = '';
    this.logoUploadMessage = '';

    if (!file) {
      return;
    }
    if (!file.type.startsWith('image/')) {
      this.logoUploadError = 'Please choose an image file (JPG, PNG, or similar).';
      return;
    }
    if (file.size > this.logoMaxBytes) {
      this.logoUploadError = 'Image must be 5 MB or smaller.';
      return;
    }

    this.logoUploading = true;
    try {
      const cropped = await this.cropImageToSquare(file, 512);
      // Cache locally for fast login display (does not depend on Cloudinary CORS).
      const localDataUrl = await this.fileToDataUrl(cropped);
      this.facilityBranding.cacheLoginLogoDataUrl(localDataUrl);
      this.api.uploadProfilePictureToCloudinary(cropped).subscribe({
        next: (url: string) => this.persistFacilityLogo(url),
        error: (err: any) => {
          this.logoUploading = false;
          this.logoUploadError = err?.message || 'Failed to upload logo.';
        },
      });
    } catch (err: any) {
      this.logoUploading = false;
      this.logoUploadError = err?.message || 'Could not process the selected image.';
    }
  }

  removeFacilityLogo(): void {
    if (!confirm('Remove the facility logo? Reports will use the default placeholder until you upload a new one.')) {
      return;
    }
    this.persistFacilityLogo('');
  }

  private persistFacilityLogo(url: string): void {
    const payload: FacilityBranding = {
      ...this.form,
      facilityLogoUrl: url || '',
    };
    this.facilityBranding.save(payload).subscribe({
      next: (data) => {
        this.applyForm(data);
        this.logoUploading = false;
        this.logoUploadMessage = url ? 'Facility logo updated.' : 'Facility logo removed.';
        this.logoUploadError = '';
      },
      error: (err: any) => {
        this.logoUploading = false;
        this.logoUploadError =
          err?.error?.message || err?.message || 'Could not save facility logo.';
      },
    });
  }

  private updateLogoPreview(): void {
    const url = this.form.facilityLogoUrl?.trim();
    this.logoPreviewUrl = url || this.defaultLogoPath;
  }

  private async cropImageToSquare(file: File, size: number = 512): Promise<File> {
    const img = await this.loadImageElement(file);
    const srcW = img.naturalWidth || img.width;
    const srcH = img.naturalHeight || img.height;
    const side = Math.min(srcW, srcH);
    const sx = Math.floor((srcW - side) / 2);
    const sy = Math.floor((srcH - side) / 2);

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not prepare image crop canvas.');
    }
    ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);

    const blob: Blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Failed to crop image.'))),
        'image/jpeg',
        0.9
      );
    });

    const baseName = (file.name || 'facility-logo').replace(/\.[^/.]+$/, '');
    return new File([blob], `${baseName}-square.jpg`, { type: 'image/jpeg' });
  }

  private loadImageElement(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Invalid image file.'));
        img.src = String(reader.result || '');
      };
      reader.onerror = () => reject(new Error('Could not read selected image.'));
      reader.readAsDataURL(file);
    });
  }

  private fileToDataUrl(file: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error || new Error('Could not read logo for local cache.'));
      reader.readAsDataURL(file);
    });
  }

  private applyForm(data: FacilityBranding): void {
    this.form = {
      facilityLogoUrl: data.facilityLogoUrl || '',
      facilityName: data.facilityName || '',
      facilityAddress: data.facilityAddress || '',
      subsidiaryLabel: data.subsidiaryLabel || '',
      phonePrimary: data.phonePrimary?.trim() || defaultContactValue(),
      phoneSecondary: data.phoneSecondary?.trim() || defaultContactValue(),
      email: data.email || '',
      financeDepartmentName: data.financeDepartmentName || 'Department of Finance',
      medicalRecordsDepartmentName:
        data.medicalRecordsDepartmentName || 'Department of Medical Records',
      diagnosticsDepartmentName:
        data.diagnosticsDepartmentName || 'Department of Medical Diagnostics',
      bankName: data.bankName || '',
      ugxAccountNumber: data.ugxAccountNumber || '',
      usdAccountNumber: data.usdAccountNumber || '',
      thankYouMessage: data.thankYouMessage || '',
      invoiceFooterContactLine: data.invoiceFooterContactLine || '',
      sidebarStacked: data.sidebarStacked !== false,
      otcIncludePrescribing: data.otcIncludePrescribing === true,
      pharmacyUseStockBatch: data.pharmacyUseStockBatch !== false,
    };
    this.updateLogoPreview();
    this.preview = {
      financeHeaderLine: data.financeHeaderLine || '',
      medicalRecordsHeaderLine: data.medicalRecordsHeaderLine || '',
      contactInquiryLine: data.contactInquiryLine || '',
      invoiceFooterMainLine: data.invoiceFooterMainLine || '',
      thankYouLine: data.thankYouLine || '',
    };
  }
}
