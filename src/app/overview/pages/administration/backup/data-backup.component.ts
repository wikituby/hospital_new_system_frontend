import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from '../../../../services/api.service';
import { ThemeService } from '../../../../services/theme.service';

@Component({
  selector: 'app-data-backup',
  templateUrl: './data-backup.component.html',
  styleUrls: ['./data-backup.component.css']
})
export class DataBackupComponent implements OnInit {
  isDarkMode = false;
  isLoading = false;
  isSaving = false;
  isBackingUp = false;
  isRestoring = false;
  isLoggingOut = false;
  responseMessage = '';
  responseColor = '';

  form = {
    facilityName: '',
    dropboxAccessToken: '',
    dropboxRefreshToken: '',
    dropboxAppKey: '',
    dropboxAppSecret: '',
    dropboxBackupPath: '',
    localBackupRoot: 'C:/MediCenter-Backups',
    tokenMode: 'oauth_refresh',
    scheduledEnabled: true,
    localBackupEnabled: true,
    dropboxBackupEnabled: true,
    intervalMinutes: 5,
  };

  status = {
    lastBackupAt: '',
    lastLocalBackupAt: '',
    lastDropboxBackupAt: '',
    lastBackupStatus: '',
    lastError: '',
    dropboxConnected: false,
    localBackupPathPreview: '',
    mobileSqliteLocalPathPreview: '',
    mobileSqliteDropboxPathPreview: '',
  };

  restoreSource: 'local' | 'dropbox' = 'local';
  showRestoreConfirm = false;

  constructor(
    private router: Router,
    private api: ApiService,
    private themeService: ThemeService
  ) {}

  ngOnInit(): void {
    if (!sessionStorage.getItem('username')) {
      this.router.navigate(['/login4']);
      return;
    }

    this.themeService.isDarkMode$.subscribe(isDark => {
      this.isDarkMode = isDark;
    });

    this.loadSettings();
  }

  get tokenModeLabel(): string {
    return this.form.tokenMode === 'access_token' ? 'Access token' : 'OAuth refresh token';
  }

  get lastBackupLabel(): string {
    if (!this.status.lastBackupAt) {
      return 'Never';
    }
    return this.formatDateTime(this.status.lastBackupAt);
  }

  loadSettings(): void {
    this.isLoading = true;
    this.api.getBackupSettings().subscribe({
      next: (data: any) => {
        this.applySettings(data);
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
        this.showFeedback('Failed to load backup settings', 'error');
      }
    });
  }

  saveSettings(): void {
    this.isSaving = true;
    const payload: Record<string, unknown> = { ...this.form, localBackupEnabled: true };
    if (this.form.dropboxRefreshToken?.trim() && this.form.dropboxAppKey?.trim() && this.form.dropboxAppSecret?.trim()) {
      payload['tokenMode'] = 'oauth_refresh';
      payload['dropboxAccessToken'] = null;
    }
    this.api.saveBackupSettings(payload).subscribe({
      next: (res: any) => {
        this.isSaving = false;
        this.applySettings(res?.data ?? res);
        this.showFeedback(res?.message || 'Settings saved', 'success');
      },
      error: (err: any) => {
        this.isSaving = false;
        this.showFeedback(err?.error?.message || 'Failed to save settings', 'error');
      }
    });
  }

  backupNow(): void {
    this.isBackingUp = true;
    this.api.runBackupNow().subscribe({
      next: (res: any) => {
        this.isBackingUp = false;
        const data = res?.data ?? res;
        this.status.lastBackupAt = data?.lastBackupAt || this.status.lastBackupAt;
        this.status.lastBackupStatus = data?.lastBackupStatus || '';
        this.showFeedback(data?.message || res?.message || 'Backup completed', data?.success === false ? 'error' : 'success');
        this.loadSettings();
      },
      error: (err: any) => {
        this.isBackingUp = false;
        this.showFeedback(err?.error?.message || 'Backup failed', 'error');
      }
    });
  }

  openRestoreConfirm(): void {
    this.showRestoreConfirm = true;
  }

  closeRestoreConfirm(): void {
    if (!this.isRestoring) {
      this.showRestoreConfirm = false;
    }
  }

  restoreNow(): void {
    this.isRestoring = true;
    this.api.restoreBackupNow(this.restoreSource).subscribe({
      next: (res: any) => {
        this.isRestoring = false;
        this.showRestoreConfirm = false;
        const data = res?.data ?? res;
        this.showFeedback(data?.message || res?.message || 'Restore completed', data?.success === false ? 'error' : 'success');
      },
      error: (err: any) => {
        this.isRestoring = false;
        this.showFeedback(err?.error?.message || 'Restore failed', 'error');
      }
    });
  }

  dropboxLogout(): void {
    this.isLoggingOut = true;
    this.api.logoutDropboxBackup().subscribe({
      next: (res: any) => {
        this.isLoggingOut = false;
        this.applySettings(res?.data ?? res);
        this.form.dropboxAccessToken = '';
        this.form.dropboxRefreshToken = '';
        this.form.dropboxAppKey = '';
        this.form.dropboxAppSecret = '';
        this.showFeedback(res?.message || 'Dropbox disconnected', 'success');
      },
      error: (err: any) => {
        this.isLoggingOut = false;
        this.showFeedback(err?.error?.message || 'Failed to logout Dropbox', 'error');
      }
    });
  }

  formatDateTime(value?: string): string {
    if (!value) {
      return 'N/A';
    }
    const d = new Date(value.includes('T') ? value : value.replace(' ', 'T'));
    return Number.isNaN(d.getTime()) ? value : d.toLocaleString();
  }

  private applySettings(data: any): void {
    if (!data) {
      return;
    }
    this.form.facilityName = data.facilityName || '';
    this.form.dropboxAccessToken = data.dropboxAccessToken || '';
    this.form.dropboxRefreshToken = data.dropboxRefreshToken || '';
    this.form.dropboxAppKey = data.dropboxAppKey || '';
    this.form.dropboxAppSecret = data.dropboxAppSecret || '';
    this.form.dropboxBackupPath = data.dropboxBackupPath || '';
    this.form.localBackupRoot = data.localBackupRoot || 'C:/MediCenter-Backups';
    this.form.tokenMode = data.tokenMode || 'oauth_refresh';
    this.form.scheduledEnabled = data.scheduledEnabled !== false;
    this.form.localBackupEnabled = data.localBackupEnabled !== false;
    this.form.dropboxBackupEnabled = data.dropboxBackupEnabled !== false;
    this.form.intervalMinutes = data.intervalMinutes || 5;

    this.status.lastBackupAt = data.lastBackupAt || '';
    this.status.lastLocalBackupAt = data.lastLocalBackupAt || '';
    this.status.lastDropboxBackupAt = data.lastDropboxBackupAt || '';
    this.status.lastBackupStatus = data.lastBackupStatus || '';
    this.status.lastError = data.lastError || '';
    this.status.dropboxConnected = !!data.dropboxConnected;
    this.status.localBackupPathPreview = data.localBackupPathPreview || '';
    this.status.mobileSqliteLocalPathPreview = data.mobileSqliteLocalPathPreview || '';
    this.status.mobileSqliteDropboxPathPreview = data.mobileSqliteDropboxPathPreview || '';
  }

  private showFeedback(message: string, type: 'success' | 'error'): void {
    this.responseMessage = message;
    this.responseColor = type === 'success' ? '#16a34a' : '#dc2626';
    setTimeout(() => {
      this.responseMessage = '';
    }, 6000);
  }
}
