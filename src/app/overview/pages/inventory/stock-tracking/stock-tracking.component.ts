import { Component, HostListener, OnInit } from '@angular/core';
import { ApiService } from '../../../../services/api.service';
import { ThemeService } from '../../../../services/theme.service';
import { Router } from '@angular/router';

/** Box in the store-to-store flow SVG (real tracking data). */
export interface StoreFlowChartNode {
  id: string;
  label: string;
  fullLabel: string;
  kind: 'store' | 'virtual';
  x: number;
  y: number;
  w: number;
  h: number;
}

/** One arrow per table/ledger row (or paired transfer leg). */
export interface StoreFlowChartEdge {
  pathD: string;
  /** Short on-diagram label */
  label: string;
  midX: number;
  midY: number;
  /** Full row detail for SVG tooltip */
  fullLabel: string;
  /** Stable key for trackBy */
  key: string;
}

@Component({
  selector: 'app-stock-tracking',
  templateUrl: './stock-tracking.component.html',
  styleUrls: ['./stock-tracking.component.css']
})
export class StockTrackingComponent implements OnInit {
  isDarkMode: boolean = false;
  stockTrackingList: any[] = [];
  /** Full list from API (all items); used when no stock item filter is applied. */
  private allStockTrackingList: any[] = [];
  stockItems: any[] = [];
  /** Resolve stock item name by id when API rows omit the name. */
  private stockItemNameById = new Map<number, string>();
  /** Resolve store name by id when API rows omit the name. */
  private storeNameById = new Map<number, string>();
  /** Batch id → raw expiry value from `getAllStockBatches` (for display). */
  private expiryRawByBatchId = new Map<number, unknown>();
  /** All batches from API — used for expiry map + batch filter options per item. */
  allStockBatches: any[] = [];
  /** Empty string = show all tracking rows; otherwise stock item id (string, bound to select). */
  selectedStockItemId: string = '';
  /** When a stock item is selected: filter to this batch id; empty = all batches for that item. */
  selectedStockBatchId: string = '';
  /**
   * Sorted tracking rows for the currently selected stock item (from API).
   * Batch filter narrows this list without a second API call.
   */
  private cachedTrackingForSelectedItem: any[] = [];
  isLoadingService: boolean = false;
  isLoadingStockItems: boolean = false;

  /** Searchable popup to pick a stock item (same pattern as stock transfer batch picker). */
  showStockItemPicker = false;
  stockItemPickerSearch = '';

  /** Searchable popup for batches belonging to the selected stock item. */
  showStockBatchPicker = false;
  stockBatchPickerSearch = '';

  /** Full-screen modal with hospital stock-flow organogram. */
  showOrganogramModal = false;

  /** Data-driven store ↔ store flow chart (rebuilt when modal opens). */
  organogramFlowNodes: StoreFlowChartNode[] = [];
  organogramFlowEdges: StoreFlowChartEdge[] = [];
  organogramFlowViewBox = '0 0 960 420';
  organogramFlowEmptyReason = '';

  constructor(
    private router: Router,
    private api: ApiService,
    private themeService: ThemeService
  ) {}

  @HostListener('document:keydown.escape')
  onOrganogramEscape(): void {
    if (this.showOrganogramModal) {
      this.closeOrganogram();
    }
  }

  ngOnInit(): void {
    const username = sessionStorage.getItem('username');
    
    this.themeService.isDarkMode$.subscribe(isDark => {
      this.isDarkMode = isDark;
    });

    if (username === null) {
      this.router.navigate(['/login']);
    } else {
      // Load stores before tracking so `storeNameById` is populated when the table first renders
      // (avoids a race where rows show "Store #n" until a later change-detection cycle).
      this.loadStoresForTracking();
      this.loadStockItemsForFilter();
      this.loadBatchesForExpiryLookup();
    }
  }

  /** Load all batches so we can show expiry per tracking row via `stockBatchId`. */
  loadBatchesForExpiryLookup(): void {
    this.api.getAllStockBatches().subscribe({
      next: (res: any) => {
        const raw = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
        this.allStockBatches = raw;
        this.rebuildExpiryByBatchMap(raw);
      },
      error: () => {
        this.allStockBatches = [];
        this.expiryRawByBatchId = new Map();
      },
    });
  }

  private rebuildExpiryByBatchMap(batches: any[]): void {
    const next = new Map<number, unknown>();
    for (const b of batches) {
      const id = b?.id;
      if (id != null && !Number.isNaN(Number(id))) {
        const exp = b?.expiryDate ?? b?.expiry_date;
        next.set(Number(id), exp ?? null);
      }
    }
    this.expiryRawByBatchId = next;
  }

  /** Unwrap common API shapes: array, `{ data: [] }`, `{ data: { stores: [] } }`. */
  private normalizeStoresArray(res: any): any[] {
    if (Array.isArray(res)) {
      return res;
    }
    const d = res?.data;
    if (Array.isArray(d)) {
      return d;
    }
    if (d && typeof d === 'object' && Array.isArray((d as any).stores)) {
      return (d as any).stores;
    }
    return [];
  }

  loadStoresForTracking(): void {
    this.api.getAllStores().subscribe({
      next: (res: any) => {
        const raw = this.normalizeStoresArray(res);
        this.rebuildStoreNameMap(raw);
        this.initializeTableData();
      },
      error: () => {
        this.storeNameById = new Map();
        this.initializeTableData();
      },
    });
  }

  private rebuildStoreNameMap(stores: any[]): void {
    const next = new Map<number, string>();
    for (const s of stores) {
      const rawId = s?.id ?? s?.storeId ?? s?.store_id;
      if (rawId != null && rawId !== '' && !Number.isNaN(Number(rawId))) {
        next.set(Number(rawId), this.storeLabel(s));
      }
    }
    this.storeNameById = next;
  }

  private storeLabel(store: any): string {
    if (!store) return '';
    const n =
      store.name ??
      store.storeName ??
      store.store_name ??
      store.title ??
      store.label ??
      store.branchName ??
      store.branch_name ??
      store.location ??
      store.description;
    if (n != null && String(n).trim() !== '') {
      return String(n).trim();
    }
    const id = store.id ?? store.storeId ?? store.store_id;
    return id != null ? `Store #${id}` : '';
  }

  loadStockItemsForFilter(): void {
    this.isLoadingStockItems = true;
    this.api.getAllStockItems().subscribe({
      next: (res: any) => {
        this.isLoadingStockItems = false;
        const raw = Array.isArray(res) ? res : [];
        this.stockItems = [...raw].sort((a, b) =>
          this.stockItemLabel(a).localeCompare(this.stockItemLabel(b), undefined, { sensitivity: 'base' })
        );
        this.rebuildStockItemNameMap();
      },
      error: () => {
        this.isLoadingStockItems = false;
        this.stockItems = [];
        this.stockItemNameById.clear();
      }
    });
  }

