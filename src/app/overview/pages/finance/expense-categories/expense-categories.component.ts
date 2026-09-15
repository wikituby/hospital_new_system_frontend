import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from '../../../../services/api.service';
import { ThemeService } from '../../../../services/theme.service';

@Component({
  selector: 'app-expense-categories',
  templateUrl: './expense-categories.component.html',
  styleUrls: ['./expense-categories.component.css']
})
export class ExpenseCategoriesComponent implements OnInit {
  isDarkMode = false;
  isLoading = false;
  isSaving = false;
  showCreateModal = false;
  showDeleteConfirm = false;
  deleteTarget: any = null;
  editingCategory: any = null;
  responseMessage = '';
  responseError = '';
  searchQuery = '';
  categories: any[] = [];

  categoryForm = { categoryName: '', description: '' };

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
    this.loadCategories();
  }

  get filteredCategories(): any[] {
    const q = this.searchQuery.trim().toLowerCase();
    return this.categories.filter(
      (item) =>
        !q ||
        (item.categoryName || '').toLowerCase().includes(q) ||
        (item.description || '').toLowerCase().includes(q)
    );
  }

  openCreateModal(): void {
    this.editingCategory = null;
    this.categoryForm = { categoryName: '', description: '' };
    this.showCreateModal = true;
  }

  openEditModal(item: any): void {
    this.editingCategory = item;
    this.categoryForm = {
      categoryName: item.categoryName || '',
      description: item.description || ''
    };
    this.showCreateModal = true;
  }

  closeModal(): void {
    if (this.isSaving) return;
    this.showCreateModal = false;
    this.editingCategory = null;
  }

  loadCategories(): void {
    this.isLoading = true;
    this.api.getExpenseCategoryList().subscribe({
      next: (res: any) => {
        this.categories = Array.isArray(res) ? res : [];
        this.isLoading = false;
      },
      error: () => {
        this.categories = [];
        this.isLoading = false;
        this.showError('Failed to load expense categories');
      }
    });
  }

  saveCategory(): void {
    if (!this.categoryForm.categoryName?.trim()) {
      this.showError('Category name is required.');
      return;
    }
    this.isSaving = true;
    const payload = {
      categoryName: this.categoryForm.categoryName.trim(),
      description: this.categoryForm.description?.trim() || ''
    };

    const request$ = this.editingCategory
      ? this.api.updateExpenseCategory(this.editingCategory.id, payload)
      : this.api.createExpenseCategory(payload);

    request$.subscribe({
      next: (res: any) => {
        this.isSaving = false;
        this.showCreateModal = false;
        this.editingCategory = null;
        this.showSuccess(res?.message || (this.editingCategory ? 'Category updated' : 'Category created'));
        this.loadCategories();
      },
      error: (err: any) => {
        this.isSaving = false;
        this.showError(err?.error?.message || 'Failed to save category');
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

  deleteCategory(): void {
    if (!this.deleteTarget?.id) return;
    this.isSaving = true;
    this.api.deleteExpenseCategory(this.deleteTarget.id).subscribe({
      next: (res: any) => {
        this.isSaving = false;
        this.showDeleteConfirm = false;
        this.deleteTarget = null;
        this.showSuccess(res?.message || 'Category deleted');
        this.loadCategories();
      },
      error: (err: any) => {
        this.isSaving = false;
        this.showError(err?.error?.message || 'Failed to delete category');
      }
    });
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
