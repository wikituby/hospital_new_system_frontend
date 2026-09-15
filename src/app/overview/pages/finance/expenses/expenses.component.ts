import { Component, HostListener, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from '../../../../services/api.service';
import { ThemeService } from '../../../../services/theme.service';

type ExpenseTab = 'transactions' | 'categories' | 'accounts';

@Component({
  selector: 'app-expenses',
  templateUrl: './expenses.component.html',
  styleUrls: ['./expenses.component.css']
})
export class ExpensesComponent implements OnInit {
  isDarkMode = false;
  isLoading = false;
  isSaving = false;
  responseMessage = '';
  responseError = '';

  activeTab: ExpenseTab = 'transactions';
  searchQuery = '';
  accountFilter = '';
  dateFilter = '';

  transactions: any[] = [];
  categories: any[] = [];
  accounts: any[] = [];

  currentPage = 1;
  itemsPerPage = 10;

  showTransactionModal = false;
  showCategoryModal = false;
  showAccountModal = false;
  showDeleteConfirm = false;
  deleteTarget: any = null;

  transactionForm = {
    expenseAccountId: null as number | null,
    amountTransacted: null as number | null,
    receiver: '',
    description: ''
  };

  categoryForm = {
    categoryName: '',
    description: ''
  };

  accountForm = {
    categoryId: null as number | null,
    accountName: '',
    description: ''
  };

  expenseAccountDropdownOpen = false;
  expenseAccountSearch = '';
  showQuickAccountInPicker = false;
  quickAccountForm = {
    categoryId: null as number | null,
    accountName: ''
  };

  private userId: number | null = null;

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

    const rawUserId = sessionStorage.getItem('userid') || sessionStorage.getItem('userId');
    this.userId = rawUserId ? Number(rawUserId) : null;

    this.themeService.isDarkMode$.subscribe(isDark => {
      this.isDarkMode = isDark;
    });

    this.loadAll();
  }

  get thisMonthTotal(): number {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    return this.transactions
      .filter(t => this.isSameMonth(t.dateOfExpenseTransaction, month, year))
      .reduce((sum, t) => sum + this.toNumber(t.amountTransacted), 0);
  }

  get totalTransactions(): number {
    return this.transactions.length;
  }

  get filteredTransactions(): any[] {
    const q = this.searchQuery.trim().toLowerCase();
    return this.transactions.filter(item => {
      const matchesSearch = !q || [
        item.referenceNumber,
        item.expenseAccountName,
        item.receiver,
        item.userName,
        item.description
      ].some(v => (v || '').toString().toLowerCase().includes(q));

      const matchesAccount = !this.accountFilter || String(item.expenseAccountId) === this.accountFilter;

      const matchesDate = !this.dateFilter || this.normalizeDate(item.dateOfExpenseTransaction) === this.dateFilter;

      return matchesSearch && matchesAccount && matchesDate;
    });
  }

  get filteredCategories(): any[] {
    const q = this.searchQuery.trim().toLowerCase();
    return this.categories.filter(item =>
      !q ||
      (item.categoryName || '').toLowerCase().includes(q) ||
      (item.description || '').toLowerCase().includes(q)
    );
  }

  get filteredAccounts(): any[] {
    const q = this.searchQuery.trim().toLowerCase();
    return this.accounts.filter(item =>
      !q ||
      (item.accountName || '').toLowerCase().includes(q) ||
      (item.expenseCategoryName || '').toLowerCase().includes(q) ||
      (item.description || '').toLowerCase().includes(q)
    );
  }

  get filteredAccountsForPicker(): any[] {
    const q = this.expenseAccountSearch.trim().toLowerCase();
    return this.accounts.filter(item =>
      !q ||
      (item.accountName || '').toLowerCase().includes(q) ||
      (item.expenseCategoryName || '').toLowerCase().includes(q)
    );
  }

  get selectedExpenseAccountLabel(): string {
    const id = this.transactionForm.expenseAccountId;
    if (id == null) {
      return 'Choose expense account';
    }
    const acc = this.accounts.find(a => Number(a.id) === Number(id));
    if (!acc) {
      return 'Choose expense account';
    }
    const cat = acc.expenseCategoryName ? ` (${acc.expenseCategoryName})` : '';
    return `${acc.accountName}${cat}`;
  }

  get paginatedTransactions(): any[] {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    return this.filteredTransactions.slice(start, start + this.itemsPerPage);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredTransactions.length / this.itemsPerPage));
  }

  setTab(tab: ExpenseTab): void {
    this.activeTab = tab;
    this.searchQuery = '';
    this.accountFilter = '';
    this.dateFilter = '';
    this.currentPage = 1;
  }

  loadAll(): void {
    this.isLoading = true;
    let pending = 3;

    const done = () => {
      pending--;
      if (pending <= 0) {
        this.isLoading = false;
      }
    };

    this.api.getAllExpensesMade().subscribe({
      next: (res: any) => {
        this.transactions = Array.isArray(res) ? res : [];
        done();
      },
      error: () => {
        this.transactions = [];
        this.showError('Failed to load expense transactions');
        done();
      }
    });

    this.api.getExpenseCategoryList().subscribe({
      next: (res: any) => {
        this.categories = Array.isArray(res) ? res : [];
        done();
      },
      error: () => {
        this.categories = [];
        this.showError('Failed to load expense categories');
        done();
      }
    });

    this.api.getExpenseAccountList().subscribe({
      next: (res: any) => {
        this.accounts = Array.isArray(res) ? res : [];
        done();
      },
      error: () => {
        this.accounts = [];
        this.showError('Failed to load expense accounts');
        done();
      }
    });
  }

  openTransactionModal(): void {
    this.transactionForm = {
      expenseAccountId: null,
      amountTransacted: null,
      receiver: '',
      description: ''
    };
    this.resetExpenseAccountPicker();
    this.showTransactionModal = true;
  }

  toggleExpenseAccountDropdown(event: Event): void {
    event.stopPropagation();
    this.expenseAccountDropdownOpen = !this.expenseAccountDropdownOpen;
    if (!this.expenseAccountDropdownOpen) {
      this.showQuickAccountInPicker = false;
    }
  }

  closeExpenseAccountDropdown(): void {
    this.expenseAccountDropdownOpen = false;
    this.showQuickAccountInPicker = false;
    this.expenseAccountSearch = '';
  }

  resetExpenseAccountPicker(): void {
    this.closeExpenseAccountDropdown();
  }

  selectExpenseAccount(acc: any, event?: Event): void {
    event?.stopPropagation();
    if (acc?.id != null) {
      this.transactionForm.expenseAccountId = Number(acc.id);
    }
    this.closeExpenseAccountDropdown();
  }

  openQuickAccountInPicker(event: Event): void {
    event.stopPropagation();
    if (this.categories.length === 0) {
      this.showError('Create at least one expense category first (Categories tab).');
      return;
    }
    this.showQuickAccountInPicker = true;
    this.quickAccountForm = {
      categoryId: this.categories[0]?.id ?? null,
      accountName: this.expenseAccountSearch.trim()
    };
  }

  cancelQuickAccountInPicker(event: Event): void {
    event.stopPropagation();
    this.showQuickAccountInPicker = false;
  }

  saveQuickAccountFromPicker(event: Event): void {
    event.stopPropagation();
    if (!this.quickAccountForm.categoryId) {
      this.showError('Select a category.');
      return;
    }
    if (!this.quickAccountForm.accountName?.trim()) {
      this.showError('Account name is required.');
      return;
    }

    const name = this.quickAccountForm.accountName.trim();
    const categoryId = this.quickAccountForm.categoryId;
    this.isSaving = true;

    this.api.saveExpenseAccount({
      categoryId,
      accountName: name,
      description: ''
    }).subscribe({
      next: (res: any) => {
        this.api.getExpenseAccountList().subscribe({
          next: (list: any) => {
            this.isSaving = false;
            this.accounts = Array.isArray(list) ? list : [];
            const created =
              this.accounts.find(
                a =>
                  Number(a.categoryId) === Number(categoryId) &&
                  (a.accountName || '').toLowerCase() === name.toLowerCase()
              ) ?? this.accounts[this.accounts.length - 1];
            if (created?.id != null) {
              this.transactionForm.expenseAccountId = Number(created.id);
            }
            this.showQuickAccountInPicker = false;
            this.expenseAccountSearch = '';
            this.showSuccess(res?.message || 'Account created — selected for this expense');
          },
          error: () => {
            this.isSaving = false;
            this.showError('Account saved but list could not be refreshed.');
            this.loadAll();
          }
        });
      },
      error: (err: any) => {
        this.isSaving = false;
        this.showError(err?.error?.message || 'Failed to create account');
      }
    });
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    if (this.expenseAccountDropdownOpen) {
      this.closeExpenseAccountDropdown();
    }
  }

  openCategoryModal(): void {
    this.categoryForm = { categoryName: '', description: '' };
    this.showCategoryModal = true;
  }

  openAccountModal(): void {
    if (this.categories.length === 0) {
      this.showError('Create at least one expense category before adding an account.');
      return;
    }
    this.accountForm = {
      categoryId: this.categories[0]?.id ?? null,
      accountName: '',
      description: ''
    };
    this.showAccountModal = true;
  }

  closeModals(): void {
    if (this.isSaving) {
      return;
    }
    this.showTransactionModal = false;
    this.showCategoryModal = false;
    this.showAccountModal = false;
    this.showDeleteConfirm = false;
    this.deleteTarget = null;
    this.resetExpenseAccountPicker();
  }

  saveTransaction(): void {
    if (!this.transactionForm.expenseAccountId) {
      this.showError('Select an expense account.');
      return;
    }
    if (!this.transactionForm.amountTransacted || this.transactionForm.amountTransacted <= 0) {
      this.showError('Enter a valid expense amount.');
      return;
    }
    if (!this.userId) {
      this.showError('User session not found. Please log in again.');
      return;
    }

    this.isSaving = true;
    const payload = {
      userId: this.userId,
      expenseAccountId: this.transactionForm.expenseAccountId,
      amountTransacted: Number(this.transactionForm.amountTransacted),
      receiver: this.transactionForm.receiver?.trim() || '',
      description: this.transactionForm.description?.trim() || 'Expense recorded'
    };

    this.api.saveExpense(payload).subscribe({
      next: (res: any) => {
        this.isSaving = false;
        this.showTransactionModal = false;
        this.showSuccess(res?.message || 'Expense recorded successfully');
        this.loadAll();
      },
      error: (err: any) => {
        this.isSaving = false;
        this.showError(err?.error?.message || 'Failed to save expense');
      }
    });
  }

  saveCategory(): void {
    if (!this.categoryForm.categoryName?.trim()) {
      this.showError('Category name is required.');
      return;
    }

    this.isSaving = true;
    this.api.createExpenseCategory({
      categoryName: this.categoryForm.categoryName.trim(),
      description: this.categoryForm.description?.trim() || ''
    }).subscribe({
      next: (res: any) => {
        this.isSaving = false;
        this.showCategoryModal = false;
        this.showSuccess(res?.message || 'Category created successfully');
        this.loadAll();
      },
      error: (err: any) => {
        this.isSaving = false;
        this.showError(err?.error?.message || 'Failed to create category');
      }
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
    this.api.saveExpenseAccount({
      categoryId: this.accountForm.categoryId,
      accountName: this.accountForm.accountName.trim(),
      description: this.accountForm.description?.trim() || ''
    }).subscribe({
      next: (res: any) => {
        this.isSaving = false;
        this.showAccountModal = false;
        this.showSuccess(res?.message || 'Account created successfully');
        this.loadAll();
      },
      error: (err: any) => {
        this.isSaving = false;
        this.showError(err?.error?.message || 'Failed to create account');
      }
    });
  }

  confirmDelete(item: any): void {
    this.deleteTarget = item;
    this.showDeleteConfirm = true;
  }

  deleteTransaction(): void {
    if (!this.deleteTarget?.id) {
      return;
    }

    this.isSaving = true;
    this.api.deleteExpense(this.deleteTarget.id).subscribe({
      next: (res: any) => {
        this.isSaving = false;
        this.showDeleteConfirm = false;
        this.deleteTarget = null;
        this.showSuccess(res?.message || 'Expense deleted');
        this.loadAll();
      },
      error: (err: any) => {
        this.isSaving = false;
        this.showError(err?.error?.message || 'Failed to delete expense');
      }
    });
  }

  prevPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
    }
  }

  formatAmount(value: any): string {
    const num = this.toNumber(value);
    return num.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }

  formatDate(value: any): string {
    if (!value) {
      return '—';
    }
    const normalized = this.normalizeDate(value);
    if (!normalized) {
      return String(value);
    }
    const d = new Date(normalized);
    return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString();
  }

  private toNumber(value: any): number {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
  }

  private normalizeDate(value: any): string {
    if (!value) {
      return '';
    }
    const raw = String(value).replace(/\//g, '-');
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      return raw;
    }
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) {
      return '';
    }
    return d.toISOString().slice(0, 10);
  }

  private isSameMonth(value: any, month: number, year: number): boolean {
    const normalized = this.normalizeDate(value);
    if (!normalized) {
      return false;
    }
    const d = new Date(normalized);
    return d.getMonth() === month && d.getFullYear() === year;
  }

  private showSuccess(message: string): void {
    this.responseMessage = message;
    this.responseError = '';
    setTimeout(() => { this.responseMessage = ''; }, 5000);
  }

  private showError(message: string): void {
    this.responseError = message;
    this.responseMessage = '';
    setTimeout(() => { this.responseError = ''; }, 6000);
  }
}
