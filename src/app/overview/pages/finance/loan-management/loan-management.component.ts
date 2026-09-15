import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from '../../../../services/api.service';
import { ThemeService } from '../../../../services/theme.service';

@Component({
  selector: 'app-loan-management',
  templateUrl: './loan-management.component.html',
  styleUrls: ['./loan-management.component.css']
})
export class LoanManagementComponent implements OnInit {
  isDarkMode = false;
  isLoading = false;
  isSaving = false;
  showLoanModal = false;
  showRepaymentModal = false;
  showDeleteConfirm = false;
  editingLoan: any = null;
  repaymentTarget: any = null;
  deleteTarget: any = null;
  responseMessage = '';
  responseError = '';
  searchQuery = '';
  statusFilter = '';
  loans: any[] = [];

  readonly borrowerTypes = ['STAFF', 'PATIENT', 'OTHER'];

  loanForm = {
    borrowerName: '',
    borrowerContact: '',
    borrowerType: 'STAFF',
    principalAmount: null as number | null,
    loanDate: '',
    dueDate: '',
    description: ''
  };

  repaymentForm = {
    repaymentAmount: null as number | null,
    note: ''
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
    try {
      const details = JSON.parse(sessionStorage.getItem('userDetails') || '{}');
      const fromDetails = Number(details?.id);
      if (Number.isFinite(fromDetails) && fromDetails > 0) {
        this.userId = fromDetails;
      }
    } catch {
      /* ignore */
    }
    if (this.userId == null) {
      const raw = sessionStorage.getItem('userid') || sessionStorage.getItem('userId');
      const parsed = raw ? Number(raw) : NaN;
      this.userId = Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    }
    this.themeService.isDarkMode$.subscribe((isDark) => (this.isDarkMode = isDark));
    this.loadLoans();
  }

  get filteredLoans(): any[] {
    const q = this.searchQuery.trim().toLowerCase();
    return this.loans.filter((item) => {
      const matchesSearch =
        !q ||
        (item.borrowerName || '').toLowerCase().includes(q) ||
        (item.borrowerContact || '').toLowerCase().includes(q) ||
        (item.referenceNumber || '').toLowerCase().includes(q) ||
        (item.description || '').toLowerCase().includes(q);
      const matchesStatus = !this.statusFilter || (item.status || '').toUpperCase() === this.statusFilter;
      return matchesSearch && matchesStatus;
    });
  }

  get totalOutstanding(): number {
    return this.loans.reduce((sum, l) => sum + this.toNumber(l.balanceOutstanding), 0);
  }

  get activeCount(): number {
    return this.loans.filter((l) => (l.status || '').toUpperCase() === 'ACTIVE').length;
  }

  get overdueCount(): number {
    return this.loans.filter((l) => (l.status || '').toUpperCase() === 'OVERDUE').length;
  }

  openCreateModal(): void {
    this.editingLoan = null;
    this.loanForm = {
      borrowerName: '',
      borrowerContact: '',
      borrowerType: 'STAFF',
      principalAmount: null,
      loanDate: this.todayInput(),
      dueDate: '',
      description: ''
    };
    this.showLoanModal = true;
  }

  openEditModal(item: any): void {
    this.editingLoan = item;
    this.loanForm = {
      borrowerName: item.borrowerName || '',
      borrowerContact: item.borrowerContact || '',
      borrowerType: (item.borrowerType || 'STAFF').toUpperCase(),
      principalAmount: this.toNumber(item.principalAmount),
      loanDate: this.toDateInput(item.loanDate),
      dueDate: this.toDateInput(item.dueDate),
      description: item.description || ''
    };
    this.showLoanModal = true;
  }

  openRepaymentModal(item: any): void {
    this.repaymentTarget = item;
    this.repaymentForm = {
      repaymentAmount: this.toNumber(item.balanceOutstanding) || null,
      note: ''
    };
    this.showRepaymentModal = true;
  }

  confirmDelete(item: any): void {
    this.deleteTarget = item;
    this.showDeleteConfirm = true;
  }

