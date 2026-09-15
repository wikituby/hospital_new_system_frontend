import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from '../../../../services/api.service';
import { ThemeService } from '../../../../services/theme.service';

@Component({
  selector: 'app-mobile-money-settings',
  templateUrl: './mobile-money-settings.component.html',
  styleUrls: ['./mobile-money-settings.component.css']
})
export class MobileMoneySettingsComponent implements OnInit {
  isDarkMode = false;
  isLoading = false;
  isSavingDgateway = false;
  isSavingFlutterwave = false;
  responseMessage = '';
  responseColor = '';
  activeTab: 'dgateway' | 'flutterwave' = 'dgateway';

  dgateway = {
    apiUrl: 'https://dgatewayapi.desispay.com',
    apiKey: '',
    webhookSecret: '',
    webhookCallbackUrl: '',
    stripePublishableKey: '',
    defaultCurrency: 'UGX',
    enabled: true,
  };

  flutterwave = {
    apiUrl: 'https://api.flutterwave.com/v3',
    clientId: '',
    secretKey: '',
    publicKey: '',
    encryptionKey: '',
    webhookSecretHash: '',
    webhookCallbackUrl: '',
    defaultEmail: 'billing@facility.local',
    defaultCurrency: 'UGX',
    enabled: true,
  };

  status = {
    dgatewayConfigured: false,
    flutterwaveConfigured: false,
    dgatewayUpdatedAt: '',
    flutterwaveUpdatedAt: '',
  };

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

  loadSettings(): void {
    this.isLoading = true;
    let pending = 2;
    const done = () => {
      pending -= 1;
      if (pending <= 0) {
        this.isLoading = false;
      }
    };
    this.api.getDGatewaySettings().subscribe({
      next: (data: any) => {
        this.applyDgateway(data);
        done();
      },
      error: () => done(),
    });
    this.api.getFlutterwaveSettings().subscribe({
      next: (data: any) => {
        this.applyFlutterwave(data);
        done();
      },
      error: () => done(),
    });
  }

  saveDgateway(): void {
    this.isSavingDgateway = true;
    this.api.saveDGatewaySettings({ ...this.dgateway }).subscribe({
      next: (res: any) => {
        this.isSavingDgateway = false;
        this.applyDgateway(res?.data ?? res);
        this.showFeedback(res?.message || 'DGateway settings saved', 'success');
      },
      error: (err: any) => {
        this.isSavingDgateway = false;
        this.showFeedback(err?.error?.message || 'Failed to save DGateway', 'error');
      }
    });
  }

  saveFlutterwave(): void {
    this.isSavingFlutterwave = true;
    this.api.saveFlutterwaveSettings({ ...this.flutterwave }).subscribe({
      next: (res: any) => {
        this.isSavingFlutterwave = false;
        this.applyFlutterwave(res?.data ?? res);
        this.showFeedback(res?.message || 'Flutterwave settings saved', 'success');
      },
      error: (err: any) => {
        this.isSavingFlutterwave = false;
        this.showFeedback(err?.error?.message || 'Failed to save Flutterwave', 'error');
      }
    });
  }

  goToPayment(): void {
    this.router.navigate(['/overview/subscription/payment']);
  }

  private applyDgateway(data: any): void {
    if (!data) {
      return;
    }
    this.dgateway.apiUrl = data.apiUrl || this.dgateway.apiUrl;
    this.dgateway.apiKey = data.apiKey || '';
    this.dgateway.webhookSecret = data.webhookSecret || '';
    this.dgateway.webhookCallbackUrl = data.webhookCallbackUrl || '';
    this.dgateway.stripePublishableKey = data.stripePublishableKey || '';
    this.dgateway.defaultCurrency = data.defaultCurrency || 'UGX';
    this.dgateway.enabled = data.enabled !== false;
    this.status.dgatewayConfigured = !!data.configured;
    this.status.dgatewayUpdatedAt = data.updatedAt || '';
  }

  private applyFlutterwave(data: any): void {
    if (!data) {
      return;
    }
    this.flutterwave.apiUrl = data.apiUrl || this.flutterwave.apiUrl;
    this.flutterwave.clientId = data.clientId || '';
    this.flutterwave.secretKey = data.secretKey || '';
    this.flutterwave.publicKey = data.publicKey || '';
    this.flutterwave.encryptionKey = data.encryptionKey || '';
    this.flutterwave.webhookSecretHash = data.webhookSecretHash || '';
    this.flutterwave.webhookCallbackUrl = data.webhookCallbackUrl || '';
    this.flutterwave.defaultEmail = data.defaultEmail || 'billing@facility.local';
    this.flutterwave.defaultCurrency = data.defaultCurrency || 'UGX';
    this.flutterwave.enabled = data.enabled !== false;
    this.status.flutterwaveConfigured = !!data.configured;
    this.status.flutterwaveUpdatedAt = data.updatedAt || '';
  }

  private showFeedback(message: string, type: 'success' | 'error'): void {
    this.responseMessage = message;
    this.responseColor = type === 'success' ? '#16a34a' : '#dc2626';
    setTimeout(() => {
      this.responseMessage = '';
    }, 6000);
  }
}