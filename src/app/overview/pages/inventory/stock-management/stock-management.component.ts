import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ThemeService } from '../../../../services/theme.service';

@Component({
  selector: 'app-stock-management',
  templateUrl: './stock-management.component.html',
  styleUrls: ['./stock-management.component.css']
})
export class StockManagementComponent implements OnInit {
  isDarkMode: boolean = false;
  searchQuery: string = '';
  locationFilter: string = '';
  statusFilter: string = '';
  dateFilter: string = '';
  currentPage: number = 1;
  totalPages: number = 5;

  totalStockItems: number = 856;
  totalStockValue: number = 1850000;
  lowStockItems: number = 23;
  todayMovements: number = 45;

  stockItems = [
    {
      itemCode: 'MED-001',
      itemName: 'Paracetamol 500mg',
      location: 'Main Store',
      currentStock: 1500,
      reorderLevel: 500,
      maxStock: 3000,
      unit: 'Tablets',
      unitPrice: 0.25,
      totalValue: 375.00
    },
    {
      itemCode: 'CON-002',
      itemName: 'Disposable Syringes 5ml',
      location: 'Pharmacy',
      currentStock: 45,
      reorderLevel: 50,
      maxStock: 200,
      unit: 'Boxes',
      unitPrice: 12.50,
      totalValue: 562.50
    },
    {
      itemCode: 'EQP-003',
      itemName: 'Blood Pressure Monitor',
      location: 'Ward A',
      currentStock: 8,
      reorderLevel: 10,
      maxStock: 20,
      unit: 'Units',
      unitPrice: 125.00,
      totalValue: 1000.00
    }
  ];

  get filteredStock(): any[] {
    return this.stockItems.filter(item => {
      const matchesSearch = !this.searchQuery || 
        item.itemName.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        item.itemCode.toLowerCase().includes(this.searchQuery.toLowerCase());
      const matchesLocation = !this.locationFilter || 
        item.location.toLowerCase().includes(this.locationFilter.toLowerCase());
      const matchesStatus = !this.statusFilter || 
        this.getStockStatus(item.currentStock, item.reorderLevel).toLowerCase() === this.statusFilter.toLowerCase();
      return matchesSearch && matchesLocation && matchesStatus;
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

  getStockStatusClass(currentStock: number, reorderLevel: number): string {
    if (currentStock === 0) return 'status-out';
    if (currentStock <= reorderLevel) return 'status-low';
    return 'status-ok';
  }

  getStockStatus(currentStock: number, reorderLevel: number): string {
    if (currentStock === 0) return 'Out of Stock';
    if (currentStock <= reorderLevel) return 'Low Stock';
    return 'In Stock';
  }

  receiveStock(): void {
    console.log('Receive stock');
  }

  transferStock(): void {
    console.log('Transfer stock');
  }

  viewStock(stock: any): void {
    console.log('View stock:', stock);
  }

  adjustStock(stock: any): void {
    console.log('Adjust stock:', stock);
  }

  viewHistory(stock: any): void {
    console.log('View history:', stock);
  }
}