  closeModals(): void {
    if (this.isSaving) return;
    this.showLoanModal = false;
    this.showRepaymentModal = false;
    this.showDeleteConfirm = false;
    this.editingLoan = null;
    this.repaymentTarget = null;
    this.deleteTarget = null;
  }

  loadLoans(): void {
    this.isLoading = true;
    this.api.getAllLoans().subscribe({
      next: (res: any) => {
        this.loans = Array.isArray(res) ? res : [];
        this.isLoading = false;
      },
      error: () => {
        this.loans = [];
        this.isLoading = false;
        this.showError('Failed to load loans');
      }
    });
  }

  saveLoan(): void {
    if (!this.loanForm.borrowerName?.trim()) {
      this.showError('Borrower name is required.');
      return;
    }
    if (!this.loanForm.principalAmount || this.loanForm.principalAmount <= 0) {
      this.showError('Enter a valid principal amount.');
      return;
    }
    if (!this.userId) {
      this.showError('User session not found. Please log in again.');
      return;
    }
    this.isSaving = true;
    const payload: any = {
      recordedByUserId: this.userId,
      borrowerName: this.loanForm.borrowerName.trim(),
      borrowerContact: this.loanForm.borrowerContact?.trim() || '',
      borrowerType: this.loanForm.borrowerType,
      principalAmount: Number(this.loanForm.principalAmount),
      loanDate: this.loanForm.loanDate || this.todayInput(),
      dueDate: this.loanForm.dueDate || null,
      description: this.loanForm.description?.trim() || ''
    };
    const request$ = this.editingLoan
      ? this.api.updateLoan(this.editingLoan.id, payload)
      : this.api.saveLoan(payload);
    request$.subscribe({
      next: (res: any) => {
        this.isSaving = false;
        this.showLoanModal = false;
        this.editingLoan = null;
        this.showSuccess(res?.message || 'Loan saved');
        this.loadLoans();
      },
      error: (err: any) => {
        this.isSaving = false;
        this.showError(err?.error?.message || err?.error?.error || 'Failed to save loan');
      }
    });
  }

  saveRepayment(): void {
    if (!this.repaymentTarget?.id) return;
    if (!this.repaymentForm.repaymentAmount || this.repaymentForm.repaymentAmount <= 0) {
      this.showError('Enter a valid repayment amount.');
      return;
    }
    this.isSaving = true;
    this.api.recordLoanRepayment(this.repaymentTarget.id, {
      repaymentAmount: Number(this.repaymentForm.repaymentAmount),
      note: this.repaymentForm.note?.trim() || ''
    }).subscribe({
      next: (res: any) => {
        this.isSaving = false;
        this.showRepaymentModal = false;
        this.repaymentTarget = null;
        this.showSuccess(res?.message || 'Repayment recorded');
        this.loadLoans();
      },
      error: (err: any) => {
        this.isSaving = false;
        this.showError(err?.error?.message || err?.error?.error || 'Failed to record repayment');
      }
    });
  }

  deleteLoan(): void {
    if (!this.deleteTarget?.id) return;
    this.isSaving = true;
    this.api.deleteLoan(this.deleteTarget.id).subscribe({
      next: (res: any) => {
        this.isSaving = false;
        this.showDeleteConfirm = false;
        this.deleteTarget = null;
        this.showSuccess(res?.message || 'Loan deleted');
        this.loadLoans();
      },
      error: (err: any) => {
        this.isSaving = false;
        this.showError(err?.error?.message || err?.error?.error || 'Failed to delete loan');
      }
    });
  }

  statusClass(status: string): string {
    const s = (status || '').toUpperCase();
    if (s === 'PAID') return 'status-badge status-paid';
    if (s === 'OVERDUE') return 'status-badge status-overdue';
    return 'status-badge status-active';
  }

  formatAmount(value: any): string {
    return this.toNumber(value).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }

  formatDate(value: any): string {
    if (!value) return '-';
    const d = new Date(String(value).replace(/\//g, '-'));
    return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString();
  }

  private todayInput(): string {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  }

  private toDateInput(value: any): string {
    if (!value) return '';
    const text = String(value).replace(/\//g, '-');
    const d = new Date(text);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  private toNumber(value: any): number {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
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