  private rebuildStockItemNameMap(): void {
    this.stockItemNameById.clear();
    for (const si of this.stockItems) {
      if (si?.id != null && !Number.isNaN(Number(si.id))) {
        this.stockItemNameById.set(Number(si.id), this.stockItemLabel(si));
      }
    }
  }

  stockItemLabel(item: any): string {
    if (!item) return '';
    return (
      item.stockItemName ||
      item.itemName ||
      item.name ||
      item.genericName ||
      item.title ||
      `Item #${item.id ?? ''}`
    );
  }

  /** When user picks a stock item, load only that item’s tracking (receival → sales/out). */
  clearStockItemFilter(): void {
    this.closeStockItemPicker();
    this.closeStockBatchPicker();
    this.selectedStockItemId = '';
    this.selectedStockBatchId = '';
    this.cachedTrackingForSelectedItem = [];
    this.onStockItemFilterChange();
  }

  openStockItemPicker(): void {
    this.closeStockBatchPicker();
    this.stockItemPickerSearch = '';
    this.showStockItemPicker = true;
  }

  closeStockItemPicker(): void {
    this.showStockItemPicker = false;
    this.stockItemPickerSearch = '';
  }

  onStockItemPickerBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.closeStockItemPicker();
    }
  }

  selectStockItemPickerAll(): void {
    this.selectedStockItemId = '';
    this.selectedStockBatchId = '';
    this.cachedTrackingForSelectedItem = [];
    this.onStockItemFilterChange();
    this.closeStockItemPicker();
  }

  selectStockItemFromPicker(item: any): void {
    if (!item?.id) {
      return;
    }
    this.selectedStockItemId = String(item.id);
    this.selectedStockBatchId = '';
    this.cachedTrackingForSelectedItem = [];
    this.onStockItemFilterChange();
    this.closeStockItemPicker();
  }

  get stockItemPickerTriggerSummary(): string {
    if (!this.selectedStockItemId || this.selectedStockItemId === '') {
      return 'Select stock item to track';
    }
    const id = Number(this.selectedStockItemId);
    const item = this.stockItems.find((x) => Number(x?.id) === id);
    return item ? this.stockItemLabel(item) : `Item #${this.selectedStockItemId}`;
  }

  get filteredStockItemsForPicker(): any[] {
    const q = (this.stockItemPickerSearch || '').trim().toLowerCase();
    const list = this.stockItems || [];
    if (!q) {
      return list;
    }
    return list.filter((si) => {
      const label = this.stockItemLabel(si).toLowerCase();
      const idStr = si.id != null ? String(si.id) : '';
      return label.includes(q) || idStr.includes(q);
    });
  }

  trackStockItemById(_index: number, item: any): any {
    return item?.id;
  }

  /** Batches for the currently selected stock item (for batch picker). */
  get batchesForSelectedStockItem(): any[] {
    if (!this.selectedStockItemId) {
      return [];
    }
    const sid = Number(this.selectedStockItemId);
    if (Number.isNaN(sid)) {
      return [];
    }
    const list = (this.allStockBatches || []).filter((b) => {
      const iid = b?.stockItemId ?? b?.stock_item_id;
      return iid != null && Number(iid) === sid;
    });
    return [...list].sort((a, b) => Number(b?.id ?? 0) - Number(a?.id ?? 0));
  }

  openStockBatchPicker(): void {
    if (!this.selectedStockItemId) {
      return;
    }
    this.closeStockItemPicker();
    this.stockBatchPickerSearch = '';
    this.showStockBatchPicker = true;
  }

  closeStockBatchPicker(): void {
    this.showStockBatchPicker = false;
    this.stockBatchPickerSearch = '';
  }

  onStockBatchPickerBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.closeStockBatchPicker();
    }
  }

  selectStockBatchPickerAll(): void {
    this.selectedStockBatchId = '';
    this.applyBatchFilterToDisplayedList();
    this.closeStockBatchPicker();
  }

  selectStockBatchFromPicker(batch: any): void {
    if (!batch?.id) {
      return;
    }
    this.selectedStockBatchId = String(batch.id);
    this.applyBatchFilterToDisplayedList();
    this.closeStockBatchPicker();
  }

  clearStockBatchFilter(): void {
    this.closeStockBatchPicker();
    this.selectedStockBatchId = '';
    this.applyBatchFilterToDisplayedList();
  }

  get stockBatchPickerTriggerSummary(): string {
    if (!this.selectedStockItemId) {
      return 'Select a stock item first';
    }
    if (!this.selectedStockBatchId) {
      return 'All batches for this item';
    }
    const id = Number(this.selectedStockBatchId);
    const batch = this.batchesForSelectedStockItem.find(
      (b) => Number(b?.id) === id
    );
    return batch ? this.getStockBatchPickerLabel(batch) : `Batch #${this.selectedStockBatchId}`;
  }

  get filteredBatchesForPicker(): any[] {
    const q = (this.stockBatchPickerSearch || '').trim().toLowerCase();
    const list = this.batchesForSelectedStockItem;
    if (!q) {
      return list;
    }
    return list.filter((b) => {
      const label = this.getStockBatchPickerLabel(b).toLowerCase();
      const idStr = b.id != null ? String(b.id) : '';
      const bn = b.batchNumber != null ? String(b.batchNumber).toLowerCase() : '';
      return label.includes(q) || idStr.includes(q) || bn.includes(q);
    });
  }

  trackBatchByIdForPicker(_index: number, batch: any): any {
    return batch?.id;
  }

  /** Row label in batch picker (batch #, expiry, store, on hand). */
  getStockBatchPickerLabel(batch: any): string {
    if (!batch) {
      return '';
    }
    const hasBatchNo = batch.batchNumber != null && String(batch.batchNumber).trim() !== '';
    const batchPart = hasBatchNo ? `Batch ${batch.batchNumber}` : `Batch #${batch.id ?? '?'}`;
    const expRaw = batch.expiryDate ?? batch.expiry_date;
    const exp = this.formatExpiryForTable(expRaw);
    const expPart = exp && exp !== 'N/A' ? ` · Exp ${exp}` : '';
    const store =
      batch.storeName != null && String(batch.storeName).trim() !== ''
        ? String(batch.storeName).trim()
        : '';
    const storePart = store ? ` · ${store}` : '';
    const hand = this.formatStockAtHandShort(batch.stockAtHand ?? batch.stock_at_hand);
    const handPart = hand ? ` · Qty ${hand}` : '';
    return `${batchPart}${expPart}${storePart}${handPart}`;
  }

  private formatStockAtHandShort(value: unknown): string {
    if (value == null || value === '') {
      return '';
    }
    const n = typeof value === 'number' ? value : parseFloat(String(value).replace(/,/g, ''));
    if (!Number.isFinite(n)) {
      return String(value);
    }
    if (Number.isInteger(n) || Math.abs(n - Math.round(n)) < 1e-9) {
      return String(Math.round(n));
    }
    return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }

  /** Apply `selectedStockBatchId` on top of cached item tracking. */
  private applyBatchFilterToDisplayedList(): void {
    if (!this.selectedStockItemId) {
      return;
    }
    let rows = [...this.cachedTrackingForSelectedItem];
    if (this.selectedStockBatchId) {
      const bid = Number(this.selectedStockBatchId);
      if (!Number.isNaN(bid)) {
        rows = rows.filter((r) => {
          const rid = r?.stockBatchId ?? r?.stock_batch_id;
          return rid != null && Number(rid) === bid;
        });
      }
    }
    this.stockTrackingList = rows;
  }

  onStockItemFilterChange(): void {
    if (!this.selectedStockItemId || this.selectedStockItemId === '') {
      this.cachedTrackingForSelectedItem = [];
      this.selectedStockBatchId = '';
      this.stockTrackingList = this.sortTrackingChronologically([...this.allStockTrackingList]);
      return;
    }

    const stockItemId = Number(this.selectedStockItemId);
    if (Number.isNaN(stockItemId)) {
      return;
    }

    this.isLoadingService = true;
    this.api.getStockTrackingByItem(stockItemId).subscribe({
      next: (res) => {
        this.isLoadingService = false;
        const list = Array.isArray(res) ? res : [];
        this.cachedTrackingForSelectedItem = this.sortTrackingChronologically(list);
        this.applyBatchFilterToDisplayedList();
      },
      error: () => {
        this.isLoadingService = false;
        this.cachedTrackingForSelectedItem = [];
        this.stockTrackingList = [];
      }
    });
  }

  /** Oldest first so the story reads from receival (IN) through to sell/out (OUT). */
  sortTrackingChronologically(rows: any[]): any[] {
    const timeOf = (r: any): number => {
      const d = this.trackingEventDate(r);
      if (d) {
        return d.getTime();
      }
      const id = r?.id;
      return id != null && !Number.isNaN(Number(id)) ? Number(id) : 0;
    };
    return [...rows].sort((a, b) => timeOf(a) - timeOf(b));
  }

  initializeTableData() {
    this.isLoadingService = true;
    this.api.getAllStockTracking().subscribe({
      next: (res) => {
        this.isLoadingService = false;
        const list = Array.isArray(res) ? res : [];
        this.allStockTrackingList = list;
        if (!this.selectedStockItemId) {
          this.stockTrackingList = this.sortTrackingChronologically([...list]);
        } else {
          this.onStockItemFilterChange();
        }
      },
      error: () => {
        this.isLoadingService = false;
        this.allStockTrackingList = [];
        this.stockTrackingList = [];
      }
    });
  }

  /** Show numeric/string fields without treating 0 as empty. */
  displayCell(value: unknown): string {
    if (value === null || value === undefined || value === '') return 'N/A';
    return String(value);
  }

  transactionBadgeClass(type: string | undefined): string {
    const t = (type || '').toUpperCase();
    if (t === 'IN') return 'badge-success';
    if (t === 'OUT') return 'badge-danger';
    return 'badge-secondary';
  }

  /**
   * How this movement was recorded — aligns with backend `StockTrackingService` SRC_* / REF_*.
   */
  displayTrackingSource(tracking: any): string {
    if (!tracking) {
      return 'Other / unspecified';
    }
    const ev = String(tracking.sourceEvent ?? tracking.source_event ?? '').trim();
    const ref = String(tracking.referenceType ?? tracking.reference_type ?? '').trim();

    const byEvent: Record<string, string> = {
      STOCK_TRANSFER_IN: 'Transfer in',
      STOCK_TRANSFER_OUT: 'Transfer out',
      STOCK_ADJUSTMENT: 'Adjustment',
      STOCK_RECEIVE: 'Stock receive',
      STOCK_RECEIVE_DELETE: 'Receive reversed',
      TREATMENT_CHART_DISPENSE: 'Pharmacy dispense',
      TREATMENT_CHART_DELETE: 'Pharmacy reversal',
      TREATMENT_CHART_ADJUST: 'Pharmacy adjust',
      EXPIRY_ITEM_REGISTER: 'Expiry register',
    };
    if (ev && byEvent[ev]) {
      return byEvent[ev];
    }
    if (ev) {
      return this.formatRawSourceEventLabel(ev);
    }

    const byRef: Record<string, string> = {
      StockTransfer: 'Transfer',
      StockAdjustment: 'Adjustment',
      StockReceive: 'Stock receive',
      ExpiryItemRegister: 'Expiry register',
      TreatmentChart: 'Pharmacy',
    };
    if (ref && byRef[ref]) {
      return byRef[ref];
    }
    if (ref) {
      return ref;
    }
    return 'Other / unspecified';
  }

  /** Tooltip: friendly label + raw event / ref ids for support. */
  displayTrackingSourceTooltip(tracking: any): string {
    const label = this.displayTrackingSource(tracking);
    const parts = [label];
    const ev = tracking?.sourceEvent ?? tracking?.source_event;
    const refT = tracking?.referenceType ?? tracking?.reference_type;
    const refId = tracking?.referenceId ?? tracking?.reference_id;
    if (ev) {
      parts.push(`Event: ${ev}`);
    }
    if (refT) {
      parts.push(`Ref: ${refT}${refId != null ? ` #${refId}` : ''}`);
    }
    return parts.join(' · ');
  }

  /** CSS class for source pill (colour by category). */
  trackingSourceBadgeClass(tracking: any): string {
    const ev = String(tracking?.sourceEvent ?? tracking?.source_event ?? '').toUpperCase();
    const ref = String(tracking?.referenceType ?? tracking?.reference_type ?? '');

    if (ev.includes('EXPIRY') || ref === 'ExpiryItemRegister') {
      return 'source-pill source-expiry';
    }
    if (ev === 'STOCK_ADJUSTMENT' || ref === 'StockAdjustment') {
      return 'source-pill source-adjustment';
    }
    if (ev.includes('TRANSFER') || ref === 'StockTransfer') {
      return 'source-pill source-transfer';
    }
    if (ev.includes('TREATMENT_CHART') || ref === 'TreatmentChart') {
      return 'source-pill source-pharmacy';
    }
    if (ev.includes('STOCK_RECEIVE') || ref === 'StockReceive') {
      return 'source-pill source-receive';
    }
    return 'source-pill source-other';
  }

  private formatRawSourceEventLabel(raw: string): string {
    return raw
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  private readonly trackingDateKeyCandidates: string[] = [
    'transactionTimestamp',
    'transaction_timestamp',
    'createdAt',
    'created_at',
    'dateCreated',
    'date_created',
    'transactionDate',
    'transaction_date',
    'transactionTime',
    'transaction_time',
    'dateTime',
    'date_time',
    'recordedAt',
    'recorded_at',
    'timestamp',
    'timeStamp',
    'time_stamp',
    'occurredAt',
    'occurred_at',
    'eventTime',
    'event_time',
    'updatedAt',
    'updated_at',
    'modifiedAt',
    'modified_at',
    'trackingDate',
    'tracking_date',
    'date',
  ];

  /** First non-empty value that might represent when the movement happened. */
  private pickTrackingRawInstant(tracking: any): unknown {
    if (!tracking || typeof tracking !== 'object') {
      return null;
    }
    for (const k of this.trackingDateKeyCandidates) {
      if (Object.prototype.hasOwnProperty.call(tracking, k)) {
        const v = (tracking as any)[k];
        if (v != null && v !== '') {
          return v;
        }
      }
    }
    for (const k of Object.keys(tracking)) {
      const nested = (tracking as any)[k];
      if (!nested || typeof nested !== 'object' || Array.isArray(nested)) {
        continue;
      }
      for (const ck of this.trackingDateKeyCandidates) {
        if (Object.prototype.hasOwnProperty.call(nested, ck)) {
          const v = nested[ck];
          if (v != null && v !== '') {
            return v;
          }
        }
      }
    }
    for (const k of Object.keys(tracking)) {
      if (!/date|time|timestamp|created|modified|recorded|occurred|instant/i.test(k)) {
        continue;
      }
      const v = (tracking as any)[k];
      if (v == null || v === '') {
        continue;
      }
      if (typeof v === 'string' || typeof v === 'number' || Array.isArray(v)) {
        return v;
      }
      if (typeof v === 'object' && v !== null) {
        const o = v as any;
        if (o.epochSecond != null || o.milliseconds != null || o.year != null) {
          return v;
        }
      }
    }
    return null;
  }

  /** Parse API instant: ISO strings, epoch numbers, Java LocalDate(Time) arrays, Java time objects. */
  private parseTrackingInstant(raw: unknown): Date | null {
    if (raw == null || raw === '') {
      return null;
    }
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      const ms = raw < 1e12 ? raw * 1000 : raw;
      const d = new Date(ms);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    if (typeof raw === 'string') {
      const s = raw.trim();
      if (!s) {
        return null;
      }
      const d = new Date(s);
      if (!Number.isNaN(d.getTime())) {
        return d;
      }
      const n = Number(s);
      if (Number.isFinite(n) && /^\d{10,13}$/.test(s)) {
        const ms = n < 1e12 ? n * 1000 : n;
        const d2 = new Date(ms);
        return Number.isNaN(d2.getTime()) ? null : d2;
      }
      return null;
    }
    if (Array.isArray(raw)) {
      return this.dateFromJavaStyleArray(raw);
    }
    if (typeof raw === 'object' && raw !== null) {
      const o = raw as any;
      if (o.epochSecond != null) {
        const sec = Number(o.epochSecond);
        const nano = Number(o.nano ?? o.nanoseconds ?? 0);
        if (Number.isFinite(sec)) {
          const d = new Date(sec * 1000 + nano / 1e6);
          return Number.isNaN(d.getTime()) ? null : d;
        }
      }
      if (o.milliseconds != null) {
        const d = new Date(Number(o.milliseconds));
        return Number.isNaN(d.getTime()) ? null : d;
      }
      if (o.year != null && o.monthValue != null && o.dayOfMonth != null) {
        const y = Number(o.year);
        const m = Number(o.monthValue) - 1;
        const day = Number(o.dayOfMonth);
        const h = Number(o.hour ?? 0);
        const mi = Number(o.minute ?? 0);
        const s = Number(o.second ?? 0);
        if (Number.isFinite(y) && Number.isFinite(m) && Number.isFinite(day)) {
          const d = new Date(y, m, day, h, mi, s);
          return Number.isNaN(d.getTime()) ? null : d;
        }
      }
    }
    return null;
  }

  /** Jackson often serializes Java `LocalDate` / `LocalDateTime` as `[y, m, d]` or `[y, m, d, h, min, sec, nano]`. */
  private dateFromJavaStyleArray(arr: any[]): Date | null {
    if (!Array.isArray(arr) || arr.length < 3) {
      return null;
    }
    const y = Number(arr[0]);
    const month1 = Number(arr[1]);
    const day = Number(arr[2]);
    if (!Number.isFinite(y) || !Number.isFinite(month1) || !Number.isFinite(day)) {
      return null;
    }
    const month0 = month1 >= 1 && month1 <= 12 ? month1 - 1 : month1;
    if (arr.length >= 6) {
      const h = Number(arr[3] ?? 0);
      const mi = Number(arr[4] ?? 0);
      const sec = Number(arr[5] ?? 0);
      const nano = arr.length >= 7 ? Number(arr[6]) || 0 : 0;
      const ms = Math.floor(nano / 1e6);
      const d = new Date(y, month0, day, h, mi, sec, ms);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    const d = new Date(y, month0, day);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  private formatRawInstantForTable(raw: unknown): string {
    if (raw == null || raw === '') {
      return 'N/A';
    }
    if (Array.isArray(raw)) {
      return raw.join(' / ');
    }
    if (typeof raw === 'object') {
      try {
        return JSON.stringify(raw);
      } catch {
        return String(raw);
      }
    }
    return String(raw);
  }

  /** Parsed event time for sorting and display. */
  private trackingEventDate(tracking: any): Date | null {
    return this.parseTrackingInstant(this.pickTrackingRawInstant(tracking));
  }

  displayTrackingDate(tracking: any): string {
    const raw = this.pickTrackingRawInstant(tracking);
    const d = this.parseTrackingInstant(raw);
    if (d) {
      return d.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    }
    return this.formatRawInstantForTable(raw);
  }

  displayTrackingTime(tracking: any): string {
    const d = this.trackingEventDate(tracking);
    if (!d) {
      return '';
    }
    return d.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  }

  /** Full tooltip when raw API shape is odd but we still show a parsed or raw date. */
  displayTrackingDateTooltip(tracking: any): string {
    const d = this.trackingEventDate(tracking);
    if (d) {
      return d.toISOString();
    }
    const raw = this.pickTrackingRawInstant(tracking);
    return raw != null ? this.formatRawInstantForTable(raw) : 'No date on record';
  }

  displayTrackingStockItemName(tracking: any): string {
    const direct =
      tracking?.stockItemName ??
      tracking?.stock_item_name ??
      tracking?.itemName ??
      tracking?.item_name;
    if (direct != null && String(direct).trim() !== '') {
      return String(direct).trim();
    }
    const id = tracking?.stockItemId ?? tracking?.stock_item_id;
    if (id != null && !Number.isNaN(Number(id))) {
      const mapped = this.stockItemNameById.get(Number(id));
      if (mapped) {
        return mapped;
      }
      return `Item #${id}`;
    }
    return 'N/A';
  }

  /** Store column: name from row or lookup by storeId; checks nested `store`. */
  displayTrackingStore(tracking: any): string {
    if (!tracking) {
      return 'N/A';
    }
    const nested = tracking.store ?? tracking.stockBatch?.store;
    const direct =
      tracking.storeName ??
      tracking.store_name ??
      tracking.fromStoreName ??
      tracking.from_store_name ??
      tracking.toStoreName ??
      tracking.to_store_name ??
      nested?.name ??
      nested?.storeName ??
      nested?.store_name ??
      nested?.location ??
      nested?.description;
    if (direct != null && String(direct).trim() !== '') {
      return String(direct).trim();
    }
    const sid =
      tracking.storeId ??
      tracking.store_id ??
      tracking.fromStoreId ??
      tracking.from_store_id ??
      nested?.id ??
      nested?.storeId ??
      nested?.store_id;
    if (sid != null && sid !== '' && !Number.isNaN(Number(sid))) {
      const n = Number(sid);
      const mapped = this.storeNameById.get(n);
      if (mapped != null && String(mapped).trim() !== '') {
        return String(mapped).trim();
      }
      return `Store #${n}`;
    }
    return 'N/A';
  }

  displayTrackingStoreTitle(tracking: any): string {
    const label = this.displayTrackingStore(tracking);
    const sid =
      tracking?.storeId ??
      tracking?.store_id ??
      tracking?.fromStoreId ??
      tracking?.from_store_id ??
      tracking?.store?.id;
    if (sid != null && sid !== '' && !Number.isNaN(Number(sid))) {
      return `${label} (id ${sid})`;
    }
    return label;
  }

  /**
   * Expiry for the batch tied to this movement (from API fields or batch lookup by `stockBatchId`).
   */
  displayTrackingExpiry(tracking: any): string {
    if (!tracking) {
      return 'N/A';
    }
    const nested = tracking.stockBatch;
    const direct =
      tracking.batchExpiryDate ??
      tracking.batch_expiry_date ??
      tracking.expiryDate ??
      tracking.expiry_date ??
      nested?.expiryDate ??
      nested?.expiry_date;
    if (direct != null && direct !== '') {
      return this.formatExpiryForTable(direct);
    }
    const bid = tracking.stockBatchId ?? tracking.stock_batch_id;
    if (bid != null && bid !== '' && !Number.isNaN(Number(bid))) {
      const raw = this.expiryRawByBatchId.get(Number(bid));
      if (raw != null && raw !== '') {
        return this.formatExpiryForTable(raw);
      }
    }
    return 'N/A';
  }

  displayTrackingExpiryTitle(tracking: any): string {
    const label = this.displayTrackingExpiry(tracking);
    const bid = tracking?.stockBatchId ?? tracking?.stock_batch_id;
    if (bid != null && label !== 'N/A') {
      return `${label} (batch ${bid})`;
    }
    return label;
  }

  /** Same patterns as stock-transfer: ISO, Java LocalDate array, etc. */
  formatExpiryForTable(value: unknown): string {
    if (value == null || value === '') {
      return 'N/A';
    }
    if (Array.isArray(value) && value.length >= 3) {
      const y = value[0];
      const m = Number(value[1]);
      const d = Number(value[2]);
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
    const parsed = new Date(value as string);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    }
    return String(value);
  }

  get filteredStockItemName(): string {
    if (!this.selectedStockItemId) {
      return '';
    }
    const id = Number(this.selectedStockItemId);
    const item = this.stockItems.find((x) => Number(x?.id) === id);
    return item ? this.stockItemLabel(item) : '';
  }

  /** Subtitle: optional batch filter label when item + batch selected. */
  get filteredBatchFilterHint(): string {
    if (!this.selectedStockBatchId || !this.selectedStockItemId) {
      return '';
    }
    return this.stockBatchPickerTriggerSummary;
  }

  openOrganogram(): void {
    this.closeStockItemPicker();
    this.closeStockBatchPicker();
    this.showOrganogramModal = true;
    this.rebuildStoreFlowChart();
  }

  closeOrganogram(): void {
    this.showOrganogramModal = false;
    this.organogramFlowNodes = [];
    this.organogramFlowEdges = [];
    this.organogramFlowEmptyReason = '';
  }

  onOrganogramBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.closeOrganogram();
    }
  }

  /** Title line in organogram modal. */
  get organogramTitle(): string {
    if (this.filteredStockItemName) {
      return this.filteredStockItemName;
    }
    return 'All stock items (current table view)';
  }

  /** Rows in the current `stockTrackingList` used for insights. */
  get organogramMovementCount(): number {
    return (this.stockTrackingList || []).length;
  }

  /** Ledger rows: full history for selected item (all batches); otherwise capped slice of current table view. */
  private static readonly ORGANOGRAM_ALL_ITEMS_CAP = 2000;

  get organogramLedgerRows(): any[] {
    if (this.selectedStockItemId) {
      return [...(this.cachedTrackingForSelectedItem || [])];
    }
    const all = this.stockTrackingList || [];
    return all.slice(0, StockTrackingComponent.ORGANOGRAM_ALL_ITEMS_CAP);
  }

  get organogramLedgerTruncated(): boolean {
    if (this.selectedStockItemId) {
      return false;
    }
    return (this.stockTrackingList || []).length > StockTrackingComponent.ORGANOGRAM_ALL_ITEMS_CAP;
  }

  get organogramLedgerRowCount(): number {
    return this.organogramLedgerRows.length;
  }

  /** Opening balance (qty before first ledger row). */
  get organogramOpeningBalance(): string {
    const rows = this.organogramLedgerRows;
    if (!rows.length) {
      return '—';
    }
    return this.displayCell(rows[0].stockBeforeTransaction);
  }

  /** Balance after last ledger row. */
  get organogramClosingBalance(): string {
    const rows = this.organogramLedgerRows;
    if (!rows.length) {
      return '—';
    }
    const last = rows[rows.length - 1];
    return this.displayCell(last.stockAfterTransaction);
  }

  /** Net change across the ledger (after last − before first). */
  get organogramNetChangeLabel(): string {
    const rows = this.organogramLedgerRows;
    if (!rows.length) {
      return '—';
    }
    const first = Number(rows[0].stockBeforeTransaction);
    const last = Number(rows[rows.length - 1].stockAfterTransaction);
    if (!Number.isFinite(first) || !Number.isFinite(last)) {
      return '—';
    }
    const net = last - first;
    const sign = net > 0 ? '+' : '';
    return `${sign}${net}`;
  }

  formatOrganogramDelta(tracking: any): string {
    const q = tracking?.quantityChanged ?? tracking?.quantity_changed;
    if (q === null || q === undefined || q === '') {
      return 'N/A';
    }
    const n = typeof q === 'number' ? q : parseFloat(String(q));
    if (!Number.isFinite(n)) {
      return String(q);
    }
    const sign = n > 0 ? '+' : '';
    return `${sign}${n}`;
  }

  isOrganogramDeltaPositive(row: any): boolean {
    const q = row?.quantityChanged ?? row?.quantity_changed;
    const n = typeof q === 'number' ? q : parseFloat(String(q));
    return Number.isFinite(n) && n > 0;
  }

  isOrganogramDeltaNegative(row: any): boolean {
    const q = row?.quantityChanged ?? row?.quantity_changed;
    const n = typeof q === 'number' ? q : parseFloat(String(q));
    return Number.isFinite(n) && n < 0;
  }

  organogramRowDateTime(tracking: any): string {
    const d = this.displayTrackingDate(tracking);
    const t = this.displayTrackingTime(tracking);
    if (t) {
      return `${d} ${t}`;
    }
    return d;
  }

  displayOrganogramBatchId(tracking: any): string {
    const id = tracking?.stockBatchId ?? tracking?.stock_batch_id;
    if (id == null || id === '') {
      return '—';
    }
    return String(id);
  }

  trackOrganogramRow(_index: number, row: any): any {
    return row?.id ?? _index;
  }

  trackOrganogramFlowEdge(_index: number, e: StoreFlowChartEdge): string {
    return e.key;
  }

  /** Compact label on each flow arrow (matches table row order #). */
  private buildFlowEdgeShortLabel(row: any, seq: number): string {
    const d = this.formatOrganogramDelta(row);
    return seq > 0 ? `#${seq} ${d}` : d;
  }

  /** Tooltip: same fields you see in the tracking table. */
  private buildFlowEdgeFullLabel(row: any, seq: number): string {
    const t = this.organogramRowDateTime(row);
    const store = this.displayTrackingStore(row);
    const io = this.displayCell(row?.transactionType ?? row?.transaction_type);
    const dq = this.formatOrganogramDelta(row);
    const src = this.displayTrackingSource(row);
    const batch = this.displayOrganogramBatchId(row);
    const parts = [
      seq > 0 ? `Row #${seq}` : '',
      t,
      `Store: ${store}`,
      io,
      `Δ ${dq}`,
      src && src !== 'N/A' ? `Source: ${src}` : '',
      batch !== '—' ? `Batch: ${batch}` : '',
    ].filter(Boolean);
    return parts.join(' · ');
  }

  private static readonly FLOW_NODE_W = 168;
  private static readonly FLOW_NODE_H = 56;
  private static readonly FLOW_GAP_X = 48;
  private static readonly FLOW_LEFT_COL = 28;
  private static readonly FLOW_ROW_STORE_Y = 240;

  /** Build rectangles + one arrow per ledger row (stacked when same from→to). */
  rebuildStoreFlowChart(): void {
    this.organogramFlowNodes = [];
    this.organogramFlowEdges = [];
    this.organogramFlowEmptyReason = '';

    const rows = [...(this.organogramLedgerRows || [])];
    if (rows.length === 0) {
      this.organogramFlowEmptyReason =
        'No tracking rows to chart — select a stock item with movement history.';
      this.organogramFlowViewBox = '0 0 400 120';
      return;
    }

    rows.sort((a, b) => {
      const ta = this.trackingEventDate(a)?.getTime() ?? 0;
      const tb = this.trackingEventDate(b)?.getTime() ?? 0;
      if (ta !== tb) {
        return ta - tb;
      }
      return (Number(a?.id) || 0) - (Number(b?.id) || 0);
    });

    const seqOf = (r: any): number => {
      const i = rows.indexOf(r);
      return i >= 0 ? i + 1 : 0;
    };

    type RawMove = { from: string; to: string; row: any };
    const rawMoves: RawMove[] = [];
    const pushMove = (from: string, to: string, row: any) => {
      if (!from || !to || from === to || !row) {
        return;
      }
      rawMoves.push({ from, to, row });
    };

    const usedRowIds = new Set<number | string>();

    const storeKeyOf = (r: any): string | null => {
      const sid = r?.storeId ?? r?.store_id;
      if (sid == null || sid === '' || Number.isNaN(Number(sid))) {
        return null;
      }
      return `s:${Number(sid)}`;
    };

    const storeLabelOf = (r: any): string => {
      const name = this.displayTrackingStore(r);
      if (name && name !== 'N/A') {
        return name;
      }
      const sid = r?.storeId ?? r?.store_id;
      return sid != null ? `Store #${sid}` : 'Store';
    };

    const qtySigned = (r: any): number => {
      const q = r?.quantityChanged ?? r?.quantity_changed;
      const n = typeof q === 'number' ? q : parseFloat(String(q));
      return Number.isFinite(n) ? n : 0;
    };

    const qtyMag = (r: any): number => Math.abs(qtySigned(r));

    const srcEv = (r: any): string => String(r?.sourceEvent ?? r?.source_event ?? '');
    const refType = (r: any): string => String(r?.referenceType ?? r?.reference_type ?? '');
    const tx = (r: any): string => String(r?.transactionType ?? r?.transaction_type ?? '').toUpperCase();

    const VIRT = {
      receive: 'v:receive',
      dispense: 'v:dispense',
      expiry: 'v:expiry',
      adjust: 'v:adjust',
      otherIn: 'v:other-in',
      otherOut: 'v:other-out',
    };

    // 1) Pair stock transfers by referenceId — draw one arrow per row (OUT and IN both A→B).
    const byRef = new Map<string, any[]>();
    for (const r of rows) {
      const rid = r?.referenceId ?? r?.reference_id;
      if (rid == null) {
        continue;
      }
      const k = String(rid);
      if (!byRef.has(k)) {
        byRef.set(k, []);
      }
      byRef.get(k)!.push(r);
    }

    const looksLikeStockTransferGroup = (grp: any[]): boolean =>
      grp.some(
        (r) =>
          /stocktransfer/i.test(refType(r)) ||
          /STOCK_TRANSFER/i.test(srcEv(r))
      );

    for (const [, grp] of byRef) {
      if (!looksLikeStockTransferGroup(grp)) {
        continue;
      }
      const out = grp.find((x) => tx(x) === 'OUT');
      const inn = grp.find((x) => tx(x) === 'IN');
      const fk = storeKeyOf(out);
      const tk = storeKeyOf(inn);
      if (out && inn && fk && tk && fk !== tk) {
        pushMove(fk, tk, out);
        pushMove(fk, tk, inn);
        for (const x of grp) {
          if (x?.id != null) {
            usedRowIds.add(x.id);
          }
        }
      }
    }

    // 2) Orphan STOCK_TRANSFER_OUT/IN: same — one arrow per matched row.
    const orphans = rows.filter((r) => r?.id != null && !usedRowIds.has(r.id));
    const outs = orphans.filter((r) => /STOCK_TRANSFER_OUT/i.test(srcEv(r)) && tx(r) === 'OUT' && storeKeyOf(r));
    const ins = orphans.filter((r) => /STOCK_TRANSFER_IN/i.test(srcEv(r)) && tx(r) === 'IN' && storeKeyOf(r));
    ins.sort((a, b) => (this.trackingEventDate(a)?.getTime() ?? 0) - (this.trackingEventDate(b)?.getTime() ?? 0));
    for (const o of outs) {
      const t0 = this.trackingEventDate(o)?.getTime() ?? 0;
      const mq = qtyMag(o);
      const idx = ins.findIndex(
        (inn) =>
          !usedRowIds.has(inn.id) &&
          qtyMag(inn) === mq &&
          Math.abs((this.trackingEventDate(inn)?.getTime() ?? 0) - t0) < 120_000
      );
      if (idx >= 0) {
        const inn = ins[idx];
        const fk = storeKeyOf(o)!;
        const tk = storeKeyOf(inn)!;
        pushMove(fk, tk, o);
        pushMove(fk, tk, inn);
        usedRowIds.add(o.id);
        usedRowIds.add(inn.id);
        ins.splice(idx, 1);
      }
    }

    // 3) Every other row — one arrow each (same rules as before, no aggregation).
    for (const r of rows) {
      if (r?.id != null && usedRowIds.has(r.id)) {
        continue;
      }
      const sk = storeKeyOf(r);
      const q = qtySigned(r);
      const mag = Math.abs(q);
      const se = srcEv(r);
      const t = tx(r);

      if (t === 'IN' && /STOCK_RECEIVE/i.test(se)) {
        if (sk) {
          pushMove(VIRT.receive, sk, r);
        }
        continue;
      }
      if (t === 'OUT' && /TREATMENT_CHART_DISPENSE/i.test(se)) {
        if (sk) {
          pushMove(sk, VIRT.dispense, r);
        }
        continue;
      }
      if (t === 'OUT' && /EXPIRY_ITEM_REGISTER/i.test(se)) {
        if (sk) {
          pushMove(sk, VIRT.expiry, r);
        }
        continue;
      }
      if (/STOCK_ADJUSTMENT/i.test(se)) {
        if (!sk) {
          continue;
        }
        if (t === 'IN' && q > 0) {
          pushMove(VIRT.adjust, sk, r);
        } else if (t === 'OUT' && q < 0) {
          pushMove(sk, VIRT.adjust, r);
        } else if (q > 0) {
          pushMove(VIRT.adjust, sk, r);
        } else if (q < 0) {
          pushMove(sk, VIRT.adjust, r);
        }
        continue;
      }
      if (t === 'IN' && sk) {
        pushMove(VIRT.otherIn, sk, r);
      } else if (t === 'OUT' && sk) {
        pushMove(sk, VIRT.otherOut, r);
      }
    }

    // Collect node ids
    const nodeMeta = new Map<string, { kind: 'store' | 'virtual'; label: string }>();
    const ensureStore = (key: string | null, sampleRow: any | null) => {
      if (!key || !key.startsWith('s:')) {
        return;
      }
      if (!nodeMeta.has(key)) {
        const sid = Number(key.slice(2));
        const labelFromMap = this.storeNameById.get(sid);
        nodeMeta.set(key, {
          kind: 'store',
          label: labelFromMap && labelFromMap !== 'N/A' ? labelFromMap : sampleRow ? storeLabelOf(sampleRow) : `Store #${sid}`,
        });
      }
    };

    const virtLabels: Record<string, string> = {
      [VIRT.receive]: 'Stock receive',
      [VIRT.dispense]: 'Dispense / sell',
      [VIRT.expiry]: 'Expiry register',
      [VIRT.adjust]: 'Adjustment',
      [VIRT.otherIn]: 'Other IN',
      [VIRT.otherOut]: 'Other OUT',
    };

    for (const k of Object.keys(virtLabels)) {
      nodeMeta.set(k, { kind: 'virtual', label: virtLabels[k] });
    }

    for (const r of rows) {
      ensureStore(storeKeyOf(r), r);
    }

    for (const m of rawMoves) {
      if (m.from.startsWith('s:')) {
        ensureStore(m.from, null);
      }
      if (m.to.startsWith('s:')) {
        ensureStore(m.to, null);
      }
    }

    const storeKeys = [...nodeMeta.keys()].filter((k) => k.startsWith('s:')).sort((a, b) => Number(a.slice(2)) - Number(b.slice(2)));

    const virtualKeysUsed = new Set<string>();
    for (const m of rawMoves) {
      if (m.from.startsWith('v:')) {
        virtualKeysUsed.add(m.from);
      }
      if (m.to.startsWith('v:')) {
        virtualKeysUsed.add(m.to);
      }
    }

    const pairKey = (from: string, to: string) => `${from}→${to}`;
    const pairTotals = new Map<string, number>();
    for (const m of rawMoves) {
      const pk = pairKey(m.from, m.to);
      pairTotals.set(pk, (pairTotals.get(pk) ?? 0) + 1);
    }

    const NODE_W = StockTrackingComponent.FLOW_NODE_W;
    const NODE_H = StockTrackingComponent.FLOW_NODE_H;
    const GAP = StockTrackingComponent.FLOW_GAP_X;
    const LEFT = StockTrackingComponent.FLOW_LEFT_COL;
    const ROW_Y = StockTrackingComponent.FLOW_ROW_STORE_Y;

    const storesStartX = LEFT + NODE_W + 72;
    const pos = new Map<string, { x: number; y: number; w: number; h: number }>();

    storeKeys.forEach((id, i) => {
      pos.set(id, { x: storesStartX + i * (NODE_W + GAP), y: ROW_Y, w: NODE_W, h: NODE_H });
    });

    const rightsX = storesStartX + storeKeys.length * (NODE_W + GAP) + 64;
    let srcY = 48;
    let sinkY = 48;
    const orderVirt = [
      VIRT.receive,
      VIRT.otherIn,
      VIRT.adjust,
      VIRT.dispense,
      VIRT.expiry,
      VIRT.otherOut,
    ];

    const edgeUsesVirt = (vk: string, asFrom: boolean): boolean =>
      rawMoves.some((m) => (asFrom ? m.from === vk : m.to === vk));

    for (const vk of orderVirt) {
      if (!virtualKeysUsed.has(vk)) {
        continue;
      }
      const isSource = edgeUsesVirt(vk, true);
      const isSink = edgeUsesVirt(vk, false);
      if (isSource && !isSink) {
        pos.set(vk, { x: LEFT, y: srcY, w: NODE_W, h: NODE_H });
        srcY += NODE_H + 32;
      } else if (isSink && !isSource) {
        pos.set(vk, { x: rightsX, y: sinkY, w: NODE_W, h: NODE_H });
        sinkY += NODE_H + 32;
      } else {
        pos.set(vk, { x: LEFT, y: srcY, w: NODE_W, h: NODE_H });
        srcY += NODE_H + 32;
      }
    }

    for (const vk of virtualKeysUsed) {
      if (!pos.has(vk)) {
        pos.set(vk, { x: LEFT, y: srcY, w: NODE_W, h: NODE_H });
        srcY += NODE_H + 32;
      }
    }

    const maxBottom = Math.max(
      ROW_Y + NODE_H + 40,
      srcY + 24,
      sinkY + 24,
      ...[...pos.values()].map((p) => p.y + p.h + 40)
    );
    const width = Math.max(720, rightsX + NODE_W + 48);

    this.organogramFlowViewBox = `0 0 ${width} ${maxBottom}`;

    const nodesOut: StoreFlowChartNode[] = [];
    for (const [id, meta] of nodeMeta) {
      const p = pos.get(id);
      if (!p) {
        continue;
      }
      const full = meta.label;
      const label = full.length > 24 ? `${full.slice(0, 22)}…` : full;
      nodesOut.push({
        id,
        label,
        fullLabel: full,
        kind: meta.kind,
        ...p,
      });
    }
    this.organogramFlowNodes = nodesOut;

    const getNode = (id: string) => nodesOut.find((n) => n.id === id);

    const connectPath = (
      a: StoreFlowChartNode,
      b: StoreFlowChartNode,
      perpBump: number
    ): { d: string; midX: number; midY: number } => {
      const cxA = a.x + a.w / 2;
      const cyA = a.y + a.h / 2;
      const cxB = b.x + b.w / 2;
      const cyB = b.y + b.h / 2;

      let x1: number;
      let y1: number;
      let x2: number;
      let y2: number;

      if (a.x + a.w <= b.x) {
        x1 = a.x + a.w;
        y1 = cyA + perpBump;
        x2 = b.x;
        y2 = cyB + perpBump;
      } else if (b.x + b.w <= a.x) {
        x1 = a.x;
        y1 = cyA + perpBump;
        x2 = b.x + b.w;
        y2 = cyB + perpBump;
      } else {
        x1 = cxA + perpBump;
        y1 = a.y + a.h;
        x2 = cxB + perpBump;
        y2 = b.y;
      }

      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;
      const dx = Math.max(64, Math.abs(x2 - x1) * 0.45);
      const dy = Math.max(64, Math.abs(y2 - y1) * 0.45);
      const d = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
      return { d, midX: mx, midY: my - 6 };
    };

    const pairOrd = new Map<string, number>();
    const BUMP = 11;
    const edgesOut: StoreFlowChartEdge[] = [];
    let edgeCounter = 0;

    for (const m of rawMoves) {
      const pk = pairKey(m.from, m.to);
      const total = pairTotals.get(pk) ?? 1;
      const idx = pairOrd.get(pk) ?? 0;
      pairOrd.set(pk, idx + 1);
      const perpBump = total > 1 ? (idx - (total - 1) / 2) * BUMP : 0;

      const na = getNode(m.from);
      const nb = getNode(m.to);
      if (!na || !nb) {
        continue;
      }

      const { d, midX, midY } = connectPath(na, nb, perpBump);
      const row = m.row;
      const seq = seqOf(row);
      const label = this.buildFlowEdgeShortLabel(row, seq);
      const fullLabel = this.buildFlowEdgeFullLabel(row, seq);
      const rid = row?.id ?? 'noid';
      const key = `e-${rid}-${pk}-${idx}-${edgeCounter++}`;
      edgesOut.push({ pathD: d, label, midX, midY, fullLabel, key });
    }

    this.organogramFlowEdges = edgesOut;

    if (edgesOut.length === 0 && storeKeys.length > 0) {
      this.organogramFlowEmptyReason =
        'Stores appear in the data but no arrows could be drawn (e.g. missing movement pairing). Check the main tracking table.';
    } else if (edgesOut.length === 0) {
      this.organogramFlowEmptyReason =
        'Could not derive flow arrows from these rows — use the main tracking table for detail.';
    }
  }

  /** Distinct stores appearing in the organogram ledger rows. */
  get organogramInsightStores(): string[] {
    const rows = this.organogramLedgerRows || [];
    const set = new Set<string>();
    for (const r of rows) {
      const s = this.displayTrackingStore(r);
      if (s && s !== 'N/A') {
        set.add(s);
      }
    }
    return [...set].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }

  /** Distinct movement sources in the organogram ledger. */
  get organogramInsightSources(): string[] {
    const rows = this.organogramLedgerRows || [];
    const set = new Set<string>();
    for (const r of rows) {
      const s = this.displayTrackingSource(r);
      if (s && s !== 'Other / unspecified') {
        set.add(s);
      }
    }
    return [...set].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }

  private static readonly ORGANOGRAM_INSIGHT_CAP = 30;

  get organogramInsightStoresLimited(): string[] {
    return this.organogramInsightStores.slice(0, StockTrackingComponent.ORGANOGRAM_INSIGHT_CAP);
  }

  get organogramInsightStoresMore(): number {
    return Math.max(0, this.organogramInsightStores.length - StockTrackingComponent.ORGANOGRAM_INSIGHT_CAP);
  }

  get organogramInsightSourcesLimited(): string[] {
    return this.organogramInsightSources.slice(0, StockTrackingComponent.ORGANOGRAM_INSIGHT_CAP);
  }

  get organogramInsightSourcesMore(): number {
    return Math.max(0, this.organogramInsightSources.length - StockTrackingComponent.ORGANOGRAM_INSIGHT_CAP);
  }
}
