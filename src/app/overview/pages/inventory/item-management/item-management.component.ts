import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ThemeService } from '../../../../services/theme.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-item-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './item-management.component.html',
  styleUrls: ['./item-management.component.css']
})
export class ItemManagementComponent implements OnInit {
  isDarkMode: boolean = false;
  searchQuery: string = '';
  categoryFilter: string = '';
  statusFilter: string = '';
  stockFilter: string = '';
  currentPage: number = 1;
  totalPages: number = 5;

  totalItems: number = 1245;
  activeItems: number = 1180;
  totalCategories: number = 45;
  lowStockCount: number = 23;

  items = [
    {
      code: 'MED-001',
      name: 'Paracetamol 500mg',
      description: 'Pain relief medication',
      category: 'Medication',
      unit: 'Tablet',
      stockLevel: 1500,
      reorderLevel: 500,
      unitPrice: 0.25,
      status: 'active'
    },
    {
      code: 'EQP-002',
      name: 'Blood Pressure Monitor',
      description: 'Digital BP monitoring device',
      category: 'Equipment',
      unit: 'Unit',
      stockLevel: 8,
      reorderLevel: 10,
      unitPrice: 125.00,
      status: 'active'
    },
    {
      code: 'CON-003',
      name: 'Disposable Syringes 5ml',
      description: 'Single-use syringes',
      category: 'Consumables',
      unit: 'Box',
      stockLevel: 45,
      reorderLevel: 50,
      unitPrice: 12.50,
      status: 'active'
    }
  ];

  get filteredItems(): any[] {
    return this.items.filter(item => {
      const matchesSearch = !this.searchQuery || 
        item.name.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        item.code.toLowerCase().includes(this.searchQuery.toLowerCase());
      const matchesCategory = !this.categoryFilter || 
        item.category.toLowerCase().includes(this.categoryFilter.toLowerCase());
      const matchesStatus = !this.statusFilter || item.status === this.statusFilter;
      const matchesStock = !this.stockFilter || this.matchesStockFilter(item);
      return matchesSearch && matchesCategory && matchesStatus && matchesStock;
    });
  }

  constructor(
    private router: Router,
    private themeService: ThemeService
  ) {}

  ngOnInit(): void {
    const username = sessionStorage.getItem('username');
    
    this.themeService.isDarkMode$.subscribe(isDark => {
      this.isDarkMode = isDark;
    });

    if (username === null) {
      this.router.navigate(['/login']);
    }
  }

  matchesStockFilter(item: any): boolean {
    if (this.stockFilter === 'in-stock') return item.stockLevel > item.reorderLevel;
    if (this.stockFilter === 'low-stock') return item.stockLevel <= item.reorderLevel && item.stockLevel > 0;
    if (this.stockFilter === 'out-of-stock') return item.stockLevel === 0;
    return true;
  }

  getStockClass(stockLevel: number, reorderLevel: number): string {
    if (stockLevel === 0) return 'stock-out';
    if (stockLevel <= reorderLevel) return 'stock-low';
    return 'stock-ok';
  }

  getStockStatus(stockLevel: number, reorderLevel: number): string {
    if (stockLevel === 0) return 'Out of Stock';
    if (stockLevel <= reorderLevel) return 'Low Stock';
    return 'In Stock';
  }

  addItem(): void {
    console.log('Add new item');
  }

  importItems(): void {
    console.log('Import items');
  }

  viewItem(item: any): void {
    console.log('View item:', item);
  }

  editItem(item: any): void {
    console.log('Edit item:', item);
  }

  deleteItem(item: any): void {
    console.log('Delete item:', item);
  }
}
