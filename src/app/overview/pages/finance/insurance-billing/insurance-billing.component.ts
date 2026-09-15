import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ThemeService } from '../../../../services/theme.service';

@Component({
  selector: 'app-insurance-billing',
  templateUrl: './insurance-billing.component.html',
  styleUrls: ['./insurance-billing.component.css']
})
export class InsuranceBillingComponent implements OnInit {
  isDarkMode: boolean = false;
  searchQuery: string = '';
  statusFilter: string = '';
  dateFilter: string = '';
  currentPage: number = 1;
  totalPages: number = 5;

  pendingClaims: number = 0;
  approvedClaims: number = 0;

  items: any[] = [];

  get filteredItems(): any[] {
    return this.items.filter(item => {
      const matchesSearch = !this.searchQuery || 
        item.name.toLowerCase().includes(this.searchQuery.toLowerCase());
      const matchesStatus = !this.statusFilter || item.status === this.statusFilter;
      return matchesSearch && matchesStatus;
    });
  }

  constructor(
    private router: Router,
    private themeService: ThemeService
  ) {}

  ngOnInit(): void {
    this.themeService.isDarkMode$.subscribe(isDark => {
      this.isDarkMode = isDark;
    });
  }

  createNew(): void {}
  viewDetails(item: any): void {}
  editItem(item: any): void {}
}