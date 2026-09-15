import { Component, OnInit } from '@angular/core';
import { ThemeService } from '../../../services/theme.service';

@Component({
  selector: 'app-inventory-dashboard',
  templateUrl: './inventory-dashboard.component.html',
  styleUrls: ['./inventory-dashboard.component.css']
})
export class InventoryDashboardComponent implements OnInit {
  isDarkMode: boolean = false;

  totalItems: number = 1245;
  lowStockItems: number = 23;
  totalValue: number = 2450000;
  expiringSoon: number = 15;

  recentActivities = [
    { type: 'receive', icon: 'bi bi-box-arrow-in-down', title: 'Stock received for Paracetamol 500mg', time: '2 hours ago', user: 'John Doe' },
    { type: 'transfer', icon: 'bi bi-arrow-left-right', title: 'Stock transferred to Ward A', time: '5 hours ago', user: 'Jane Smith' },
    { type: 'low-stock', icon: 'bi bi-exclamation-triangle', title: 'Low stock alert for Bandages', time: '1 day ago', user: 'System' },
    { type: 'receive', icon: 'bi bi-box-arrow-in-down', title: 'New stock received for Syringes', time: '2 days ago', user: 'Michael Johnson' }
  ];

  constructor(private themeService: ThemeService) {}

  ngOnInit(): void {
    this.themeService.isDarkMode$.subscribe(isDark => {
      this.isDarkMode = isDark;
    });
  }
}
