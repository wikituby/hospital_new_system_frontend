import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from '../../../../services/api.service';
import { ThemeService } from '../../../../services/theme.service';

@Component({
  selector: 'app-expense-analytics',
  templateUrl: './expense-analytics.component.html',
  styleUrls: ['./expense-analytics.component.css']
})
export class ExpenseAnalyticsComponent implements OnInit {
  isDarkMode = false;
  isLoading = false;

  transactions: any[] = [];
  accounts: any[] = [];
  categories: any[] = [];

  categoryChartData: { name: string; amount: number; percent: number }[] = [];
  monthlyChartData: { label: string; amount: number; percent: number }[] = [];
  topAccountsData: { name: string; amount: number; percent: number }[] = [];
  categoryPieData: { name: string; amount: number; percentage: number; color: string }[] = [];
  categoryPieGradient = '';
  accountPieData: { name: string; amount: number; percentage: number; color: string }[] = [];
  accountPieGradient = '';

  private pieColors = ['#3b82f6', '#8b5cf6', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#14b8a6', '#f97316', '#6366f1'];

  reportFrom = '';
  reportTo = '';
  reportGenerated = false;
  reportTransactions: any[] = [];
  hospitalName = '';
  reportGeneratedDate = '';

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
    this.hospitalName = sessionStorage.getItem('hospitalName') || 'Hospital';
    this.themeService.isDarkMode$.subscribe((isDark) => (this.isDarkMode = isDark));
    this.loadAll();
  }

  get totalExpenses(): number {
    return this.transactions.reduce((sum, t) => sum + this.toNumber(t.amountTransacted), 0);
  }

  get thisMonthExpenses(): number {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    return this.transactions
      .filter((t) => {
        const d = this.toDate(t.dateOfExpenseTransaction);
        return d != null && d.getMonth() === month && d.getFullYear() === year;
      })
      .reduce((sum, t) => sum + this.toNumber(t.amountTransacted), 0);
  }

  get averageExpense(): number {
    return this.transactions.length ? this.totalExpenses / this.transactions.length : 0;
  }

  loadAll(): void {
    this.isLoading = true;
    let pending = 3;
    const done = () => {
      if (--pending <= 0) {
        this.isLoading = false;
        this.computeCharts();
      }
    };

    this.api.getAllExpensesMade().subscribe({
      next: (res: any) => { this.transactions = Array.isArray(res) ? res : []; done(); },
      error: () => { this.transactions = []; done(); }
    });
    this.api.getExpenseAccountList().subscribe({
      next: (res: any) => { this.accounts = Array.isArray(res) ? res : []; done(); },
      error: () => { this.accounts = []; done(); }
    });
    this.api.getExpenseCategoryList().subscribe({
      next: (res: any) => { this.categories = Array.isArray(res) ? res : []; done(); },
      error: () => { this.categories = []; done(); }
    });
  }

  computeCharts(): void {
    this.computeCategoryChart();
    this.computeMonthlyChart();
    this.computeTopAccounts();
    this.computePieCharts();
  }

  private computeCategoryChart(): void {
    const accountCategoryMap = new Map<string, string>();
    for (const acc of this.accounts) {
      accountCategoryMap.set(String(acc.id), acc.expenseCategoryName || 'Uncategorized');
    }

    const categoryTotals = new Map<string, number>();
    for (const t of this.transactions) {
      const catName = accountCategoryMap.get(String(t.expenseAccountId)) || 'Uncategorized';
      categoryTotals.set(catName, (categoryTotals.get(catName) || 0) + this.toNumber(t.amountTransacted));
    }

    const sorted = [...categoryTotals.entries()].sort((a, b) => b[1] - a[1]);
    const max = sorted.length ? sorted[0][1] : 1;
    this.categoryChartData = sorted.map(([name, amount]) => ({
      name,
      amount,
      percent: max > 0 ? (amount / max) * 100 : 0
    }));
  }

  private computeMonthlyChart(): void {
    const now = new Date();
    const months: { key: string; label: string }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
      months.push({ key, label });
    }

    const monthTotals = new Map<string, number>();
    for (const m of months) monthTotals.set(m.key, 0);

    for (const t of this.transactions) {
      const d = this.toDate(t.dateOfExpenseTransaction);
      if (!d) continue;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (monthTotals.has(key)) {
        monthTotals.set(key, monthTotals.get(key)! + this.toNumber(t.amountTransacted));
      }
    }

