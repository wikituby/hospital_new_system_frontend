import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from '../../../../services/api.service';
import { ThemeService } from '../../../../services/theme.service';

@Component({
  selector: 'app-income-accounts',
  templateUrl: './income-accounts.component.html',
  styleUrls: ['./income-accounts.component.css']
})
export class IncomeAccountsComponent implements OnInit {
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
    description: ''
  };

  categoryDropdownOpen = false;
  categorySearch = '';

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
        (item.incomeCategoryName || '').toLowerCase().includes(q) ||
        (item.description || '').toLowerCase().includes(q)
    );
  }

  get filteredCategoriesForPicker(): any[] {
    const q = this.categorySearch.trim().toLowerCase();
    return this.categories.filter(
      (c) => !q || (c.categoryName || '').toLowerCase().includes(q)
    );
  }

  get selectedCategoryLabel(): string {
    const id = this.accountForm.categoryId;
    if (id == null) return 'Select category';
    const cat = this.categories.find((c) => Number(c.id) === Number(id));
    return cat?.categoryName || 'Select category';
  }

  openCreateModal(): void {
    if (this.categories.length === 0) {
      this.showError('Create at least one income category first.');
      return;
    }
    this.editingAccount = null;
    this.accountForm = {
      categoryId: this.categories[0]?.id ?? null,
      accountName: '',
      description: ''
    };
    this.showCreateModal = true;
  }

  openEditModal(item: any): void {
    this.editingAccount = item;
    this.accountForm = {
      categoryId: item.categoryId ?? null,
      accountName: item.accountName || '',
      description: item.description || ''
    };
    this.showCreateModal = true;
  }

  closeModal(): void {
    if (this.isSaving) return;
    this.showCreateModal = false;
    this.editingAccount = null;
    this.categoryDropdownOpen = false;
    this.categorySearch = '';
  }

  toggleCategoryDropdown(event: Event): void {
    event.stopPropagation();
    this.categoryDropdownOpen = !this.categoryDropdownOpen;
  }

  selectCategory(cat: any, event?: Event): void {
    event?.stopPropagation();
    if (cat?.id != null) this.accountForm.categoryId = Number(cat.id);
    this.categoryDropdownOpen = false;
    this.categorySearch = '';
  }

  loadAll(): void {
    this.isLoading = true;
    let pending = 2;
    const done = () => { if (--pending <= 0) this.isLoading = false; };

    this.api.getIncomeAccountList().subscribe({
      next: (res: any) => { this.accounts = Array.isArray(res) ? res : []; done(); },
      error: () => { this.accounts = []; this.showError('Failed to load accounts'); done(); }
    });

    this.api.getIncomeCategoryList().subscribe({
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
    const payload = {
      categoryId: this.accountForm.categoryId,
      accountName: this.accountForm.accountName.trim(),
      description: this.accountForm.description?.trim() || ''
    };
    const request$ = this.editingAccount
      ? this.api.updateIncomeAccount(this.editingAccount.id, payload)
      : this.api.saveIncomeAccount(payload);
    request$.subscribe({
      next: (res: any) => {
        this.isSaving = false;
        this.showCreateModal = false;
        this.editingAccount = null;
        this.showSuccess(res?.message || 'Account saved');
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
    this.api.deleteIncomeAccount(this.deleteTarget.id).subscribe({
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
    return Number.isFinite(n) ? n.toLocaleString() : '0';
  }

  formatDate(value: any): string {
    if (!value) return '—';
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
