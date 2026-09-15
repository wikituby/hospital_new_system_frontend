import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../services/api.service';
import { ThemeService } from '../services/theme.service';
import { forkJoin, Subscription } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { of } from 'rxjs';

@Component({
  selector: 'app-expiry-drugs',
  templateUrl: './expiry-drugs.component.html',
  styleUrls: ['./expiry-drugs.component.css']
})
export class ExpiryDrugsComponent implements OnInit, OnDestroy {
  activeTab: 'near' | 'expired' = 'near';
  nearExpiryList: any[] = [];
  expiredList: any[] = [];
  loadingNear = false;
  loadingExpired = false;
  errorNear: string | null = null;
  errorExpired: string | null = null;
  filterFromNear = '';
  filterToNear = '';
  filterItemNear = '';
  filterFromExpired = '';
  filterToExpired = '';
  filterItemExpired = '';
  allStockReceived: any[] = [];
  allItems: any[] = [];
  allCategories: any[] = [];
  isDarkMode = false;
  private themeSub?: Subscription;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private api: ApiService,
    private themeService: ThemeService
  ) {}

  ngOnInit(): void {
    this.themeSub = this.themeService.isDarkMode$.subscribe((isDark) => {
      this.isDarkMode = isDark;
    });
    const tab = this.route.snapshot.data['tab'];
    if (tab === 'expired') {
      this.activeTab = 'expired';
      this.loadExpired();
    } else {
      this.activeTab = 'near';
      this.loadNearExpiry();
    }
  }

  ngOnDestroy(): void {
    this.themeSub?.unsubscribe();
  }

  setTab(tab: 'near' | 'expired'): void {
    this.activeTab = tab;
    if (tab === 'near') this.loadNearExpiry();
    else this.loadExpired();
  }

  loadNearExpiry(): void {
    this.loadingNear = true;
    this.errorNear = null;
    this.nearExpiryList = [];
    setTimeout(() => { this.loadingNear = false; }, 300);
  }

  loadExpired(): void {
    this.loadingExpired = true;
    this.errorExpired = null;
    this.expiredList = [];

    // Load stock received, items, and categories in parallel
    forkJoin({
      stockReceived: this.api.getAllStockReceived().pipe(
        catchError((err: any) => {
          console.error('Error loading stock received:', err);
          return of([]);
        })
      ),
      items: this.api.getItemsz().pipe(
        catchError((err: any) => {
          console.error('Error loading items:', err);
          return of([]);
        })
      ),
      categories: this.api.getAllItemCategories().pipe(
        catchError((err: any) => {
          console.error('Error loading categories:', err);
          return of([]);
        })
      )
    }).subscribe({
      next: (results: any) => {
        this.allStockReceived = results.stockReceived || [];
        this.allItems = results.items || [];
        this.allCategories = results.categories || [];

        // Get today's date in YYYY-MM-DD format
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];

        // Find the "drug" parent category (case-insensitive)
        const drugCategory = this.allCategories.find((cat: any) =>
          cat.name && cat.name.toLowerCase().trim() === 'drug' &&
          (!cat.parentId || cat.parentId === null || cat.parentId === undefined)
        );

        if (!drugCategory) {
          console.warn('Drug category not found');
          this.expiredList = [];
          this.loadingExpired = false;
          return;
        }

        const drugCategoryId = drugCategory.id;

        // Filter stock items where:
        // 1. Item's parent category is "drug"
        // 2. Expiry date has passed (expiryDate < today)
        this.expiredList = this.allStockReceived
          .filter((stock: any) => {
            // Find the item associated with this stock
            const item = this.allItems.find((it: any) =>
              it.id === stock.itemId || it.id === stock.item?.id
            );

            if (!item) return false;

            // Check if item's parent category is "drug"
            let isDrug = false;

            // Method 1: Check parentCategoryId directly
            if (item.parentCategoryId) {
              isDrug = item.parentCategoryId == drugCategoryId ||
                       String(item.parentCategoryId) === String(drugCategoryId);
            }

            // Method 2: Check if item.category is an object with parentId
            if (!isDrug && item.category && typeof item.category === 'object') {
              if (item.category.parentId) {
                isDrug = item.category.parentId == drugCategoryId ||
                         String(item.category.parentId) === String(drugCategoryId);
              } else if (item.category.id) {
                isDrug = item.category.id === drugCategoryId ||
                         String(item.category.id) === String(drugCategoryId);
              }
            }

            // Method 3: Find category by ID or name in the item's category field
            if (!isDrug && item.category) {
              const itemCategory = this.allCategories.find((cat: any) => {
                if (typeof item.category === 'number' || typeof item.category === 'string') {
                  return cat.id == item.category ||
                         cat.name?.toLowerCase() === String(item.category).toLowerCase();
                }
                return false;
              });

              if (itemCategory) {
                // Check if it's the drug category itself
                if (itemCategory.id === drugCategoryId || String(itemCategory.id) === String(drugCategoryId)) {
                  isDrug = true;
                }
                // Check if it's a child of drug category
                else if (itemCategory.parentId) {
                  isDrug = itemCategory.parentId == drugCategoryId ||
                           String(itemCategory.parentId) === String(drugCategoryId);
                }
              }
            }

            if (!isDrug) return false;

            // Check if expiry date has passed
            if (!stock.expiryDate) return false;

            // Parse expiry date - handle different formats
            let expiryDateStr = '';
            if (typeof stock.expiryDate === 'string') {
              // Handle formats like "2024/01/15" or "2024-01-15"
              expiryDateStr = stock.expiryDate.replace(/\//g, '-').substring(0, 10);
            } else if (stock.expiryDate.year && stock.expiryDate.month && stock.expiryDate.day) {
              // Handle NgbDateStruct format
              expiryDateStr = `${stock.expiryDate.year}-${String(stock.expiryDate.month).padStart(2, '0')}-${String(stock.expiryDate.day).padStart(2, '0')}`;
            }

            if (!expiryDateStr) return false;

            // Compare dates (expiryDate < today means expired)
            return expiryDateStr < todayStr;
          })
          .map((stock: any) => {
            // Find the item to get item name
            const item = this.allItems.find((it: any) =>
              it.id === stock.itemId || it.id === stock.item?.id
            );

            return {
              itemName: item?.title || item?.name || stock.itemName || stock.name || '–',
              batch: stock.batch || stock.batchNumber || '–',
              expiryDate: stock.expiryDate,
              quantity: stock.quantityAvailable || stock.quantityReceived || stock.quantity || '–',
              ...stock // Include all other stock properties
            };
          });

        this.loadingExpired = false;
      },
      error: (err: any) => {
        console.error('Error loading expired drugs:', err);
        this.errorExpired = 'Failed to load expired drugs. Please try again.';
        this.loadingExpired = false;
      }
    });
  }

  get filteredNearList(): any[] {
    let list = this.nearExpiryList;
    if (this.filterFromNear) {
      const from = this.filterFromNear.trim();
      list = list.filter((v: any) => v.expiryDate && String(v.expiryDate).substring(0, 10) >= from);
    }
    if (this.filterToNear) {
      const to = this.filterToNear.trim();
      list = list.filter((v: any) => v.expiryDate && String(v.expiryDate).substring(0, 10) <= to);
    }
    if (this.filterItemNear) {
      const q = this.filterItemNear.trim().toLowerCase();
      list = list.filter((v: any) => (v.itemName && String(v.itemName).toLowerCase().includes(q)) || (v.name && String(v.name).toLowerCase().includes(q)));
    }
    return list;
  }

  get filteredExpiredList(): any[] {
    let list = this.expiredList;

    // Helper function to normalize date string to YYYY-MM-DD format
    const normalizeDate = (date: any): string => {
      if (!date) return '';
      if (typeof date === 'string') {
        // Handle formats like "2024/01/15" or "2024-01-15"
        return date.replace(/\//g, '-').substring(0, 10);
      } else if (date.year && date.month && date.day) {
        // Handle NgbDateStruct format
        return `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`;
      }
      return '';
    };

    if (this.filterFromExpired) {
      const from = this.filterFromExpired.trim();
      list = list.filter((v: any) => {
        const expiryDateStr = normalizeDate(v.expiryDate);
        return expiryDateStr && expiryDateStr >= from;
      });
    }
    if (this.filterToExpired) {
      const to = this.filterToExpired.trim();
      list = list.filter((v: any) => {
        const expiryDateStr = normalizeDate(v.expiryDate);
        return expiryDateStr && expiryDateStr <= to;
      });
    }
    if (this.filterItemExpired) {
      const q = this.filterItemExpired.trim().toLowerCase();
      list = list.filter((v: any) => (v.itemName && String(v.itemName).toLowerCase().includes(q)) || (v.name && String(v.name).toLowerCase().includes(q)));
    }
    return list;
  }

  applyFilterNear(): void { this.loadNearExpiry(); }
  applyFilterExpired(): void { this.loadExpired(); }
  clearFilterNear(): void { this.filterFromNear = ''; this.filterToNear = ''; this.filterItemNear = ''; }
  clearFilterExpired(): void { this.filterFromExpired = ''; this.filterToExpired = ''; this.filterItemExpired = ''; }

  formatExpiryDate(date: any): string {
    if (!date) return '';
    if (typeof date === 'string') {
      // Return as-is if already a string, or format it
      return date;
    } else if (date.year && date.month && date.day) {
      // Handle NgbDateStruct format
      return `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`;
    }
    return String(date);
  }
}