    const max = Math.max(...monthTotals.values(), 1);
    this.monthlyChartData = months.map((m) => ({
      label: m.label,
      amount: monthTotals.get(m.key) || 0,
      percent: max > 0 ? ((monthTotals.get(m.key) || 0) / max) * 100 : 0
    }));
  }

  private computeTopAccounts(): void {
    const accountTotals = new Map<string, number>();
    for (const t of this.transactions) {
      const name = t.expenseAccountName || `Account #${t.expenseAccountId}`;
      accountTotals.set(name, (accountTotals.get(name) || 0) + this.toNumber(t.amountTransacted));
    }

    const sorted = [...accountTotals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
    const max = sorted.length ? sorted[0][1] : 1;
    this.topAccountsData = sorted.map(([name, amount]) => ({
      name,
      amount,
      percent: max > 0 ? (amount / max) * 100 : 0
    }));
  }

  private computePieCharts(): void {
    const total = this.totalExpenses || 1;

    // Category pie
    const catMap = new Map<string, number>();
    const accCatMap = new Map<string, string>();
    for (const acc of this.accounts) {
      accCatMap.set(String(acc.id), acc.expenseCategoryName || 'Uncategorized');
    }
    for (const t of this.transactions) {
      const cat = accCatMap.get(String(t.expenseAccountId)) || 'Uncategorized';
      catMap.set(cat, (catMap.get(cat) || 0) + this.toNumber(t.amountTransacted));
    }
    const catSorted = [...catMap.entries()].sort((a, b) => b[1] - a[1]);
    this.categoryPieData = catSorted.map(([name, amount], i) => ({
      name, amount,
      percentage: (amount / total) * 100,
      color: this.pieColors[i % this.pieColors.length]
    }));
    this.categoryPieGradient = this.buildConicGradient(this.categoryPieData);

    // Account pie (top 8 + Others)
    const accMap = new Map<string, number>();
    for (const t of this.transactions) {
      const name = t.expenseAccountName || `Account #${t.expenseAccountId}`;
      accMap.set(name, (accMap.get(name) || 0) + this.toNumber(t.amountTransacted));
    }
    let accSorted = [...accMap.entries()].sort((a, b) => b[1] - a[1]);
    if (accSorted.length > 8) {
      const top = accSorted.slice(0, 8);
      const othersTotal = accSorted.slice(8).reduce((s, e) => s + e[1], 0);
      top.push(['Others', othersTotal]);
      accSorted = top;
    }
    this.accountPieData = accSorted.map(([name, amount], i) => ({
      name, amount,
      percentage: (amount / total) * 100,
      color: this.pieColors[i % this.pieColors.length]
    }));
    this.accountPieGradient = this.buildConicGradient(this.accountPieData);
  }

  private buildConicGradient(data: { percentage: number; color: string }[]): string {
    if (!data.length) return 'conic-gradient(#e2e8f0 0% 100%)';
    const segments: string[] = [];
    let cumulative = 0;
    for (const d of data) {
      const start = cumulative;
      cumulative += d.percentage;
      segments.push(`${d.color} ${start.toFixed(2)}% ${cumulative.toFixed(2)}%`);
    }
    return `conic-gradient(${segments.join(', ')})`;
  }

  generateReport(): void {
    let filtered = [...this.transactions];
    if (this.reportFrom) {
      filtered = filtered.filter((t) => this.normalizeDate(t.dateOfExpenseTransaction) >= this.reportFrom);
    }
    if (this.reportTo) {
      filtered = filtered.filter((t) => this.normalizeDate(t.dateOfExpenseTransaction) <= this.reportTo);
    }
    filtered.sort((a, b) => this.normalizeDate(a.dateOfExpenseTransaction).localeCompare(this.normalizeDate(b.dateOfExpenseTransaction)));
    this.reportTransactions = filtered;
    this.reportGeneratedDate = new Date().toLocaleString();
    this.reportGenerated = true;
  }

  get reportTotal(): number {
    return this.reportTransactions.reduce((sum, t) => sum + this.toNumber(t.amountTransacted), 0);
  }

  getCategoryForTransaction(t: any): string {
    const acc = this.accounts.find((a) => String(a.id) === String(t.expenseAccountId));
    return acc?.expenseCategoryName || '\u2014';
  }

  exportCsv(): void {
    if (!this.reportTransactions.length) return;
    const headers = ['Date', 'Reference', 'Account', 'Category', 'Receiver', 'Amount', 'Description'];
    const rows = this.reportTransactions.map((t) => [
      this.formatDate(t.dateOfExpenseTransaction),
      t.referenceNumber || '',
      t.expenseAccountName || '',
      this.getCategoryForTransaction(t),
      t.receiver || '',
      this.toNumber(t.amountTransacted).toFixed(2),
      (t.description || '').replace(/"/g, '""')
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.map((c: string) => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `expense-report-${this.reportFrom || 'all'}-to-${this.reportTo || 'all'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  printReport(): void {
    window.print();
  }

  formatAmount(value: any): string {
    return this.toNumber(value).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }

  formatDate(value: any): string {
    if (!value) return '\u2014';
    const d = this.toDate(value);
    return d ? d.toLocaleDateString() : String(value);
  }

  private toNumber(value: any): number {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  private toDate(value: any): Date | null {
    if (!value) return null;
    const d = new Date(String(value).replace(/\//g, '-'));
    return Number.isNaN(d.getTime()) ? null : d;
  }

  private normalizeDate(value: any): string {
    const d = this.toDate(value);
    return d ? d.toISOString().slice(0, 10) : '';
  }
}
