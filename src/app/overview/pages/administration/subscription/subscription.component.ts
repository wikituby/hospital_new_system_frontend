import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ThemeService } from '../../../../services/theme.service';
import { SubscriptionService } from '../../../../services/subscription.service';
import { SUBSCRIPTION_MODULE_LABELS } from '../../../../config/subscription-modules';

@Component({
  selector: 'app-subscription',
  templateUrl: './subscription.component.html',
  styleUrls: ['./subscription.component.css']
})
export class SubscriptionComponent implements OnInit {
  isDarkMode = false;
  activationToken = '';
  isLoading = false;
  isActivating = false;
  isCancelling = false;
  showCancelConfirm = false;
  responseMessage = '';
  responseColor = '';

  status = this.subscription.getStatus();

  readonly demoTokenHint = 'KMC-DEMO-2026';

  constructor(
    private router: Router,
    private themeService: ThemeService,
    private subscription: SubscriptionService
  ) {}

  ngOnInit(): void {
    if (!sessionStorage.getItem('username')) {
      this.router.navigate(['/login4']);
      return;
    }

    this.themeService.isDarkMode$.subscribe(isDark => {
      this.isDarkMode = isDark;
    });

    this.loadStatus();
  }

  get canActivate(): boolean {
    return this.subscription.canManageSubscription();
  }

  get isActive(): boolean {
    return this.status.active;
  }

  get moduleLabels(): string[] {
    const keys = (this.status.subscribedModuleKeys || '').split(',').map(s => s.trim()).filter(Boolean);
    if (!keys.length || keys.includes('all')) {
      return [SUBSCRIPTION_MODULE_LABELS['all']];
    }
    return keys.map(k => SUBSCRIPTION_MODULE_LABELS[k] || k);
  }

  get expiryWarning() {
    return this.subscription.getExpiryWarningInfo();
  }

  loadStatus(): void {
    this.isLoading = true;
    this.subscription.loadStatus().subscribe({
      next: () => {
        this.status = this.subscription.getStatus();
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
        this.showFeedback('Failed to load subscription status', 'error');
      }
    });
  }

  activate(): void {
    const token = this.activationToken.trim();
    if (!token) {
      this.showFeedback('Enter an activation code', 'error');
      return;
    }
    if (!this.canActivate) {
      this.showFeedback('Only MD or admin users can activate a subscription', 'error');
      return;
    }

    this.isActivating = true;
    this.subscription.activate(token).subscribe({
      next: (res: any) => {
        this.isActivating = false;
        this.status = this.subscription.getStatus();
        this.activationToken = '';
        this.showFeedback(res?.message || 'Subscription activated successfully', 'success');
        setTimeout(() => this.router.navigate(['/overview/main-dashboard']), 800);
      },
      error: (err: any) => {
        this.isActivating = false;
        this.showFeedback(err?.error?.message || 'Activation failed', 'error');
      }
    });
  }

  goToDashboard(): void {
    this.router.navigate(['/overview/main-dashboard']);
  }

  goToPayment(): void {
    this.router.navigate(['/overview/subscription/payment']);
  }

  openCancelConfirm(): void {
    this.showCancelConfirm = true;
  }

  closeCancelConfirm(): void {
    if (!this.isCancelling) {
      this.showCancelConfirm = false;
    }
  }

  cancelActivation(): void {
    if (!this.canActivate) {
      this.showFeedback('Only MD or admin users can cancel a subscription', 'error');
      return;
    }

    this.isCancelling = true;
    this.subscription.cancel().subscribe({
      next: (res: any) => {
        this.isCancelling = false;
        this.showCancelConfirm = false;
        this.status = this.subscription.getStatus();
        this.showFeedback(res?.message || 'Subscription cancelled', 'success');
      },
      error: (err: any) => {
        this.isCancelling = false;
        this.showFeedback(err?.error?.message || 'Failed to cancel subscription', 'error');
      }
    });
  }

  formatDate(value?: string): string {
    if (!value) {
      return 'N/A';
    }
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString();
  }

  private showFeedback(message: string, type: 'success' | 'error'): void {
    this.responseMessage = message;
    this.responseColor = type === 'success' ? '#16a34a' : '#dc2626';
    setTimeout(() => {
      this.responseMessage = '';
    }, 5000);
  }
}
