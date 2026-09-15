import { Component, HostListener, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from '../../../../services/api.service';
import { ThemeService } from '../../../../services/theme.service';

@Component({
  selector: 'app-income-transactions',
  templateUrl: './income-transactions.component.html',
  styleUrls: ['./income-transactions.component.css']
})
export class IncomeTransactionsComponent implements OnInit {
  isDarkMode = false;
  isLoading = false;
  isSaving = false;
  responseMessage = '';
  responseError = '';
  searchQuery = '';
  accountFilter = '';
  dateFrom = '';
  dateTo = '';

  entries: any[] = [];
  accounts: any[] = [];
  categories: any[] = [];
  paymentMethods: any[] = [];
  sources: any[] = [];

  currentPage = 1;
  itemsPerPage = 10;

  showEntryModal = false;
  showDeleteConfirm = false;
  editingEntry: any = null;
  deleteTarget: any = null;

  entryForm = {
    incomeAccountId: null as number | null,
    amount: null as number | null,
    incomeDate: '',
    incomeSourceId: null as number | null,
    sourceName: '',
    incomePaymentMethodId: null as number | null,
    paymentMethod: '',
    referenceNumber: '',
    electronicReceipt: false,
    description: ''
  };

  accountDropdownOpen = false;
  accountSearch = '';
  sourceDropdownOpen = false;
  sourceSearch = '';
  paymentDropdownOpen = false;
  paymentSearch = '';

  showAddAccountModal = false;
  showAddCategoryModal = false;
  showAddSourceModal = false;
  showAddPaymentModal = false;

  quickAccountForm = { categoryId: null as number | null, accountName: '' };
  quickCategoryForm = { categoryName: '', description: '' };
  quickSourceForm = { sourceName: '', description: '' };
  quickPaymentForm = { methodName: '', description: '' };

  quickCategoryDropdownOpen = false;
  quickCategorySearch = '';

  private userId: number | null = null;

  constructor(
    private router: Router,
    private api: ApiService,
    private themeService: ThemeService
  ) {}

  @HostListener('document:click')
  onDocumentClick(): void {
    this.closeAllDropdowns();
  }

  ngOnInit(): void {
    if (!sessionStorage.getItem('username')) {
      this.router.navigate(['/login']);
      return;
    }
    this.resolveUserId();
    this.themeService.isDarkMode$.subscribe((isDark) => (this.isDarkMode = isDark));
    this.setDefaultDateRange();
    this.loadAll();
  }

  get filteredEntries(): any[] {
    const q = this.searchQuery.trim().toLowerCase();
    return this.entries.filter((item) => {
      const matchesSearch =
        !q ||
        (item.sourceName || '').toLowerCase().includes(q) ||
        (item.referenceCode || '').toLowerCase().includes(q) ||
        (item.referenceNumber || '').toLowerCase().includes(q) ||
        (item.description || '').toLowerCase().includes(q) ||
        (item.incomeAccountLabel || item.incomeAccountName || '').toLowerCase().includes(q);
      const matchesAccount =
        !this.accountFilter ||
        String(item.incomeAccountId || '') === this.accountFilter ||
        (item.incomeAccountType || '').toUpperCase() === this.accountFilter;
      const dateStr = this.normalizeDate(item.incomeDate);
      const matchesFrom = !this.dateFrom || !dateStr || dateStr >= this.dateFrom;
      const matchesTo = !this.dateTo || !dateStr || dateStr <= this.dateTo;
      return matchesSearch && matchesAccount && matchesFrom && matchesTo;
    });
  }

  get paginatedEntries(): any[] {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    return this.filteredEntries.slice(start, start + this.itemsPerPage);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredEntries.length / this.itemsPerPage));
  }

  get filteredAccountsForPicker(): any[] {
    const q = this.accountSearch.trim().toLowerCase();
    return this.accounts.filter(
      (a) =>
        !q ||
        (a.accountName || '').toLowerCase().includes(q) ||
        (a.incomeCategoryName || '').toLowerCase().includes(q)
    );
  }

  get filteredSourcesForPicker(): any[] {
    const q = this.sourceSearch.trim().toLowerCase();
    return this.sources.filter((s) => !q || (s.sourceName || '').toLowerCase().includes(q));
  }

  get filteredPaymentMethodsForPicker(): any[] {
    const q = this.paymentSearch.trim().toLowerCase();
    return this.paymentMethods.filter((m) => !q || (m.methodName || '').toLowerCase().includes(q));
  }

  get filteredQuickCategories(): any[] {
    const q = this.quickCategorySearch.trim().toLowerCase();
    return this.categories.filter((c) => !q || (c.categoryName || '').toLowerCase().includes(q));
  }

  get selectedAccountLabel(): string {
    const id = this.entryForm.incomeAccountId;
    if (id == null) return 'Choose income account';
    const acc = this.accounts.find((a) => Number(a.id) === Number(id));
    return acc ? `${acc.accountName} (${acc.incomeCategoryName || '—'})` : 'Choose income account';
  }

  get selectedSourceLabel(): string {
    const id = this.entryForm.incomeSourceId;
    if (id != null) {
      const s = this.sources.find((x) => Number(x.id) === Number(id));
      if (s) return s.sourceName;
    }
    return this.entryForm.sourceName || 'Choose source / payer';
  }

  get selectedPaymentLabel(): string {
    const id = this.entryForm.incomePaymentMethodId;
    if (id != null) {
      const m = this.paymentMethods.find((x) => Number(x.id) === Number(id));
      if (m) return m.methodName;
    }
    return this.entryForm.paymentMethod || 'Choose payment method';
  }

  get quickCategoryLabel(): string {
    const id = this.quickAccountForm.categoryId;
    if (id == null) return 'Select category';
    const cat = this.categories.find((c) => Number(c.id) === Number(id));
    return cat?.categoryName || 'Select category';
  }

  openCreateModal(): void {
    this.editingEntry = null;
    this.entryForm = {
      incomeAccountId: null,
      amount: null,
      incomeDate: this.todayInput(),
      incomeSourceId: null,
      sourceName: '',
      incomePaymentMethodId: this.paymentMethods[0]?.id ?? null,
      paymentMethod: this.paymentMethods[0]?.methodName || '',
      referenceNumber: '',
      electronicReceipt: false,
      description: ''
    };
    this.closeAllDropdowns();
    this.showEntryModal = true;
  }

  openEditModal(item: any): void {
    if (item?.readOnly) return;
    this.editingEntry = item;
    this.entryForm = {
      incomeAccountId: item.incomeAccountId ? Number(item.incomeAccountId) : null,
      amount: Number(item.amount) || null,
      incomeDate: this.toDateInput(item.incomeDate),
      incomeSourceId: item.incomeSourceId ? Number(item.incomeSourceId) : null,
      sourceName: item.sourceName || '',
      incomePaymentMethodId: item.incomePaymentMethodId ? Number(item.incomePaymentMethodId) : null,
      paymentMethod: item.paymentMethod || '',
      referenceNumber: item.referenceNumber || '',
      electronicReceipt: !!item.electronicReceipt,
      description: item.description || ''
    };
    this.closeAllDropdowns();
    this.showEntryModal = true;
  }

  confirmDelete(item: any): void {
    this.deleteTarget = item;
    this.showDeleteConfirm = true;
  }

  closeModals(): void {
    if (this.isSaving) return;
    this.showEntryModal = false;
    this.showDeleteConfirm = false;
    this.showAddAccountModal = false;
    this.showAddCategoryModal = false;
    this.showAddSourceModal = false;
    this.showAddPaymentModal = false;
    this.editingEntry = null;
    this.deleteTarget = null;
    this.closeAllDropdowns();
  }

  clearFilters(): void {
    this.searchQuery = '';
    this.accountFilter = '';
    this.setDefaultDateRange();
    this.currentPage = 1;
    this.loadAll();
  }

  prevPage(): void {
    if (this.currentPage > 1) this.currentPage--;
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) this.currentPage++;
  }

  loadAll(): void {
    this.isLoading = true;
    let pending = 5;
    const done = () => { if (--pending <= 0) this.isLoading = false; };
    const params = { dateFrom: this.dateFrom, dateTo: this.dateTo };

    this.api.getAllIncomeEntries(params).subscribe({
      next: (res: any) => { this.entries = Array.isArray(res) ? res : []; done(); },
      error: () => { this.entries = []; this.showError('Failed to load transactions'); done(); }
    });
    this.api.getIncomeAccountList().subscribe({
      next: (res: any) => { this.accounts = Array.isArray(res) ? res : []; done(); },
      error: () => { this.accounts = []; done(); }
    });
    this.api.getIncomeCategoryList().subscribe({
      next: (res: any) => { this.categories = Array.isArray(res) ? res : []; done(); },
      error: () => { this.categories = []; done(); }
    });
    this.api.getIncomePaymentMethodList().subscribe({
      next: (res: any) => { this.paymentMethods = Array.isArray(res) ? res : []; done(); },
      error: () => { this.paymentMethods = []; done(); }
    });
    this.api.getIncomeSourceList().subscribe({
      next: (res: any) => { this.sources = Array.isArray(res) ? res : []; done(); },
      error: () => { this.sources = []; done(); }
    });
  }

  saveEntry(): void {
    if (!this.entryForm.incomeAccountId) {
      this.showError('Select an income account.');
      return;
    }
    if (!this.entryForm.amount || this.entryForm.amount <= 0) {
      this.showError('Enter a valid amount.');
      return;
    }
    if (!this.userId) {
      this.showError('User session not found. Please log in again.');
      return;
    }
    if (this.entryForm.electronicReceipt && !this.entryForm.referenceNumber?.trim()) {
      this.showError('Enter the receipt reference for electronic payments.');
      return;
    }
    this.isSaving = true;
    const payload: any = {
      recordedByUserId: this.userId,
      incomeAccountId: this.entryForm.incomeAccountId,
      amount: Number(this.entryForm.amount),
      incomeDate: this.entryForm.incomeDate || this.todayInput(),
      incomeSourceId: this.entryForm.incomeSourceId,
      sourceName: this.entryForm.sourceName?.trim() || '',
      incomePaymentMethodId: this.entryForm.incomePaymentMethodId,
      paymentMethod: this.entryForm.paymentMethod,
      referenceNumber: this.entryForm.referenceNumber?.trim() || '',
      electronicReceipt: this.entryForm.electronicReceipt,
      description: this.entryForm.description?.trim() || ''
    };
    const request$ = this.editingEntry
      ? this.api.updateIncomeEntry(this.editingEntry.id, payload)
      : this.api.saveIncomeEntry(payload);
    request$.subscribe({
      next: (res: any) => {
        this.isSaving = false;
        this.showEntryModal = false;
        this.editingEntry = null;
        this.showSuccess(res?.message || 'Income saved');
        this.loadAll();
      },
      error: (err: any) => {
        this.isSaving = false;
        this.showError(err?.error?.message || err?.error?.error || 'Failed to save income');
      }
    });
  }

  deleteEntry(): void {
    if (!this.deleteTarget?.id) return;
    this.isSaving = true;
    this.api.deleteIncomeEntry(this.deleteTarget.id).subscribe({
      next: (res: any) => {
        this.isSaving = false;
        this.showDeleteConfirm = false;
        this.deleteTarget = null;
        this.showSuccess(res?.message || 'Deleted');
        this.loadAll();
      },
      error: (err: any) => {
        this.isSaving = false;
        this.showError(err?.error?.message || 'Failed to delete');
      }
    });
  }

  toggleAccountDropdown(event: Event): void {
    event.stopPropagation();
    this.sourceDropdownOpen = false;
    this.paymentDropdownOpen = false;
    this.accountDropdownOpen = !this.accountDropdownOpen;
  }

  toggleSourceDropdown(event: Event): void {
    event.stopPropagation();
    this.accountDropdownOpen = false;
    this.paymentDropdownOpen = false;
    this.sourceDropdownOpen = !this.sourceDropdownOpen;
  }

  togglePaymentDropdown(event: Event): void {
    event.stopPropagation();
    this.accountDropdownOpen = false;
    this.sourceDropdownOpen = false;
    this.paymentDropdownOpen = !this.paymentDropdownOpen;
  }

  selectAccount(acc: any, event?: Event): void {
    event?.stopPropagation();
    if (acc?.id != null) this.entryForm.incomeAccountId = Number(acc.id);
    this.accountDropdownOpen = false;
    this.accountSearch = '';
  }

  selectSource(src: any, event?: Event): void {
    event?.stopPropagation();
    if (src?.id != null) {
      this.entryForm.incomeSourceId = Number(src.id);
      this.entryForm.sourceName = src.sourceName || '';
    }
    this.sourceDropdownOpen = false;
    this.sourceSearch = '';
  }

  selectPayment(method: any, event?: Event): void {
    event?.stopPropagation();
    if (method?.id != null) {
      this.entryForm.incomePaymentMethodId = Number(method.id);
      this.entryForm.paymentMethod = method.methodName || '';
    }
    this.paymentDropdownOpen = false;
    this.paymentSearch = '';
  }

  openQuickAccount(event: Event): void {
    event.stopPropagation();
    this.accountDropdownOpen = false;
    if (this.categories.length === 0) {
      this.showError('Create at least one income category first.');
      return;
    }
    this.quickAccountForm = {
      categoryId: this.categories[0]?.id ?? null,
      accountName: this.accountSearch.trim()
    };
    this.showAddAccountModal = true;
  }

  openQuickCategory(event: Event): void {
    event.stopPropagation();
    this.quickCategoryDropdownOpen = false;
    this.quickCategoryForm = { categoryName: this.quickCategorySearch.trim(), description: '' };
    this.showAddCategoryModal = true;
  }

  openQuickSource(event: Event): void {
    event.stopPropagation();
    this.sourceDropdownOpen = false;
    this.quickSourceForm = { sourceName: this.sourceSearch.trim(), description: '' };
    this.showAddSourceModal = true;
  }

  openQuickPayment(event: Event): void {
    event.stopPropagation();
    this.paymentDropdownOpen = false;
    this.quickPaymentForm = { methodName: this.paymentSearch.trim(), description: '' };
    this.showAddPaymentModal = true;
  }

  toggleQuickCategoryDropdown(event: Event): void {
    event.stopPropagation();
    this.quickCategoryDropdownOpen = !this.quickCategoryDropdownOpen;
  }

  selectQuickCategory(cat: any, event?: Event): void {
    event?.stopPropagation();
    if (cat?.id != null) this.quickAccountForm.categoryId = Number(cat.id);
    this.quickCategoryDropdownOpen = false;
    this.quickCategorySearch = '';
  }

  saveQuickAccount(): void {
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
    this.api.saveIncomeAccount({ categoryId, accountName: name, description: '' }).subscribe({
      next: () => {
        this.api.getIncomeAccountList().subscribe({
          next: (list: any) => {
            this.accounts = Array.isArray(list) ? list : [];
            const created =
              this.accounts.find(
                (a) => Number(a.categoryId) === Number(categoryId) && (a.accountName || '').toLowerCase() === name.toLowerCase()
              ) ?? this.accounts[this.accounts.length - 1];
            if (created?.id != null) this.entryForm.incomeAccountId = Number(created.id);
            this.isSaving = false;
            this.showAddAccountModal = false;
            this.showSuccess('Account created and selected');
          },
          error: () => { this.isSaving = false; this.loadAll(); }
        });
      },
      error: (err: any) => {
        this.isSaving = false;
        this.showError(err?.error?.message || 'Failed to create account');
      }
    });
  }

  saveQuickCategory(): void {
    if (!this.quickCategoryForm.categoryName?.trim()) {
      this.showError('Category name is required.');
      return;
    }
    this.isSaving = true;
    this.api.createIncomeCategory({
      categoryName: this.quickCategoryForm.categoryName.trim(),
      description: this.quickCategoryForm.description?.trim() || ''
    }).subscribe({
      next: () => {
        this.api.getIncomeCategoryList().subscribe({
          next: (list: any) => {
            this.categories = Array.isArray(list) ? list : [];
            const name = this.quickCategoryForm.categoryName.trim().toLowerCase();
            const created = this.categories.find((c) => (c.categoryName || '').toLowerCase() === name) ?? this.categories[0];
            if (created?.id != null) this.quickAccountForm.categoryId = Number(created.id);
            this.isSaving = false;
            this.showAddCategoryModal = false;
            this.showSuccess('Category created');
          },
          error: () => { this.isSaving = false; }
        });
      },
      error: (err: any) => {
        this.isSaving = false;
        this.showError(err?.error?.message || 'Failed to create category');
      }
    });
  }

  saveQuickSource(): void {
    if (!this.quickSourceForm.sourceName?.trim()) {
      this.showError('Source name is required.');
      return;
    }
    const name = this.quickSourceForm.sourceName.trim();
    this.isSaving = true;
    this.api.createIncomeSource({ sourceName: name, description: '' }).subscribe({
      next: () => {
        this.api.getIncomeSourceList().subscribe({
          next: (list: any) => {
            this.sources = Array.isArray(list) ? list : [];
            const created = this.sources.find((s) => (s.sourceName || '').toLowerCase() === name.toLowerCase()) ?? this.sources[0];
            if (created?.id != null) {
              this.entryForm.incomeSourceId = Number(created.id);
              this.entryForm.sourceName = created.sourceName;
            }
            this.isSaving = false;
            this.showAddSourceModal = false;
            this.showSuccess('Source created and selected');
          },
          error: () => { this.isSaving = false; }
        });
      },
      error: (err: any) => {
        this.isSaving = false;
        this.showError(err?.error?.message || 'Failed to create source');
      }
    });
  }

  saveQuickPayment(): void {
    if (!this.quickPaymentForm.methodName?.trim()) {
      this.showError('Payment method name is required.');
      return;
    }
    const name = this.quickPaymentForm.methodName.trim();
    this.isSaving = true;
    this.api.createIncomePaymentMethod({ methodName: name, description: '' }).subscribe({
      next: () => {
        this.api.getIncomePaymentMethodList().subscribe({
          next: (list: any) => {
            this.paymentMethods = Array.isArray(list) ? list : [];
            const created = this.paymentMethods.find((m) => (m.methodName || '').toLowerCase() === name.toLowerCase()) ?? this.paymentMethods[0];
            if (created?.id != null) {
              this.entryForm.incomePaymentMethodId = Number(created.id);
              this.entryForm.paymentMethod = created.methodName;
            }
            this.isSaving = false;
            this.showAddPaymentModal = false;
            this.showSuccess('Payment method created and selected');
          },
          error: () => { this.isSaving = false; }
        });
      },
      error: (err: any) => {
        this.isSaving = false;
        this.showError(err?.error?.message || 'Failed to create payment method');
      }
    });
  }

  formatAmount(value: any): string {
    const n = Number(value);
    return Number.isFinite(n) ? n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : '0';
  }

  formatDate(value: any): string {
    if (!value) return '—';
    const d = new Date(String(value).replace(/\//g, '-'));
    return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString();
  }

  private closeAllDropdowns(): void {
    this.accountDropdownOpen = false;
    this.sourceDropdownOpen = false;
    this.paymentDropdownOpen = false;
    this.accountSearch = '';
    this.sourceSearch = '';
    this.paymentSearch = '';
    this.quickCategoryDropdownOpen = false;
    this.quickCategorySearch = '';
  }

  private resolveUserId(): void {
    try {
      const details = JSON.parse(sessionStorage.getItem('userDetails') || '{}');
      const fromDetails = Number(details?.id);
      if (Number.isFinite(fromDetails) && fromDetails > 0) this.userId = fromDetails;
    } catch { /* ignore */ }
    if (this.userId == null) {
      const raw = sessionStorage.getItem('userid') || sessionStorage.getItem('userId');
      const parsed = raw ? Number(raw) : NaN;
      this.userId = Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    }
  }

  private setDefaultDateRange(): void {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    this.dateFrom = this.toInputDate(start);
    this.dateTo = this.toInputDate(now);
  }

  private todayInput(): string {
    return this.toInputDate(new Date());
  }

  private toInputDate(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  private toDateInput(value: any): string {
    if (!value) return this.todayInput();
    const text = String(value).replace(/\//g, '-');
    const d = new Date(text);
    return Number.isNaN(d.getTime()) ? this.todayInput() : this.toInputDate(d);
  }

  private normalizeDate(value: any): string {
    if (!value) return '';
    const text = String(value).replace(/\//g, '-');
    const d = new Date(text);
    return Number.isNaN(d.getTime()) ? '' : this.toInputDate(d);
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
