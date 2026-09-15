import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ThemeService } from '../../../../services/theme.service';
import { ApiService } from '../../../../services/api.service';

type Gateway = 'dgateway' | 'flutterwave';
type PayMethod = 'mobile_money' | 'card';
type FlwNetwork = 'MTN' | 'AIRTEL';

interface PaymentStatus {
  referenceId?: string;
  provider?: string;
  phoneNumber?: string;
  amount?: number;
  currency?: string;
  status?: string;
  message?: string;
  mock?: boolean;
  network?: string;
}

@Component({
  selector: 'app-subscription-payment',
  templateUrl: './subscription-payment.component.html',
  styleUrls: ['./subscription-payment.component.css'],
})
export class SubscriptionPaymentComponent implements OnInit, OnDestroy {
  isDarkMode = false;
  gateway: Gateway = 'flutterwave';
  method: PayMethod = 'mobile_money';
  network: FlwNetwork = 'MTN';
  phoneNumber = '';
  amount: number | null = null;
  note = '';
  isPaying = false;
  isPolling = false;
  responseMessage = '';
  responseColor = '';
  payment: PaymentStatus | null = null;
  dgatewayInfo: any = null;
  flutterwaveInfo: any = null;

  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private pollStartedAt = 0;

  constructor(
    private router: Router,
    private themeService: ThemeService,
    private api: ApiService
  ) {}

  ngOnInit(): void {
    if (!sessionStorage.getItem('username')) {
      this.router.navigate(['/login4']);
      return;
    }
    this.themeService.isDarkMode$.subscribe((isDark) => {
      this.isDarkMode = isDark;
    });
    this.api.getDGatewayProviders().subscribe({
      next: (res: any) => {
        this.dgatewayInfo = res?.data ?? res;
      },
      error: () => undefined,
    });
    this.api.getFlutterwaveProviders().subscribe({
      next: (res: any) => {
        this.flutterwaveInfo = res?.data ?? res;
      },
      error: () => undefined,
    });
  }

  ngOnDestroy(): void {
    this.stopPolling();
  }

  goBack(): void {
    this.router.navigate(['/overview/subscription']);
  }

  selectGateway(gateway: Gateway): void {
    if (this.isPaying || this.isPolling) {
      return;
    }
    this.gateway = gateway;
    if (gateway === 'flutterwave') {
      this.method = 'mobile_money';
    }
  }

  selectMethod(method: PayMethod): void {
    if (this.isPaying || this.isPolling || this.gateway !== 'dgateway') {
      return;
    }
    this.method = method;
  }

  get currency(): string {
    return this.gateway === 'dgateway' && this.method === 'card' ? 'USD' : 'UGX';
  }

  get configuredHint(): string {
    if (this.gateway === 'flutterwave') {
      if (this.flutterwaveInfo?.flutterwaveConfigured) {
        return 'Flutterwave connected (sandbox or live).';
      }
      if (this.flutterwaveInfo?.mockWhenUnconfigured) {
        return 'Flutterwave key not set — demo mode.';
      }
      return '';
    }
    if (this.dgatewayInfo?.dgatewayConfigured || this.dgatewayInfo?.mtnConfigured) {
      return 'DGateway connected.';
    }
    if (this.dgatewayInfo?.mockWhenUnconfigured) {
      return 'DGateway key not set — demo mode.';
    }
    return '';
  }

  pay(): void {
    const phone = this.phoneNumber.trim();
    const amount = Number(this.amount);
    if (this.method === 'mobile_money' && !phone) {
      this.showFeedback('Enter the phone number that has mobile money', 'error');
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      this.showFeedback('Enter a valid amount', 'error');
      return;
    }

    this.isPaying = true;
    this.payment = null;
    this.stopPolling();

    const onOk = (res: any) => {
      this.isPaying = false;
      const data = res?.data ?? res;
      this.payment = data;
      this.showFeedback(data?.message || 'Check your phone and approve the prompt.', 'success');
      if (data?.referenceId && (data?.status === 'PENDING' || !data?.status)) {
        this.startPolling(data.referenceId);
      }
    };
    const onErr = (err: any) => {
      this.isPaying = false;
      this.showFeedback(err?.error?.message || 'Could not start payment', 'error');
    };

    if (this.gateway === 'flutterwave') {
      this.api
        .initiateFlutterwavePayment({
          phoneNumber: phone,
          amount,
          currency: 'UGX',
          network: this.network,
          description: this.note.trim() || 'Facility subscription payment',
        })
        .subscribe({ next: onOk, error: onErr });
      return;
    }

    this.api
      .initiateDGatewayPayment({
        phoneNumber: this.method === 'mobile_money' ? phone : undefined,
        amount,
        currency: this.currency,
        description: this.note.trim() || 'Facility subscription payment',
        method: this.method,
      })
      .subscribe({ next: onOk, error: onErr });
  }

  get statusClass(): string {
    const s = (this.payment?.status || '').toUpperCase();
    if (s === 'SUCCESSFUL') {
      return 'ok';
    }
    if (s === 'FAILED' || s === 'TIMEOUT') {
      return 'bad';
    }
    return 'pending';
  }

  private startPolling(referenceId: string): void {
    this.isPolling = true;
    this.pollStartedAt = Date.now();
    const intervalMs = this.gateway === 'flutterwave' ? 5000 : 10000;
    this.pollTimer = setInterval(() => {
      if (Date.now() - this.pollStartedAt > 5 * 60 * 1000) {
        this.stopPolling();
        this.showFeedback('Payment timed out waiting for confirmation', 'error');
        return;
      }
      const req =
        this.gateway === 'flutterwave'
          ? this.api.getFlutterwavePaymentStatus(referenceId)
          : this.api.getDGatewayPaymentStatus(referenceId);
      req.subscribe({
        next: (res: any) => {
          const data = res?.data ?? res;
          this.payment = data;
          const status = String(data?.status || '').toUpperCase();
          if (status === 'SUCCESSFUL' || status === 'FAILED' || status === 'TIMEOUT') {
            this.stopPolling();
            this.showFeedback(
              data?.message || (status === 'SUCCESSFUL' ? 'Payment completed' : 'Payment ended'),
              status === 'SUCCESSFUL' ? 'success' : 'error'
            );
          }
        },
        error: () => undefined,
      });
    }, intervalMs);
  }

  private stopPolling(): void {
    this.isPolling = false;
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private showFeedback(message: string, type: 'success' | 'error'): void {
    this.responseMessage = message;
    this.responseColor = type === 'success' ? '#16a34a' : '#dc2626';
    setTimeout(() => {
      this.responseMessage = '';
    }, 6000);
  }
}