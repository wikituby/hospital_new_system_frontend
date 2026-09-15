import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from '../../../../services/api.service';
import { ThemeService } from '../../../../services/theme.service';

@Component({
  selector: 'app-expense-accounts',
  templateUrl: './expense-accounts.component.html',
  styleUrls: ['./expense-accounts.component.css']
})
export class ExpenseAccountsComponent implements OnInit {
  isDarkMode = false;
  isLoading = false;
  isSaving = false;
  showCreateModal = false;
  showDeleteConfirm = false;
  deleteTarget: any = null;
  editingAccount: any = null;
  responseMessage = '';
  responseError = '';
  searchQuery = '';
  accounts: any[] = [];
  categories: any[] = [];

  accountForm = {
    categoryId: null as number | null,
    accountName: '',
    description: '',
    accountLimit: null as number | null,
    limitPeriod: 'MONTHLY' as string
  };

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
    this.loadAll();
  }

  get filteredAccounts(): any[] {
    const q = this.searchQuery.trim().toLowerCase();
    return this.accounts.filter(
      (item) =>
        !q ||
        (item.accountName || '').toLowerCase().includes(q) ||
        (item.expenseCategoryName || '').toLowerCase().includes(q) ||
        (item.description || '').toLowerCase().includes(q)
    );
  }

  openCreateModal(): void {
    if (this.categories.length === 0) {
      this.showError('Create at least one expense category first.');
      return;
    }
    this.editingAccount = null;
    this.accountForm = {
      categoryId: this.categories[0]?.id ?? null,
      accountName: '',
      description: '',
      accountLimit: null,
      limitPeriod: 'MONTHLY'
    };
    this.showCreateModal = true;
  }

  openEditModal(item: any): void {
    this.editingAccount = item;
    this.accountForm = {
      categoryId: item.categoryId ?? item.expenseCategoryId ?? null,
      accountName: item.accountName || '',
      description: item.description || '',
      accountLimit: item.accountLimit ?? null,
      limitPeriod: item.limitPeriod || 'MONTHLY'
    };
    this.showCreateModal = true;
  }

  closeModal(): void {
    if (this.isSaving) return;
    this.showCreateModal = false;
    this.editingAccount = null;
  }

  loadAll(): void {
    this.isLoading = true;
    let pending = 2;
    const done = () => { if (--pending <= 0) this.isLoading = false; };

    this.api.getExpenseAccountList().subscribe({
      next: (res: any) => { this.accounts = Array.isArray(res) ? res : []; done(); },
      error: () => { this.accounts = []; this.showError('Failed to load accounts'); done(); }
    });

    this.api.getExpenseCategoryList().subscribe({
      next: (res: any) => { this.categories = Array.isArray(res) ? res : []; done(); },
      error: () => { this.categories = []; done(); }
    });
  }

  saveAccount(): void {
    if (!this.accountForm.categoryId) {
      this.showError('Select a category.');
      return;
    }
    if (!this.accountForm.accountName?.trim()) {
      this.showError('Account name is required.');
      return;
    }
    this.isSaving = true;
    const payload: any = {
      categoryId: this.accountForm.categoryId,
      accountName: this.accountForm.accountName.trim(),
      description: this.accountForm.description?.trim() || '',
      accountLimit: this.accountForm.accountLimit ? Number(this.accountForm.accountLimit) : null,
      limitPeriod: this.accountForm.accountLimit ? this.accountForm.limitPeriod : null
    };

    const request$ = this.editingAccount
      ? this.api.updateExpenseAccount(this.editingAccount.id, payload)
      : this.api.saveExpenseAccount(payload);

    request$.subscribe({
      next: (res: any) => {
        this.isSaving = false;
        this.showCreateModal = false;
        this.editingAccount = null;
        this.showSuccess(res?.message || (this.editingAccount ? 'Account updated' : 'Account created'));
        this.loadAll();
      },
      error: (err: any) => {
        this.isSaving = false;
        this.showError(err?.error?.message || 'Failed to save account');
      }
    });
  }

  confirmDelete(item: any): void {
    this.deleteTarget = item;
    this.showDeleteConfirm = true;
  }

  closeDeleteModal(): void {
    if (this.isSaving) return;
    this.showDeleteConfirm = false;
    this.deleteTarget = null;
  }

  deleteAccount(): void {
    if (!this.deleteTarget?.id) return;
    this.isSaving = true;
    this.api.deleteExpenseAccount(this.deleteTarget.id).subscribe({
      next: (res: any) => {
        this.isSaving = false;
        this.showDeleteConfirm = false;
        this.deleteTarget = null;
        this.showSuccess(res?.message || 'Account deleted');
        this.loadAll();
      },
      error: (err: any) => {
        this.isSaving = false;
        this.showError(err?.error?.message || 'Failed to delete account');
      }
    });
  }

  formatAmount(value: any): string {
    const n = Number(value);
    return Number.isFinite(n) ? n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : '—';
  }

  formatDate(value: any): string {
    if (!value) return '\u2014';
    const d = new Date(String(value).replace(/\//g, '-'));
    return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString();
  }

  private showSuccess(msg: string): void {
    this.responseMessage = msg;
    this.responseError = '';
    setTimeout(() => (this.responseMessage = ''), 5000);
  }

  private showError(msg: string): void {
    this.responseError = msg;
    this.responseMessage = '';
    setTimeout(() => (this.responseError = ''), 6000);
  }
}
