import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ThemeService } from '../../../../services/theme.service';

@Component({
  selector: 'app-drug-interactions',
  templateUrl: './drug-interactions.component.html',
  styleUrls: ['./drug-interactions.component.css']
})
export class DrugInteractionsComponent implements OnInit {
  isDarkMode: boolean = false;
  searchQuery: string = '';
  statusFilter: string = '';
  dateFilter: string = '';
  currentPage: number = 1;
  totalPages: number = 5;

  interactionAlerts: number = 0;
  checkedToday: number = 0;

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