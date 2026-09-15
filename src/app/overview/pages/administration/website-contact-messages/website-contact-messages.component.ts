import { Component, OnInit } from '@angular/core';
import { ApiService } from '../../../../services/api.service';
import { ThemeService } from '../../../../services/theme.service';

export interface WebsiteContactMessageRow {
  id: number;
  ref?: string;
  fullName: string;
  phone: string;
  email?: string;
  subject: string;
  message: string;
  status: string;
  source?: string;
  createdAt?: string;
}

@Component({
  selector: 'app-website-contact-messages',
  templateUrl: './website-contact-messages.component.html',
  styleUrls: ['./website-contact-messages.component.css']
})
export class WebsiteContactMessagesComponent implements OnInit {
  isDarkMode = false;
  loading = false;
  errorMessage = '';
  searchQuery = '';
  statusFilter = '';
  messages: WebsiteContactMessageRow[] = [];
  selected: WebsiteContactMessageRow | null = null;
  updatingId: number | null = null;

  constructor(
    private api: ApiService,
    private themeService: ThemeService
  ) {}

  ngOnInit(): void {
    this.themeService.isDarkMode$.subscribe((isDark) => {
      this.isDarkMode = isDark;
    });
    this.loadMessages();
  }

  get filteredMessages(): WebsiteContactMessageRow[] {
    const q = this.searchQuery.trim().toLowerCase();
    return this.messages.filter((row) => {
      const matchesStatus = !this.statusFilter || (row.status || '').toUpperCase() === this.statusFilter;
      if (!matchesStatus) {
        return false;
      }
      if (!q) {
        return true;
      }
      const haystack = [
        row.ref,
        row.fullName,
        row.phone,
        row.email,
        row.subject,
        row.message
      ]
        .map((v) => String(v || '').toLowerCase())
        .join(' ');
      return haystack.includes(q);
    });
  }

  get newCount(): number {
    return this.messages.filter((m) => (m.status || '').toUpperCase() === 'NEW').length;
  }

  loadMessages(): void {
    this.loading = true;
    this.errorMessage = '';
    this.api.getWebsiteContactMessages().subscribe({
      next: (rows) => {
        this.messages = Array.isArray(rows) ? rows : [];
        this.loading = false;
        if (this.selected) {
          this.selected =
            this.messages.find((m) => m.id === this.selected?.id) || null;
        }
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage =
          err?.error?.message ||
          err?.message ||
          'Could not load website contact messages. Connect to the clinic/cloud API and try again.';
      }
    });
  }

  openMessage(row: WebsiteContactMessageRow): void {
    this.selected = row;
    if ((row.status || '').toUpperCase() === 'NEW') {
      this.setStatus(row, 'READ');
    }
  }

  closeDetail(): void {
    this.selected = null;
  }

  setStatus(row: WebsiteContactMessageRow, status: string): void {
    if (!row?.id) {
      return;
    }
    this.updatingId = row.id;
    this.api.updateWebsiteContactMessageStatus(row.id, status).subscribe({
      next: (updated) => {
        const nextStatus = updated?.status || status;
        row.status = nextStatus;
        const idx = this.messages.findIndex((m) => m.id === row.id);
        if (idx >= 0) {
          this.messages[idx] = { ...this.messages[idx], status: nextStatus };
        }
        if (this.selected?.id === row.id) {
          this.selected = { ...this.selected, status: nextStatus };
        }
        this.updatingId = null;
      },
      error: () => {
        this.updatingId = null;
        this.errorMessage = 'Could not update message status.';
      }
    });
  }

  formatDate(value?: string): string {
    if (!value) {
      return '—';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return date.toLocaleString();
  }
}
