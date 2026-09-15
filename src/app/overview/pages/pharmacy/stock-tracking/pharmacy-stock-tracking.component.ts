import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ThemeService } from '../../../../services/theme.service';

@Component({
  selector: 'app-pharmacy-stock-tracking',
  templateUrl: './pharmacy-stock-tracking.component.html',
  styleUrls: ['./pharmacy-stock-tracking.component.css']
})
export class PharmacyStockTrackingComponent implements OnInit {
  isDarkMode: boolean = false;
  searchQuery: string = '';
  statusFilter: string = '';
  dateFilter: string = '';
  currentPage: number = 1;
  totalPages: number = 5;

  totalItems: number = 0;
  lowStockItems: number = 0;

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