import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from '../../../../services/api.service';
import { ThemeService } from '../../../../services/theme.service';

@Component({
  selector: 'app-income-management',
  templateUrl: './income-management.component.html',
  styleUrls: ['./income-management.component.css']
})
export class IncomeManagementComponent implements OnInit {
  isDarkMode = false;
  isLoading = false;
  dateFrom = '';
  dateTo = '';
  summary: any = { accounts: [], totalIncome: 0 };
  entries: any[] = [];
  accounts: any[] = [];
  categories: any[] = [];
  categoryChartData: { name: string; amount: number; percent: number }[] = [];

  constructor(
    private router: Router,
    private api: ApiService,
    private themeService: ThemeService
  ) {}

  ngOnInit(): void {
    if (!sessionStorage.getItem('username')) {
      this.router.navigate(['/login']);
      return;
    }
    this.themeService.isDarkMode$.subscribe((isDark) => (this.isDarkMode = isDark));
    this.setDefaultDateRange();
    this.loadAll();
  }

  get totalIncome(): number {
    return this.toNumber(this.summary?.totalIncome);
  }

  get accountCards(): any[] {
    return this.summary?.accounts || [];
  }

  get transactionCount(): number {
    return this.entries.length;
  }

  get averageIncome(): number {
    return this.entries.length ? this.entries.reduce((s, e) => s + this.toNumber(e.amount), 0) / this.entries.length : 0;
  }

  applyDateFilter(): void {
    this.loadAll();
  }

  clearDateFilter(): void {
    this.setDefaultDateRange();
    this.loadAll();
  }

  loadAll(): void {
    this.isLoading = true;
    const params = { dateFrom: this.dateFrom, dateTo: this.dateTo };
    let pending = 4;
    const done = () => {
      if (--pending <= 0) {
        this.isLoading = false;
        this.computeCategoryChart();
      }
    };

    this.api.getIncomeSummary(params).subscribe({
      next: (res: any) => {
        this.summary = res?.data ?? res ?? { accounts: [], totalIncome: 0 };
        done();
      },
      error: () => {
        this.summary = { accounts: [], totalIncome: 0 };
        done();
      }
    });

    this.api.getAllIncomeEntries(params).subscribe({
      next: (res: any) => {
        this.entries = Array.isArray(res) ? res : [];
        done();
      },
      error: () => {
        this.entries = [];
        done();
      }
    });

    this.api.getIncomeAccountList().subscribe({
      next: (res: any) => {
        this.accounts = Array.isArray(res) ? res : [];
        done();
      },
      error: () => {
        this.accounts = [];
        done();
      }
    });

    this.api.getIncomeCategoryList().subscribe({
      next: (res: any) => {
        this.categories = Array.isArray(res) ? res : [];
        done();
      },
      error: () => {
        this.categories = [];
        done();
      }
    });
  }

  accountIcon(type: string): string {
    if ((type || '').startsWith('ACCOUNT_')) return 'bi-wallet2';
    switch ((type || '').toUpperCase()) {
      case 'CLIENT_PAYMENTS': return 'bi-people';
      case 'DONATIONS': return 'bi-heart';
      case 'INVESTORS': return 'bi-graph-up-arrow';
      case 'GRANTS': return 'bi-award';
      default: return 'bi-cash-stack';
    }
  }

  accountAccent(type: string): string {
    if ((type || '').startsWith('ACCOUNT_')) return 'accent-teal';
    switch ((type || '').toUpperCase()) {
      case 'CLIENT_PAYMENTS': return 'accent-blue';
      case 'DONATIONS': return 'accent-green';
      case 'INVESTORS': return 'accent-purple';
      case 'GRANTS': return 'accent-warn';
      default: return 'accent-teal';
    }
  }

  formatAmount(value: any): string {
    return this.toNumber(value).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }

  private computeCategoryChart(): void {
    const byCat = new Map<string, number>();
    for (const e of this.entries) {
      const cat = e.incomeCategoryName || 'Uncategorized';
      byCat.set(cat, (byCat.get(cat) || 0) + this.toNumber(e.amount));
    }
    const max = Math.max(...Array.from(byCat.values()), 1);
    this.categoryChartData = Array.from(byCat.entries())
      .map(([name, amount]) => ({ name, amount, percent: (amount / max) * 100 }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8);
  }

  private setDefaultDateRange(): void {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    this.dateFrom = this.toInputDate(start);
    this.dateTo = this.toInputDate(now);
  }

  private toInputDate(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  private toNumber(value: any): number {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
}
