import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ApiService, StockAdjustmentRequestPayload } from '../../../../services/api.service';
import { ThemeService } from '../../../../services/theme.service';

type StockTakeRow = {
  stockBatchId: number;
  stockItemName: string;
  storeName: string;
  batchNumber: string;
  systemQty: number;
  countedQty: number | null;
  diff: number;
};

@Component({
  selector: 'app-stock-taking',
  templateUrl: './stock-taking.component.html',
  styleUrls: ['./stock-taking.component.css'],
})
export class StockTakingComponent implements OnInit {
  isDarkMode = false;
  isLoading = false;
  isSaving = false;

  responseMessage = '';
  responseError = '';

  stores: any[] = [];
  selectedStoreId: number | null = null;

  searchQuery = '';
  rows: StockTakeRow[] = [];

  adjustmentTypes: any[] = [];
  selectedAdjustmentTypeId: number | null = null;
  reason = 'Stock taking';

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
    this.loadAll();
  }

  loadAll(): void {
    this.responseError = '';
    this.responseMessage = '';
    this.isLoading = true;
    forkJoin({
      stores: this.api.getAllStores().pipe(map((r: any) => (Array.isArray(r) ? r : r?.data ?? [])), catchError(() => of([]))),
      types: this.api.getActiveAdjustmentTypes().pipe(catchError(() => of([]))),
    }).subscribe({
      next: ({ stores, types }) => {
        this.stores = Array.isArray(stores) ? stores : [];
        this.adjustmentTypes = Array.isArray(types) ? types : [];
        if (this.selectedAdjustmentTypeId == null) {
          const preferred =
            this.adjustmentTypes.find((t: any) => String(t?.code || '').toLowerCase().includes('stock')) ||
            this.adjustmentTypes.find((t: any) => String(t?.name || '').toLowerCase().includes('stock')) ||
            this.adjustmentTypes[0];
          this.selectedAdjustmentTypeId = preferred?.id ?? null;
        }
        this.isLoading = false;
        this.loadBatches();
      },
      error: () => {
        this.isLoading = false;
      },
    });
  }

  loadBatches(): void {
    this.isLoading = true;
    this.api.getAllStockBatches(this.selectedStoreId ?? undefined).subscribe({
      next: (res: any) => {
        const list = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
        this.rows = list.map((b: any) => {
          const system = Number(b?.stockAtHand ?? 0);
          return {
            stockBatchId: Number(b?.id),
            stockItemName: b?.stockItemName || b?.stockItem?.itemName || 'N/A',
            storeName: b?.storeName || b?.store?.storeName || 'N/A',
            batchNumber: b?.batchNumber || 'N/A',
            systemQty: Number.isFinite(system) ? system : 0,
            countedQty: null,
            diff: 0,
          } as StockTakeRow;
        });
        this.isLoading = false;
      },
      error: () => {
        this.rows = [];
        this.isLoading = false;
      },
    });
  }

  get filteredRows(): StockTakeRow[] {
    const q = this.searchQuery.trim().toLowerCase();
    if (!q) return this.rows;
    return this.rows.filter((r) =>
      `${r.stockItemName} ${r.storeName} ${r.batchNumber}`.toLowerCase().includes(q)
    );
  }

  updateRowDiff(row: StockTakeRow): void {
    const counted = row.countedQty == null ? null : Number(row.countedQty);
    if (counted == null || Number.isNaN(counted)) {
      row.diff = 0;
      return;
    }
    row.countedQty = counted;
    row.diff = counted - row.systemQty;
  }

  fillCountedWithSystem(): void {
    for (const r of this.rows) {
      r.countedQty = r.systemQty;
      r.diff = 0;
    }
  }

  applyStockTake(): void {
    this.responseError = '';
    this.responseMessage = '';

    if (this.selectedAdjustmentTypeId == null) {
      this.responseError = 'Select an adjustment type first.';
      return;
    }

    const changes = this.rows
      .filter((r) => r.countedQty != null)
      .filter((r) => Number.isFinite(r.diff) && r.diff !== 0);

    if (changes.length === 0) {
      this.responseError = 'No differences to apply. Enter counted quantities first.';
      return;
    }

    const doneBy = sessionStorage.getItem('username') || '';
    const reqs = changes.map((r) => {
      const payload: StockAdjustmentRequestPayload = {
        stockBatchId: r.stockBatchId,
        adjustmentTypeId: Number(this.selectedAdjustmentTypeId),
        quantityChanged: Number(r.diff),
        reason: this.reason,
        doneBy,
      };
      return this.api.addStockAdjustment(payload).pipe(
        catchError((err) => of({ __error: true, err, stockBatchId: r.stockBatchId }))
      );
    });

    this.isSaving = true;
    forkJoin(reqs).subscribe({
      next: (results: any[]) => {
        const failed = results.filter((x) => x && x.__error);
        this.isSaving = false;
        if (failed.length) {
          this.responseError = `${failed.length} adjustment(s) failed. Check server message and retry.`;
        } else {
          this.responseMessage = `Applied stock take for ${changes.length} batch(es).`;
        }
        this.loadBatches();
      },
      error: () => {
        this.isSaving = false;
        this.responseError = 'Failed to apply stock take.';
      },
    });
  }
}

