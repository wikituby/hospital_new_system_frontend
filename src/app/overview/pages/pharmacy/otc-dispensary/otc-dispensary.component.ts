import { ChangeDetectorRef, Component, ElementRef, NgZone, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { NgForm } from '@angular/forms';
import { Router } from '@angular/router';
import { catchError, map, switchMap } from 'rxjs/operators';
import { forkJoin, of, Observable } from 'rxjs';
import jsPDF from 'jspdf';
import { ThemeService } from '../../../../services/theme.service';
import { ApiService } from '../../../../services/api.service';
import { FacilityBrandingService } from '../../../../services/facility-branding.service';
import {
  PharmacyVisitSyncService,
} from '../../../../services/pharmacy-visit-sync.service';
import {
  applyQueuePageModuleToSession,
  getQueuePageModuleIdFromSession,
  resolveModuleIdForUrl,
} from '../../../../utils/queue-page-context.util';
import {
  ensureFromModuleInList,
  normalizeHospitalModules,
  pickDefaultFromModuleId,
  isQueueDischargeDestination,
  queueDestinationOptions,
} from '../../../../utils/queue-module.util';
import {
  applyTreatmentLifecycleFlags,
  TreatmentLifecycleFlag,
  treatmentLifecyclePatch,
} from '../../../../utils/treatment-lifecycle.util';
import {
  applyPrescribingPrefillToTreatmentForm,
  formatDosageDisplay as formatDosageDisplayLabel,
  formatFrequencyDisplay,
  formatTreatmentPeriodUnit,
  hasPrescribingNumericValue,
  mapPrescribingUnitToDosageUnit,
  normalizeDosageUnitForSelect,
  DOSAGE_UNIT_SELECT_OPTIONS,
  isStandardDosageUnit,
  resolveStockPrescribingSource,
} from '../../../../utils/prescribing-prefill.util';
import {
  formatMoney2DecimalsDisplay,
  formatMoneyWholeDisplay,
  formatUgxPaymentTotalDisplay,
  roundUgxMoney,
} from '../../../../utils/ugx-money.util';
import {
  BatchSellingModel,
  extractBatchLinePricing,
} from '../../../../utils/stock-batch-pricing.util';
import { StandardDosageOption } from '../../../../utils/standard-dosage.util';
import { getPharmacyItemTotalStock } from '../../../../utils/pharmacy-prescription-sale.util';
import { AccessControlService } from '../../../../services/access-control.service';

/** Aggregated pharmacy order (OTC sale or visit prescriptions). */
export interface PharmacySoldOrder {
  orderKey: string;
  orderNo: string;
  saleSource: 'OTC' | 'RX';
  visitDate: string;
  visitTime: string;
  visitId?: number | null;
  visitNumber?: number;
  patientName?: string;
  totalCost: number;
  totalSell: number;
  /** Cash received for the sale (order-level; not summed per line). */
  amountReceived: number;
  /** Invoice/sale total when provided by API (else use totalSell). */
  saleTotalAmount?: number;
  lineCount: number;
  lines: OtcSoldRow[];
  receivedBy?: string;
}

/** One line item within a pharmacy sold order. */
export interface OtcSoldRow {
  saleSource: 'OTC' | 'RX';
  /** OTC: sale line id; RX: treatment request id. */
  lineId: number;
  saleId: number;
  saleNo?: string;
  patientName?: string;
  visitId?: number | null;
  visitNumber?: number;
  visitDate: string;
  visitTime: string;
  receivedBy?: string;
  itemName: string;
  /** Merged dose label (e.g. 200mg), same as cart Dosage column. */
  dosage: string;
  amountPerFrequencyValue: number | null;
  amountPerFrequencyUnit: string;
  frequencyValue: number | null;
  frequencyUnit: string | number | null;
  durationValue: number | null;
  durationUnit: string | number | null;
  quantity: number;
  totalUnits: number;
  unitBuy: number;
  unitSellingPrice: number;
  totalAmount: number;
  amountReceived?: number;
  saleTotalAmount?: number;
}

export interface DoctorPrescriptionRow {
  id: number;
  patientId: number | null;
  visitId: number;
  visitNumber: number;
  visitDate: string;
  visitTime: string;
  patientName: string;
  stockBatchId: number | null;
  /** Shop/stock item id when pharmacyUseStockBatch is false. */
  itemId: number | null;
  /** Marked in Doctor prescriptions tab — included in bill when true. */
  given: boolean;
  paid?: boolean;
  dispensed?: boolean;
  administered?: boolean;
  itemName: string;
  status: string;
  /** Original prescribed quantity from the visit. */
  prescribedQuantity: number;
  quantity: number;
  unitBuy: number;
  unitSellingPrice: number;
  dosage: string;
  amountPerFrequencyValue: number | null;
  amountPerFrequencyUnit: string;
  frequencyValue: number | null;
  frequencyUnit: string | number | null;
  durationValue: number | null;
  durationUnit: string | number | null;
  totalUnits: number;
  totalAmount: number;
  instructions: string;
  route: string;
  /** RX (treatment) or SUNDRY. */
  lineKind?: 'RX' | 'SUNDRY';
  visitSundryId?: number | null;
}

export interface OtcCartLine {
  /** Unique row key for cart operations. */
  cartLineKey: string;
  lineSource: 'OTC' | 'RX';
  /** When false, line is listed but excluded from bill total and completion. */
  given: boolean;
  treatmentRequestedId?: number;
  visitId?: number;
  patientId?: number | null;
  patientName?: string;
  stockBatchId: number | null;
  itemId: number;
  itemName: string;
  amountPerFrequencyValue: number | null;
  amountPerFrequencyUnit: string;
  frequencyValue: number | null;
  frequencyUnit: number | null;
  durationValue: number | null;
  durationUnit: number | null;
  quantity: number;
  totalUnits: number | null;
  unitBuy: number;
  unitSellingPrice: number;
  totalAmount: number;
  instructions: string;
  route: string;
  stockAtHand: number;
  unitSellingModelId?: number | null;
}

/** Receipt shown in modal after completing an OTC sale. */
export interface OtcReceiptLine {
  itemName: string;
  dosage: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  /** When false, line is listed on receipt but not billed. */
  given?: boolean;
  statusNote?: string;
}

export interface OtcReceiptData {
  saleNo: string;
  saleDateLabel: string;
  saleTimeLabel: string;
  facilityName: string;
  patientName?: string;
  receivedBy: string;
  paymentMethod: string;
  notes: string;
  /** When false, receipt shows item / qty / amount only (quantity-only sale). */
  includePrescribing: boolean;
  lines: OtcReceiptLine[];
  subtotal: number;
  amountReceived: number;
  changeDue: number;
}

@Component({
  selector: 'app-otc-dispensary',
  templateUrl: './otc-dispensary.component.html',
  styleUrls: ['./otc-dispensary.component.css'],
})
export class OtcDispensaryComponent implements OnInit, OnDestroy {
  @ViewChild('otcTreatmentForm') otcTreatmentForm?: NgForm;
  @ViewChild('otcCartScroll') otcCartScroll?: ElementRef<HTMLElement>;
  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;

  isDarkMode = false;
  isLoadingDrugList = false;
  processing = false;
  private statusBannerTimer: ReturnType<typeof setTimeout> | null = null;
  /** Debounced PUT update-treatmentRequest when pharmacy edits Rx qty. */
  private rxQtyPersistTimers = new Map<number, ReturnType<typeof setTimeout>>();
  responseMessage = '';
  responseColor = '';
  showStatusBanner = false;

  itemList: any[] = [];
  /** All stores — used to show full distribution on each batch line. */
  storeList: any[] = [];
  allStockBatchesCache: any[] = [];
  groupedStockItems: {
    itemKey: string;
    stockItemName: string;
    completelyOutOfStock: boolean;
    batchLines: {
      batchKey: string;
      batchLabel: string;
      expiryLabel: string;
      expiryTone: 'danger' | 'warning' | 'safe' | 'unknown';
      totalStock: number;
      unitCost: number;
      sellingModels: BatchSellingModel[];
      storeDistribution: {
        storeId: number;
        storeName: string;
        qtyLabel: string;
        storeLabel: string;
        item: any | null;
      }[];
    }[];
  }[] = [];
  cart: OtcCartLine[] = [];
  searchText = '';
  otcDrugDropdownOpen = false;
  pharmacyStoreName = '';

  currentItem: string | null = 'Choose Treatment';
  currentItemFullLabel = '';
  /** Plain drug name for cart / tables (no batch or qty). */
  currentStockItemName = '';
  currentItemId: number | null = null;
  currentStockBatchId: number | null = null;
  /** From business settings — stock batches (default) vs shop items. */
  pharmacyUseStockBatch = true;
  selectedUnitSellingModelId: number | null = null;
  availableQuantity = 0;
  unitBuy = 0;
  unitOfMeasure = '';
  itemSellingPrice = 0;
  lastUnitValue = 1;

  currentTreatmentRequested: any = this.defaultTreatmentForm();

  paymentMethod = 'Cash At Hand';
  amountReceived: number | null = null;
  saleNotes = 'OTC counter sale';

  /** 'prescribing' shows dosage/frequency/duration; 'simple' is quantity-only counter sale. */
  otcSaleMode: 'prescribing' | 'simple' = 'simple';

  activeMainTab: 'counter' | 'sold' | 'prescriptions' = 'counter';

  /** Sales history (OTC counter + doctor prescriptions). */
  filterDateFrom = '';
  filterDateTo = '';
  salesHistoryDrugSearch = '';
  /** Filter Items sold by logged-in staff who completed the sale. */
  salesHistoryStaffFilter = '';
  /** Client-side filter on Items sold: '' = all, OTC, or RX. */
  salesHistorySourceFilter: '' | 'OTC' | 'RX' = '';
  loadingSalesHistory = false;
  salesHistoryError = '';
  soldRows: OtcSoldRow[] = [];
  soldOrders: PharmacySoldOrder[] = [];

  showOrderDetailsModal = false;
  selectedSoldOrder: PharmacySoldOrder | null = null;
  deletingSoldLineId: number | null = null;
  showDeleteSoldLineConfirm = false;
  deleteSoldLineTarget: { row: OtcSoldRow; order: PharmacySoldOrder } | null = null;
  userRole = '';

  loadingDoctorPrescriptions = false;
  doctorPrescriptionsError = '';
  doctorPrescriptionRows: DoctorPrescriptionRow[] = [];
  openingPrescriptionVisitId: number | null = null;
  selectedPrescriptionVisitId: number | null = null;
  /** Rows for the visit currently open in the details panel (set directly on Details click). */
  selectedPrescriptionDetailRows: DoctorPrescriptionRow[] = [];
  prescriptionSundriesLoading = false;
  prescriptionSundriesRows: any[] = [];
  rxPaymentMethod = 'Cash At Hand';
  rxAmountReceived: number | null = null;
  rxSaleNotes = 'Pharmacy prescription sale';
  showRxQueueModal = false;
  rxQueueSaving = false;
  rxQueueError = '';
  rxQueueClinics: { id?: number; name?: string }[] = [];
  rxQueuePatientGroups: { id?: number; groupName?: string }[] = [];
  rxQueueTarget: {
    visitId: number;
    visitNumber: number;
    patientName: string;
    patientId: number;
  } | null = null;
  rxQueueForm: {
    fromModuleId: number | null;
    toModuleId: number | null;
    clinicId: number | null;
    note: string;
    visitDefaultScheme: string;
    patientGroupId: number | null;
    emergency: boolean;
    revisit: boolean;
    printQueueTicket: boolean;
  } = {
    fromModuleId: null,
    toModuleId: null,
    clinicId: null,
    note: '',
    visitDefaultScheme: '',
    patientGroupId: null,
    emergency: false,
    revisit: false,
    printQueueTicket: false,
  };
  hospitalModules: { id?: number; name?: string; code?: string; routeKey?: string }[] = [];
  pharmacyModuleId: number | null = null;
  readonly isQueueDischargeDestination = isQueueDischargeDestination;

  get rxQueueDestinationModules(): { id?: number; name?: string; code?: string; routeKey?: string }[] {
    return queueDestinationOptions(this.hospitalModules);
  }

  /** Visits with a completed prescription sale — shown as Done until queued to the next station. */
  private completedPrescriptionVisitIds = new Set<number>();
  /** Snapshot of sold visit rows so Done patients stay visible after API reload. */
  private soldPrescriptionVisitSnapshots = new Map<number, DoctorPrescriptionRow[]>();

  /** Cached patient names / visit numbers for Items sold Rx orders (incl. legacy rows). */
  private soldOrderPatientNameCache = new Map<number, string>();
  private soldOrderVisitNumberCache = new Map<number, number>();
  private soldOrderPatientNameLoading = new Set<number>();

  showReceiptModal = false;
  receipt: OtcReceiptData | null = null;

  private pharmacyStoreId: number | null = null;

  /** Dropdown choices when dosage unit is empty or user changes selection. */
  readonly dosageUnitOptions: readonly string[] = DOSAGE_UNIT_SELECT_OPTIONS;

  constructor(
    private themeService: ThemeService,
    private api: ApiService,
    private facilityBranding: FacilityBrandingService,
    private router: Router,
    private pharmacyVisitSync: PharmacyVisitSyncService,
    private accessControl: AccessControlService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {}

  facilityLogoUrl = 'assets/images/logo.jpg';

  ngOnInit(): void {
    this.userRole = (sessionStorage.getItem('userrole') || '').toString().trim();
    this.themeService.isDarkMode$.subscribe((isDark) => (this.isDarkMode = isDark));
    this.applyOtcSaleModeFromBusinessSettings();
    this.facilityBranding.load().subscribe({
      next: () => {
        this.facilityLogoUrl = this.facilityBranding.getLogoUrlForDisplay();
        this.facilityBranding.loadLogoDataUrl();
        this.applyOtcSaleModeFromBusinessSettings();
      },
      error: () => {
        this.facilityLogoUrl = this.facilityBranding.getLogoUrlForDisplay();
        this.applyOtcSaleModeFromBusinessSettings();
      },
    });
    this.loadPharmacyStock();
    this.loadSalesHistoryLast7Days();
  }

  ngOnDestroy(): void {
    if (this.statusBannerTimer) {
      clearTimeout(this.statusBannerTimer);
      this.statusBannerTimer = null;
    }
    for (const timer of this.rxQtyPersistTimers.values()) {
      clearTimeout(timer);
    }
    this.rxQtyPersistTimers.clear();
  }

  /** Default OTC sale mode from facility business settings (staff may override on this page). */
  private applyOtcSaleModeFromBusinessSettings(): void {
    this.otcSaleMode = this.facilityBranding.getOtcIncludePrescribing()
      ? 'prescribing'
      : 'simple';
    const nextUseStockBatch = this.facilityBranding.getPharmacyUseStockBatch();
    const modeChanged = nextUseStockBatch !== this.pharmacyUseStockBatch;
    this.pharmacyUseStockBatch = nextUseStockBatch;
    if (modeChanged) {
      this.clearCurrentTreatmentSelection();
      this.loadPharmacyStock();
    }
  }

  private clearCurrentTreatmentSelection(): void {
    this.currentItem = 'Choose Treatment';
    this.currentItemFullLabel = '';
    this.currentStockItemName = '';
    this.currentItemId = null;
    this.currentStockBatchId = null;
    this.selectedUnitSellingModelId = null;
    this.availableQuantity = 0;
    this.unitBuy = 0;
    this.itemSellingPrice = 0;
  }

  setMainTab(tab: 'counter' | 'sold' | 'prescriptions'): void {
    this.activeMainTab = tab;
    if (tab === 'sold') {
      this.loadSalesHistory();
    } else if (tab === 'prescriptions') {
      this.loadDoctorPrescriptions();
    }
  }

  filteredSoldOrders(): PharmacySoldOrder[] {
    let orders = this.soldOrders;
    if (this.salesHistorySourceFilter) {
      orders = orders.filter((order) => order.saleSource === this.salesHistorySourceFilter);
    }
    const staff = (this.salesHistoryStaffFilter || '').trim().toLowerCase();
    if (staff) {
      orders = orders.filter((order) =>
        this.soldOrderStaffLabel(order).toLowerCase() === staff
      );
    }
    const q = (this.salesHistoryDrugSearch || '').trim().toLowerCase();
    if (!q) {
      return orders;
    }
    return orders.filter((order) => this.orderMatchesSearch(order, q));
  }

  get salesHistoryStaffOptions(): string[] {
    const seen = new Set<string>();
    const options: string[] = [];
    for (const order of this.soldOrders) {
      const label = this.soldOrderStaffLabel(order);
      if (!label || label === '—') {
        continue;
      }
      const key = label.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        options.push(label);
      }
    }
    return options.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }

  get hasSoldHistoryClientFilters(): boolean {
    return (
      !!this.salesHistoryDrugSearch.trim() ||
      !!this.salesHistorySourceFilter ||
      !!this.salesHistoryStaffFilter.trim()
    );
  }

  soldOrderStaffLabel(order: PharmacySoldOrder | null | undefined): string {
    const value = (order?.receivedBy || '').trim();
    return value || '—';
  }

  private loggedInStaffName(): string {
    const username = (sessionStorage.getItem('username') || '').trim();
    const email = (sessionStorage.getItem('useremail') || '').trim();
    return username || email || 'Counter';
  }

  private orderMatchesSearch(order: PharmacySoldOrder, q: string): boolean {
    const orderHay = [
      order.orderNo,
      order.patientName,
      order.saleSource,
      order.visitDate,
      order.receivedBy,
    ]
      .map((v) => String(v ?? '').toLowerCase())
      .join(' ');
    if (orderHay.includes(q)) {
      return true;
    }
    return order.lines.some((row) =>
      [row.itemName, row.patientName, row.saleNo]
        .map((v) => String(v ?? '').toLowerCase())
        .join(' ')
        .includes(q)
    );
  }

  openSoldOrderDetails(order: PharmacySoldOrder): void {
    this.selectedSoldOrder = order;
    this.showOrderDetailsModal = true;
    this.ensureSoldOrderPatientName(order);
  }

  closeSoldOrderDetailsModal(): void {
    this.showOrderDetailsModal = false;
    this.selectedSoldOrder = null;
    this.deletingSoldLineId = null;
  }

  requestDeleteSoldLine(row: OtcSoldRow, order: PharmacySoldOrder): void {
    if (!this.isMdUser()) {
      this.flashStatus('Only MD can delete sold item lines.', true);
      return;
    }
    if (this.deletingSoldLineId != null) {
      return;
    }
    const lineId = this.resolveSoldLineDeleteId(row);
    if (!lineId) {
      this.flashStatus('Cannot delete this line — missing id.', true);
      return;
    }
    this.deleteSoldLineTarget = { row, order };
    this.showDeleteSoldLineConfirm = true;
  }

  closeDeleteSoldLineConfirm(): void {
    if (this.deletingSoldLineId != null) {
      return;
    }
    this.showDeleteSoldLineConfirm = false;
    this.deleteSoldLineTarget = null;
  }

  confirmDeleteSoldLine(): void {
    const target = this.deleteSoldLineTarget;
    if (!target || this.deletingSoldLineId != null) {
      return;
    }
    this.deleteSoldLine(target.row, target.order);
  }

  isDeletingSoldRow(row: OtcSoldRow): boolean {
    const lineId = this.resolveSoldLineDeleteId(row);
    return lineId > 0 && this.deletingSoldLineId === lineId;
  }

  deleteSoldLineTargetLabel(): string {
    return (this.deleteSoldLineTarget?.row.itemName || 'this item').toUpperCase();
  }

  deleteSoldLineTargetQty(): number {
    return this.num(this.deleteSoldLineTarget?.row.quantity);
  }

  deleteSoldLineTargetRemovesOrder(): boolean {
    const target = this.deleteSoldLineTarget;
    return !!target && target.order.lines.length <= 1;
  }

  private deleteSoldLine(row: OtcSoldRow, order: PharmacySoldOrder): void {
    const lineId = this.resolveSoldLineDeleteId(row);
    if (!lineId) {
      this.flashStatus('Cannot delete this line — missing id.', true);
      return;
    }

    this.deletingSoldLineId = lineId;
    this.api.deletePharmacySoldLine(lineId, row.saleSource).subscribe({
      next: () => {
        this.deletingSoldLineId = null;
        this.showDeleteSoldLineConfirm = false;
        this.deleteSoldLineTarget = null;
        this.removeSoldLineFromState(row, order);
        this.loadPharmacyStock();
        this.loadDoctorPrescriptions();
        this.flashStatus('Sold line removed and stock restored. DSP cleared when fully reversed.', false);
      },
      error: (err) => {
        this.deletingSoldLineId = null;
        this.flashStatus(
          this.extractApiErrorMessage(err, 'Failed to delete sold line.'),
          true
        );
      },
    });
  }

  private removeSoldLineFromState(row: OtcSoldRow, order: PharmacySoldOrder): void {
    const rowKey = this.soldRowKey(row);
    const orderKey = order.orderKey;

    this.soldRows = this.soldRows.filter((line) => this.soldRowKey(line) !== rowKey);

    const orderIndex = this.soldOrders.findIndex((item) => item.orderKey === orderKey);
    if (orderIndex < 0) {
      if (this.selectedSoldOrder?.orderKey === orderKey) {
        this.closeSoldOrderDetailsModal();
      }
      return;
    }

    const remainingLines = this.soldOrders[orderIndex].lines.filter(
      (line) => this.soldRowKey(line) !== rowKey
    );

    if (!remainingLines.length) {
      this.soldOrders = this.soldOrders.filter((item) => item.orderKey !== orderKey);
      if (this.selectedSoldOrder?.orderKey === orderKey) {
        this.closeSoldOrderDetailsModal();
      }
      return;
    }

    const updatedOrder: PharmacySoldOrder = {
      ...this.soldOrders[orderIndex],
      lines: remainingLines,
      lineCount: remainingLines.length,
      totalCost: remainingLines.reduce(
        (sum, line) => sum + this.num(line.quantity) * this.num(line.unitBuy),
        0
      ),
      totalSell: remainingLines.reduce((sum, line) => sum + this.num(line.totalAmount), 0),
    };

    this.soldOrders = [
      ...this.soldOrders.slice(0, orderIndex),
      updatedOrder,
      ...this.soldOrders.slice(orderIndex + 1),
    ];

    if (this.selectedSoldOrder?.orderKey === orderKey) {
      this.selectedSoldOrder = updatedOrder;
    }
  }

  private resolveSoldLineDeleteId(row: OtcSoldRow): number {
    if (row.saleSource === 'RX') {
      return row.lineId > 0 ? row.lineId : row.saleId;
    }
    return row.lineId > 0 ? row.lineId : 0;
  }

  private soldRowKey(row: OtcSoldRow): string {
    const deleteId = this.resolveSoldLineDeleteId(row);
    return `${row.saleSource}:${row.saleId}:${deleteId}`;
  }

  orderSourceLabel(order: PharmacySoldOrder): string {
    return order.saleSource === 'RX' ? 'Rx' : 'OTC';
  }

  orderSourceBadgeClass(order: PharmacySoldOrder): string {
    return order.saleSource === 'RX' ? 'sale-source-rx' : 'sale-source-otc';
  }

  soldOrderDrugCountLabel(order: PharmacySoldOrder): string {
    const count = order.lineCount;
    return count === 1 ? '1 drug' : `${count} drugs`;
  }

  soldOrderSummaryText(order: PharmacySoldOrder): string {
    const drugs = this.soldOrderDrugCountLabel(order);
    const client = this.soldOrderPatientName(order);
    if (client) {
      return `${client} · ${drugs}`;
    }
    if (this.orderLooksLikeRx(order)) {
      const visit = this.soldOrderVisitNumber(order);
      if (visit != null) {
        return `Visit ${visit} · ${drugs}`;
      }
      return drugs;
    }
    return `Counter sale · ${drugs}`;
  }

  orderTotalQty(order: PharmacySoldOrder): number {
    return order.lines.reduce((s, r) => s + this.num(r.quantity), 0);
  }

  /** Visit display number for prescription (Rx) sold orders. */
  soldOrderVisitNumber(order: PharmacySoldOrder): number | null {
    if (!this.orderLooksLikeRx(order)) {
      return null;
    }
    const visitNumber = Number(order.visitNumber);
    if (Number.isFinite(visitNumber) && visitNumber > 0) {
      return visitNumber;
    }
    const visitId = this.soldOrderResolveVisitId(order);
    if (visitId != null && this.soldOrderVisitNumberCache.has(visitId)) {
      return this.soldOrderVisitNumberCache.get(visitId)!;
    }
    if (visitId != null) {
      return visitId;
    }
    return null;
  }

  soldOrderPatientName(order: PharmacySoldOrder): string {
    const fromOrder = (order.patientName || '').trim();
    if (fromOrder) {
      return fromOrder;
    }
    for (const line of order.lines) {
      const name = (line.patientName || '').trim();
      if (name) {
        return name;
      }
    }
    const visitId = this.soldOrderResolveVisitId(order);
    if (visitId != null) {
      const cached = this.soldOrderPatientNameCache.get(visitId);
      if (cached) {
        return cached;
      }
    }
    return '';
  }

  orderLooksLikeRx(order: PharmacySoldOrder): boolean {
    if (order.saleSource === 'RX') {
      return true;
    }
    if (this.soldOrderResolveVisitId(order) != null) {
      return true;
    }
    if (/^VISIT[-_\s]?\d+/i.test(String(order.orderNo ?? ''))) {
      return true;
    }
    return order.lines.some(
      (line) => line.saleSource === 'RX' || (line.visitId != null && line.visitId > 0)
    );
  }

  soldOrderResolveVisitId(order: PharmacySoldOrder): number | null {
    const fromOrder = Number(order.visitId);
    if (Number.isFinite(fromOrder) && fromOrder > 0) {
      return fromOrder;
    }
    for (const line of order.lines) {
      const fromLine = Number(line.visitId);
      if (Number.isFinite(fromLine) && fromLine > 0) {
        return fromLine;
      }
    }
    return null;
  }

  private soldOrderResolveVisitNumber(order: PharmacySoldOrder): number | null {
    const visitNumber = Number(order.visitNumber);
    if (Number.isFinite(visitNumber) && visitNumber > 0) {
      return visitNumber;
    }
    for (const line of order.lines) {
      const n = Number(line.visitNumber);
      if (Number.isFinite(n) && n > 0) {
        return n;
      }
    }
    return null;
  }

  private parseVisitIdFromLabel(value: string | null | undefined): number | null {
    const raw = String(value ?? '').trim();
    if (!raw) {
      return null;
    }
    const visitMatch = /^VISIT[-_\s#]?(\d+)/i.exec(raw);
    if (visitMatch) {
      const id = Number(visitMatch[1]);
      return Number.isFinite(id) && id > 0 ? id : null;
    }
    return null;
  }

  private ensureSoldOrderPatientName(order: PharmacySoldOrder): void {
    if (!this.orderLooksLikeRx(order) || this.soldOrderPatientName(order)) {
      return;
    }
    this.requestSoldOrderPatientEnrichment(order);
  }

  private enrichSoldOrdersMissingPatientNames(orders: PharmacySoldOrder[]): void {
    for (const order of orders) {
      this.ensureSoldOrderPatientName(order);
    }
  }

  private requestSoldOrderPatientEnrichment(order: PharmacySoldOrder): void {
    const visitId = this.soldOrderResolveVisitId(order);
    const visitNumber = this.soldOrderResolveVisitNumber(order);
    const cacheKey = visitId ?? (visitNumber != null ? -visitNumber : null);
    if (cacheKey == null) {
      return;
    }
    if (visitId != null && this.soldOrderPatientNameCache.has(visitId)) {
      this.applySoldOrderPatientEnrichment(visitId, this.soldOrderPatientNameCache.get(visitId)!, this.soldOrderVisitNumberCache.get(visitId) ?? 0);
      return;
    }
    if (this.soldOrderPatientNameLoading.has(cacheKey)) {
      return;
    }
    this.soldOrderPatientNameLoading.add(cacheKey);
    this.fetchSoldOrderPatientByVisit(visitId, visitNumber, order.visitDate).subscribe({
      next: ({ patientName, visitNumber: resolvedVisitNumber, visitId: resolvedVisitId }) => {
        this.soldOrderPatientNameLoading.delete(cacheKey);
        const id = resolvedVisitId || visitId;
        if (id != null && patientName) {
          this.soldOrderPatientNameCache.set(id, patientName);
        }
        if (id != null && resolvedVisitNumber > 0) {
          this.soldOrderVisitNumberCache.set(id, resolvedVisitNumber);
        }
        if (id != null) {
          this.applySoldOrderPatientEnrichment(id, patientName, resolvedVisitNumber);
        }
      },
      error: () => {
        this.soldOrderPatientNameLoading.delete(cacheKey);
      },
    });
  }

  private applySoldOrderPatientEnrichment(
    visitId: number,
    patientName: string,
    visitNumber: number
  ): void {
    if (!patientName && visitNumber <= 0 && visitId <= 0) {
      return;
    }
    for (const order of this.soldOrders) {
      if (!this.orderMatchesVisitEnrichment(order, visitId, visitNumber)) {
        continue;
      }
      if (patientName && !order.patientName) {
        order.patientName = patientName;
      }
      if (visitNumber > 0) {
        order.visitNumber = visitNumber;
      }
      order.visitId = order.visitId ?? visitId;
      if (order.saleSource !== 'RX' && this.orderLooksLikeRx(order)) {
        order.saleSource = 'RX';
      }
      for (const line of order.lines) {
        if (patientName && !line.patientName) {
          line.patientName = patientName;
        }
        if (visitNumber > 0 && !line.visitNumber) {
          line.visitNumber = visitNumber;
        }
        line.visitId = line.visitId ?? visitId;
      }
    }
    this.soldOrders = [...this.soldOrders];
    if (this.selectedSoldOrder) {
      if (this.orderMatchesVisitEnrichment(this.selectedSoldOrder, visitId, visitNumber)) {
        if (patientName && !this.selectedSoldOrder.patientName) {
          this.selectedSoldOrder.patientName = patientName;
        }
        if (visitNumber > 0) {
          this.selectedSoldOrder.visitNumber = visitNumber;
        }
        if (visitId > 0) {
          this.selectedSoldOrder.visitId = this.selectedSoldOrder.visitId ?? visitId;
        }
      }
    }
  }

  private orderMatchesVisitEnrichment(
    order: PharmacySoldOrder,
    visitId: number,
    visitNumber: number
  ): boolean {
    const orderVisitId = this.soldOrderResolveVisitId(order);
    if (visitId > 0 && orderVisitId === visitId) {
      return true;
    }
    if (visitNumber > 0) {
      const orderVisitNumber = this.soldOrderResolveVisitNumber(order);
      if (orderVisitNumber === visitNumber || Number(order.visitNumber) === visitNumber) {
        return true;
      }
    }
    return false;
  }

  private fetchSoldOrderPatientByVisit(
    visitId: number | null,
    visitNumber: number | null,
    visitDate: string
  ): Observable<{ patientName: string; visitNumber: number; visitId: number }> {
    if (visitId != null && visitId > 0) {
      return this.api.getPatientVisitByVisitId(visitId).pipe(
        map((visit) => this.mapVisitPatientLookup(visit, visitId)),
        switchMap((result) => {
          if (result.patientName) {
            return of(result);
          }
          if (visitNumber != null && visitNumber > 0) {
            return this.fetchSoldOrderPatientByVisitNumber(visitNumber, visitDate, visitId);
          }
          return of(result);
        }),
        catchError(() => {
          if (visitNumber != null && visitNumber > 0) {
            return this.fetchSoldOrderPatientByVisitNumber(visitNumber, visitDate, visitId);
          }
          return of({ patientName: '', visitNumber: visitNumber ?? 0, visitId: visitId ?? 0 });
        })
      );
    }
    if (visitNumber != null && visitNumber > 0) {
      return this.fetchSoldOrderPatientByVisitNumber(visitNumber, visitDate, null);
    }
    return of({ patientName: '', visitNumber: 0, visitId: 0 });
  }

  private fetchSoldOrderPatientByVisitNumber(
    visitNumber: number,
    visitDate: string,
    fallbackVisitId: number | null
  ): Observable<{ patientName: string; visitNumber: number; visitId: number }> {
    const date = (visitDate || '').trim();
    const from = date || this.filterDateFrom || this.getLast7DaysRange().from;
    const to = date || this.filterDateTo || this.getLast7DaysRange().to;
    return this.api.filterVisits({ datefrom: from, dateto: to }).pipe(
      map((visits) => {
        const list = Array.isArray(visits) ? visits : [];
        const match =
          list.find((v) => Number(v?.visitNumber ?? v?.visit_number) === visitNumber) ??
          list.find((v) => Number(v?.id ?? v?.visitId) === fallbackVisitId);
        if (!match) {
          return {
            patientName: '',
            visitNumber,
            visitId: fallbackVisitId ?? 0,
          };
        }
        return this.mapVisitPatientLookup(
          match,
          fallbackVisitId ?? (Number(match?.id ?? match?.visitId) || 0)
        );
      }),
      catchError(() =>
        of({ patientName: '', visitNumber, visitId: fallbackVisitId ?? 0 })
      )
    );
  }

  private mapVisitPatientLookup(
    visit: any,
    fallbackVisitId: number
  ): { patientName: string; visitNumber: number; visitId: number } {
    const patientName = this.extractPatientNameFromVisit(visit);
    const visitNumber = this.extractVisitNumberFromVisit(visit);
    const visitId = Number(visit?.id ?? visit?.visitId ?? fallbackVisitId) || fallbackVisitId;
    return {
      patientName,
      visitNumber: visitNumber > 0 ? visitNumber : 0,
      visitId: visitId > 0 ? visitId : 0,
    };
  }

  private extractPatientNameFromVisit(visit: any): string {
    if (!visit || typeof visit !== 'object') {
      return '';
    }
    const direct = String(visit.patientName ?? visit.patient_name ?? '').trim();
    if (direct) {
      return this.formatDisplayName(direct);
    }
    const first = String(visit.patientFirstName ?? visit.patient_first_name ?? '').trim();
    const second = String(visit.patientSecondName ?? visit.patient_second_name ?? '').trim();
    const combined = `${first} ${second}`.trim();
    if (combined) {
      return this.formatDisplayName(combined);
    }
    const nested = visit.patient ?? visit.patientVisit ?? visit.visit;
    if (nested && typeof nested === 'object' && nested !== visit) {
      return this.extractPatientNameFromVisit(nested);
    }
    return '';
  }

  private extractVisitNumberFromVisit(visit: any): number {
    const n = Number(visit?.visitNumber ?? visit?.visit_number);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  private resolveHistoryRowPatientName(row: any): string {
    const direct = row?.patientName ?? row?.patient_name;
    if (direct != null && String(direct).trim()) {
      return String(direct).trim();
    }
    const first = String(row?.patientFirstName ?? row?.patient_first_name ?? '').trim();
    const second = String(row?.patientSecondName ?? row?.patient_second_name ?? '').trim();
    const combined = `${first} ${second}`.trim();
    if (combined) {
      return combined;
    }
    const fromVisit = this.extractPatientNameFromVisit(row?.visit ?? row?.patientVisit);
    if (fromVisit) {
      return fromVisit;
    }
    return this.extractPatientNameFromVisit(row?.patient);
  }

  private resolveHistoryRowVisitId(row: any): number | null {
    const id = Number(row?.visitId ?? row?.visit_id ?? row?.patientVisitId);
    if (Number.isFinite(id) && id > 0) {
      return id;
    }
    return null;
  }

  private resolveHistoryRowSaleSource(row: any): 'OTC' | 'RX' {
    const explicit = String(row?.saleSource ?? row?.sale_source ?? '').toUpperCase();
    if (explicit === 'RX') {
      return 'RX';
    }
    if (explicit === 'OTC') {
      return 'OTC';
    }
    if (this.resolveHistoryRowVisitId(row) != null) {
      return 'RX';
    }
    return 'OTC';
  }

  selectedPrescriptionGroup(): {
    visitId: number;
    visitNumber: number;
    patientName: string;
    visitDate: string;
    visitTime: string;
    rows: DoctorPrescriptionRow[];
  } | null {
    if (this.selectedPrescriptionVisitId == null) {
      return null;
    }
    return (
      this.groupedPrescriptionVisits().find(
        (g) => g.visitId === this.selectedPrescriptionVisitId
      ) ?? null
    );
  }

  selectedPrescriptionRows(): DoctorPrescriptionRow[] {
    if (this.selectedPrescriptionDetailRows.length) {
      return this.selectedPrescriptionDetailRows;
    }
    if (this.selectedPrescriptionVisitId == null) {
      return [];
    }
    return this.doctorPrescriptionRows.filter(
      (r) => r.visitId === this.selectedPrescriptionVisitId
    );
  }

  billablePrescriptionRows(): DoctorPrescriptionRow[] {
    return this.dispensablePrescriptionRows();
  }

  selectPrescriptionVisit(visitId: number, detailRows?: DoctorPrescriptionRow[]): void {
    this.selectedPrescriptionVisitId = visitId;
    const group = this.selectedPrescriptionGroup();
    const rows =
      detailRows?.length
        ? detailRows
        : group?.rows?.length
          ? group.rows
          : this.doctorPrescriptionRows.filter((r) => r.visitId === visitId);
    this.selectedPrescriptionDetailRows = rows;
    if (group) {
      this.rxSaleNotes = `Pharmacy prescription sale — ${group.patientName}`;
      if (group.rows.some((r) => this.prescriptionRowHasPrescribing(r))) {
        this.otcSaleMode = 'prescribing';
      }
      this.applyPrescriptionStockAvailability(group.rows);
    }
    this.loadPrescriptionSundriesForSelectedVisit();
    this.syncRxAmountReceivedToSubtotal();
    this.cdr.detectChanges();
  }

  prescriptionSundryQty(row: any): number {
    return Number(row?.quantityUsed ?? row?.quantity ?? row?.qty ?? 0) || 0;
  }

  prescriptionSundryUnitCost(row: any): number {
    return Number(row?.unitCostPrice ?? row?.unitCost ?? 0) || 0;
  }

  prescriptionSundryUnitSell(row: any): number {
    return Number(row?.unitSellingPrice ?? row?.unitSell ?? 0) || 0;
  }

  prescriptionSundryTotalCost(row: any): number {
    return this.prescriptionSundryQty(row) * this.prescriptionSundryUnitCost(row);
  }

  prescriptionSundryTotalSell(row: any): number {
    const explicit = Number(row?.lineTotal ?? row?.totalSell ?? row?.amount ?? 0);
    if (Number.isFinite(explicit) && explicit > 0) {
      return explicit;
    }
    return this.prescriptionSundryQty(row) * this.prescriptionSundryUnitSell(row);
  }

  selectPrescriptionVisitCard(
    group: {
      visitId: number;
      patientName: string;
      rows: DoctorPrescriptionRow[];
    },
    event?: Event
  ): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.ngZone.run(() => {
      this.selectPrescriptionVisit(group.visitId, group.rows);
      this.cdr.detectChanges();
    });
  }

  viewPrescriptionVisitDetails(
    group: {
      visitId: number;
      patientName: string;
      rows: DoctorPrescriptionRow[];
    },
    event?: Event
  ): void {
    this.selectPrescriptionVisitCard(group, event);
  }

  openRxQueueModal(
    group: {
      visitId: number;
      visitNumber: number;
      patientName: string;
      rows: DoctorPrescriptionRow[];
    },
    event?: Event
  ): void {
    event?.preventDefault();
    event?.stopPropagation();
    const row = group.rows?.[0];
    const patientId = Number(row?.patientId);
    if (!Number.isFinite(patientId) || patientId <= 0) {
      this.flashStatus('Patient not found for this prescription visit.', true);
      return;
    }
    this.rxQueueTarget = {
      visitId: group.visitId,
      visitNumber: group.visitNumber,
      patientName: group.patientName,
      patientId,
    };
    this.rxQueueError = '';
    this.rxQueueClinics = [];
    this.ensureHospitalModulesForQueue(() => {
      this.rxQueueForm = {
        fromModuleId: this.pickRxQueueFromModuleId(),
        toModuleId: null,
        clinicId: null,
        note: `Pharmacy prescription — ${group.patientName}`,
        visitDefaultScheme: '',
        patientGroupId: null,
        emergency: false,
        revisit: false,
        printQueueTicket: false,
      };
      this.loadRxQueuePatientGroups();
      this.showRxQueueModal = true;
      document.body.style.overflow = 'hidden';
    });
  }

  closeRxQueueModal(): void {
    this.showRxQueueModal = false;
    this.rxQueueTarget = null;
    this.rxQueueError = '';
    this.rxQueueClinics = [];
    document.body.style.overflow = '';
  }

  onRxQueueToModuleChange(): void {
    this.rxQueueForm.clinicId = null;
    if (isQueueDischargeDestination(this.rxQueueForm.toModuleId)) {
      this.rxQueueClinics = [];
      return;
    }
    if (!this.rxQueueForm.toModuleId) {
      this.rxQueueClinics = [];
      return;
    }
    this.api.getHospitalClinics(this.rxQueueForm.toModuleId).subscribe({
      next: (res: any) => {
        const all = Array.isArray(res) ? res : [];
        this.rxQueueClinics = all.filter((c: any) => c.active !== false);
      },
      error: () => {
        this.rxQueueClinics = [];
      },
    });
  }

  onRxQueueSchemeChange(): void {
    const g = this.rxQueuePatientGroups.find(
      (x) => x.id === this.rxQueueForm.patientGroupId
    );
    this.rxQueueForm.visitDefaultScheme = g?.groupName || '';
  }

  private loadRxQueuePatientGroups(): void {
    if (this.rxQueuePatientGroups.length) {
      return;
    }
    this.api.getPatientGroupList().subscribe({
      next: (res: any) => {
        this.rxQueuePatientGroups = Array.isArray(res) ? res : [];
      },
      error: () => {
        this.rxQueuePatientGroups = [];
      },
    });
  }

  rxQueuePatientSurname(): string {
    return this.splitRxQueuePatientName().surname;
  }

  rxQueuePatientOtherNames(): string {
    return this.splitRxQueuePatientName().otherNames;
  }

  private splitRxQueuePatientName(): { surname: string; otherNames: string } {
    const raw = (this.rxQueueTarget?.patientName || '').trim();
    if (!raw) {
      return { surname: '—', otherNames: '—' };
    }
    const parts = raw.split(/\s+/);
    if (parts.length === 1) {
      return { surname: parts[0], otherNames: '—' };
    }
    return {
      surname: parts[parts.length - 1],
      otherNames: parts.slice(0, -1).join(' '),
    };
  }

  submitRxQueue(): void {
    if (!this.rxQueueTarget) {
      return;
    }
    const fromModuleId = Number(this.rxQueueForm.fromModuleId);
    const toModuleId = Number(this.rxQueueForm.toModuleId);
    if (!Number.isFinite(fromModuleId) || fromModuleId <= 0 || !Number.isFinite(toModuleId)) {
      this.rxQueueError = 'Select both From and destination.';
      return;
    }
    if (!isQueueDischargeDestination(toModuleId) && fromModuleId === toModuleId) {
      this.rxQueueError = 'From and To departments must be different.';
      return;
    }
    const visitId = this.rxQueueTarget.visitId;
    const pharmacyId = this.resolvePharmacyModuleId();
    const username = sessionStorage.getItem('username') || '';
    this.rxQueueSaving = true;
    this.rxQueueError = '';

    if (isQueueDischargeDestination(toModuleId)) {
      this.completePharmacyQueueForVisit(visitId, pharmacyId)
        .pipe(
          switchMap(() =>
            this.api.dischargePatientFromQueue({
              patientId: this.rxQueueTarget!.patientId,
              note: String(this.rxQueueForm.note ?? '').trim() || 'Pharmacy discharge',
              dischargedBy: username,
            })
          )
        )
        .subscribe({
          next: () => {
            this.rxQueueSaving = false;
            this.removePrescriptionVisitFromTable(visitId);
            this.flashStatus('Patient discharged from queue.', false);
            this.closeRxQueueModal();
            this.loadDoctorPrescriptions();
          },
          error: (err: any) => {
            this.rxQueueSaving = false;
            this.rxQueueError = err?.error?.message || 'Failed to discharge patient.';
          },
        });
      return;
    }

    const scheme =
      this.rxQueueForm.visitDefaultScheme ||
      this.rxQueuePatientGroups.find((g) => g.id === this.rxQueueForm.patientGroupId)
        ?.groupName ||
      '';
    this.completePharmacyQueueForVisit(visitId, pharmacyId)
      .pipe(
        switchMap(() =>
          this.api.queuePatient({
            patientId: this.rxQueueTarget!.patientId,
            patientVisitId: visitId,
            fromModuleId,
            toModuleId,
            clinicId: this.rxQueueForm.clinicId ?? undefined,
            note: String(this.rxQueueForm.note ?? '').trim() || 'Pharmacy prescription',
            visitDefaultScheme: scheme,
            patientGroupId: this.rxQueueForm.patientGroupId ?? undefined,
            emergency: this.rxQueueForm.emergency,
            revisit: this.rxQueueForm.revisit,
            queuedBy: sessionStorage.getItem('username') || '',
          })
        )
      )
      .subscribe({
        next: (entry: any) => {
          this.rxQueueSaving = false;
          const ticket = entry?.queueNumber ? ` (${entry.queueNumber})` : '';
          if (this.rxQueueForm.printQueueTicket && entry?.queueNumber) {
            this.printRxQueueTicket(entry);
          }
          this.removePrescriptionVisitFromTable(visitId);
          this.flashStatus(`Patient queued successfully${ticket}.`, false);
          this.closeRxQueueModal();
          this.loadDoctorPrescriptions();
        },
        error: (err: any) => {
          this.rxQueueSaving = false;
          this.rxQueueError = err?.error?.message || 'Failed to queue patient.';
        },
      });
  }

  /** Close the active pharmacy queue board entry so the visit drops off the Rx table. */
  private completePharmacyQueueForVisit(
    visitId: number,
    pharmacyModuleId: number | null
  ): Observable<void> {
    if (pharmacyModuleId == null || visitId <= 0) {
      return of(undefined);
    }
    const activeStatuses = new Set(['WAITING', 'CALLED', 'SERVING']);
    return this.api.getPatientQueueEntries(pharmacyModuleId).pipe(
      map((res: any) => {
        const entries = Array.isArray(res) ? res : [];
        return entries.find(
          (e: any) =>
            Number(e.patientVisitId) === visitId &&
            activeStatuses.has(String(e.status ?? '').toUpperCase())
        );
      }),
      switchMap((entry: any) => {
        const entryId = Number(entry?.id);
        if (!Number.isFinite(entryId) || entryId <= 0) {
          return of(undefined);
        }
        return this.api.completePatientQueueEntry(entryId).pipe(
          map(() => undefined),
          catchError(() => of(undefined))
        );
      }),
      catchError(() => of(undefined))
    );
  }

  private printRxQueueTicket(entry: any): void {
    const target = this.rxQueueTarget;
    if (!target) {
      return;
    }
    const w = window.open('', '_blank', 'width=420,height=340');
    if (!w) {
      return;
    }
    w.document.write(`
      <html><head><title>Queue Ticket</title></head>
      <body style="font-family:sans-serif;padding:16px">
        <h2>Queue Ticket</h2>
        <p><strong>${entry.queueNumber || ''}</strong></p>
        <p>${target.patientName || ''}</p>
        <p>Visit: ${target.visitNumber || target.visitId}</p>
        <p>To: ${entry.toModuleName || ''}</p>
      </body></html>
    `);
    w.document.close();
    w.print();
  }

  private ensureHospitalModulesForQueue(done: () => void): void {
    const finish = () => {
      this.resolvePharmacyModuleId();
      done();
    };
    if (this.hospitalModules.length) {
      finish();
      return;
    }
    this.api.getAllHospitalModules().subscribe({
      next: (res: any) => {
        this.hospitalModules = normalizeHospitalModules(res);
        this.resolvePharmacyModuleId();
        done();
      },
      error: () => {
        this.hospitalModules = [];
        done();
      },
    });
  }

  /** Current pharmacy page module — used as default queue "From" department. */
  private resolvePharmacyModuleId(): number | null {
    if (this.pharmacyModuleId != null && this.pharmacyModuleId > 0) {
      return this.pharmacyModuleId;
    }
    const cached = getQueuePageModuleIdFromSession();
    if (cached != null) {
      this.pharmacyModuleId = cached;
      return cached;
    }
    const id = resolveModuleIdForUrl(this.router.url, this.hospitalModules);
    if (id != null) {
      this.pharmacyModuleId = id;
      applyQueuePageModuleToSession(id);
    }
    return id;
  }

  private pickRxQueueFromModuleId(): number | null {
    const pharmacyId = this.resolvePharmacyModuleId();
    return (
      ensureFromModuleInList(pharmacyId, this.hospitalModules, pharmacyId) ??
      pickDefaultFromModuleId(this.hospitalModules, pharmacyId)
    );
  }

  saleSourceLabel(row: OtcSoldRow): string {
    return row.saleSource === 'RX' ? 'Rx' : 'OTC';
  }

  saleSourceBadgeClass(row: OtcSoldRow): string {
    return row.saleSource === 'RX' ? 'sale-source-rx' : 'sale-source-otc';
  }

  get historyTotalQty(): number {
    return this.filteredSoldOrders().reduce(
      (s, o) => s + o.lines.reduce((ls, r) => ls + this.num(r.quantity), 0),
      0
    );
  }

  get historyTotalCost(): number {
    return this.filteredSoldOrders().reduce((s, o) => s + o.totalCost, 0);
  }

  get historyTotalSell(): number {
    return this.filteredSoldOrders().reduce((s, o) => s + o.totalSell, 0);
  }

  get historyTotalReceived(): number {
    return this.filteredSoldOrders().reduce((s, o) => s + this.num(o.amountReceived), 0);
  }

  get historyTotalBalance(): number {
    return this.filteredSoldOrders().reduce((s, o) => s + this.soldOrderBalance(o), 0);
  }

  soldOrderBalance(order: PharmacySoldOrder): number {
    const due =
      this.num(order.saleTotalAmount) > 0
        ? this.num(order.saleTotalAmount)
        : this.num(order.totalSell);
    const paid = this.num(order.amountReceived);
    return Math.max(0, due - paid);
  }

  get historyOrderCount(): number {
    return this.filteredSoldOrders().length;
  }

  get historyTotalProfit(): number {
    return this.historyTotalSell - this.historyTotalCost;
  }

  isMdUser(): boolean {
    const role = (this.userRole || sessionStorage.getItem('userrole') || '')
      .toString()
      .toLowerCase()
      .trim();
    return role === 'md';
  }

  /** Profit on Items sold summary — MD only when component access allows. */
  get canViewSoldHistoryProfit(): boolean {
    return this.isMdUser() && this.canViewSoldSummaryFooter() && this.canViewPharmacyCostColumns();
  }

  /** Unit cost, TT cost, and total cost fields across pharmacy tabs and modals. */
  canViewPharmacyCostColumns(): boolean {
    return this.accessControl.canViewPageComponent('otc-dispensary', 'cost-columns');
  }

  /** Cost / TT cost columns in sell details popup. */
  canViewSoldOrderModalCostColumns(order: PharmacySoldOrder | null | undefined): boolean {
    return this.canViewPharmacyCostColumns();
  }

  /** Footer row in sell details popup when any financial column is visible. */
  canViewSoldOrderModalFooter(order: PharmacySoldOrder | null | undefined): boolean {
    return this.canViewSoldOrderModalCostColumns(order) || this.canViewSoldOrderModalFinancials(order);
  }

  /** Lower totals bar on Items sold tab. */
  canViewSoldSummaryFooter(): boolean {
    return this.accessControl.canViewPageComponent('otc-dispensary', 'sold-summary-footer');
  }

  /** Total cost / total sell columns in sold orders table. */
  canViewSoldTableCostSell(): boolean {
    return this.accessControl.canViewPageComponent('otc-dispensary', 'sold-table-cost-sell');
  }

  /** Cost/sell/total fields in sell details popup (respects 5+ hour rule when frozen). */
  canViewSoldOrderModalFinancials(order: PharmacySoldOrder | null | undefined): boolean {
    if (!order) {
      return false;
    }
    return this.accessControl.canViewPageComponent('otc-dispensary', 'sold-order-modal-financials', {
      orderAgeHours: this.soldOrderAgeHours(order),
    });
  }

  soldOrderAgeHours(order: PharmacySoldOrder): number {
    const when = this.parseSoldOrderDate(order);
    if (!when) {
      return Number.POSITIVE_INFINITY;
    }
    return Math.max(0, (Date.now() - when.getTime()) / (1000 * 60 * 60));
  }

  private parseSoldOrderDate(order: PharmacySoldOrder): Date | null {
    const datePart = (order.visitDate || '').trim();
    if (!datePart) {
      return null;
    }
    const timePart = (order.visitTime || '').trim();
    const combined = timePart ? `${datePart} ${timePart}` : datePart;
    const parsed = new Date(combined);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
    const isoTry = new Date(`${datePart}T${timePart || '00:00:00'}`);
    return Number.isNaN(isoTry.getTime()) ? null : isoTry;
  }

  /** Delete sold line — MD only. */
  get canDeleteSoldLine(): boolean {
    return this.isMdUser();
  }

  get otcIncludePrescribing(): boolean {
    return this.otcSaleMode === 'prescribing';
  }

  onOtcPrescriptionFieldsToggle(enabled: boolean): void {
    this.otcSaleMode = enabled ? 'prescribing' : 'simple';
  }

  givenCartLines(): OtcCartLine[] {
    return this.otcOnlyCart.filter((line) => line.given);
  }

  get cartSubtotal(): number {
    const raw = this.givenCartLines().reduce((sum, line) => sum + this.cartLineAmount(line), 0);
    return raw > 0 ? roundUgxMoney(raw) : 0;
  }

  get changeDue(): number {
    const received = this.amountReceived ?? 0;
    return Math.max(0, received - this.cartSubtotal);
  }

  get hasBillableCartLines(): boolean {
    return this.givenCartLines().length > 0;
  }

  get otcOnlyCart(): OtcCartLine[] {
    return this.cart.filter((c) => c.lineSource === 'OTC');
  }

  get prescriptionSubtotal(): number {
    const raw = this.dispensablePrescriptionRows()
      .reduce((sum, row) => sum + this.prescriptionLineAmount(row), 0);
    return raw > 0 ? roundUgxMoney(raw) : 0;
  }

  get prescriptionChangeDue(): number {
    const received = this.rxAmountReceived ?? 0;
    return Math.max(0, received - this.prescriptionSubtotal);
  }

  get hasBillablePrescriptionLines(): boolean {
    return this.canCompletePrescriptionSale;
  }

  /** True when the selected visit can be finalized (in-stock lines with qty ready to dispense). */
  get canCompletePrescriptionSale(): boolean {
    const allRows = this.selectedPrescriptionRows();
    if (
      this.selectedPrescriptionVisitId == null ||
      !allRows.length ||
      this.isPrescriptionVisitSaleDone(this.selectedPrescriptionVisitId)
    ) {
      return false;
    }
    const billable = this.dispensablePrescriptionRows();
    if (billable.length) {
      return (
        this.prescriptionSubtotal > 0 &&
        billable.every(
          (row) => row.quantity > 0 && !this.prescriptionQtyExceedsStock(row)
        )
      );
    }
    return allRows.every((row) => this.prescriptionItemTotalStock(row) <= 0);
  }

  /** In-stock prescription lines ready to dispense (DSP is set by the dispense buttons). */
  dispensablePrescriptionRows(): DoctorPrescriptionRow[] {
    return this.selectedPrescriptionRows().filter(
      (r) =>
        r.id > 0 &&
        this.num(r.quantity) > 0 &&
        r.dispensed !== true &&
        !this.isPrescriptionStatusGiven(r.status) &&
        (this.isSundryPrescriptionRow(r) || this.prescriptionItemTotalStock(r) > 0)
    );
  }

  isSundryPrescriptionRow(row: DoctorPrescriptionRow | null | undefined): boolean {
    if (!row) {
      return false;
    }
    return (
      row.lineKind === 'SUNDRY' ||
      (row.visitSundryId != null && row.visitSundryId > 0) ||
      String(row.route || '').toUpperCase() === 'SUNDRY'
    );
  }

  prescriptionRowKey(row: DoctorPrescriptionRow): string {
    return this.isSundryPrescriptionRow(row)
      ? `sundry-${row.visitSundryId || row.id}`
      : `rx-${row.id}`;
  }

  private samePrescriptionRow(a: DoctorPrescriptionRow, b: DoctorPrescriptionRow): boolean {
    return this.prescriptionRowKey(a) === this.prescriptionRowKey(b);
  }

  get rxTabIncludePrescribing(): boolean {
    return (
      this.otcIncludePrescribing ||
      this.selectedPrescriptionRows().some((r) => this.prescriptionRowHasPrescribing(r))
    );
  }

  groupedPrescriptionVisits(): {
    visitId: number;
    visitNumber: number;
    patientName: string;
    visitDate: string;
    visitTime: string;
    rows: DoctorPrescriptionRow[];
  }[] {
    const map = new Map<number, {
      visitId: number;
      visitNumber: number;
      patientName: string;
      visitDate: string;
      visitTime: string;
      rows: DoctorPrescriptionRow[];
    }>();
    for (const row of this.doctorPrescriptionRows) {
      let group = map.get(row.visitId);
      if (!group) {
        group = {
          visitId: row.visitId,
          visitNumber: row.visitNumber,
          patientName: row.patientName,
          visitDate: row.visitDate,
          visitTime: row.visitTime,
          rows: [],
        };
        map.set(row.visitId, group);
      }
      group.rows.push(row);
    }
    return Array.from(map.values()).sort((a, b) => {
      const da = `${a.visitDate} ${a.visitTime}`;
      const db = `${b.visitDate} ${b.visitTime}`;
      return db.localeCompare(da);
    });
  }

  isPrescriptionVisitSaleDone(visitId: number | null | undefined): boolean {
    return visitId != null && this.completedPrescriptionVisitIds.has(visitId);
  }

  /** Visit order status for the prescriptions queue table. */
  prescriptionVisitOrderStatus(
    group: { visitId: number; rows: DoctorPrescriptionRow[] }
  ): 'done' | 'pending' {
    return this.isPrescriptionVisitSaleDone(group.visitId) ? 'done' : 'pending';
  }

  prescriptionVisitOrderStatusLabel(
    group: { visitId: number; rows: DoctorPrescriptionRow[] }
  ): string {
    return this.prescriptionVisitOrderStatus(group) === 'done' ? 'Done' : 'Pending';
  }

  prescriptionVisitOrderStatusClass(
    group: { visitId: number; rows: DoctorPrescriptionRow[] }
  ): string {
    return this.prescriptionVisitOrderStatus(group) === 'done'
      ? 'otc-rx-order-status otc-rx-order-status--done'
      : 'otc-rx-order-status otc-rx-order-status--pending';
  }

  prescriptionRowOutOfStock(row: DoctorPrescriptionRow): boolean {
    return this.prescriptionItemTotalStock(row) <= 0;
  }

  prescriptionRowStatusLabel(row: DoctorPrescriptionRow): string {
    if (row.given) {
      return 'Given';
    }
    if (this.prescriptionRowOutOfStock(row)) {
      return 'Not given · Out of stock';
    }
    return row.status || 'Not given';
  }

  onPrescriptionGivenChange(row: DoctorPrescriptionRow, checked: boolean): void {
    this.onPrescriptionPdDspAdmChange(row, 'dispensed', checked);
  }

  prescriptionRowsEligibleForDispense(): DoctorPrescriptionRow[] {
    return this.selectedPrescriptionDetailRows.filter(
      (row) => row.id > 0 && this.prescriptionItemTotalStock(row) > 0
    );
  }

  allPrescriptionDispensedSelected(): boolean {
    const eligible = this.prescriptionRowsEligibleForDispense();
    return eligible.length > 0 && eligible.every((row) => row.dispensed === true);
  }

  somePrescriptionDispensedSelected(): boolean {
    const eligible = this.prescriptionRowsEligibleForDispense();
    return eligible.some((row) => row.dispensed === true);
  }

  canToggleAllPrescriptionDispensed(): boolean {
    return (
      !this.processing &&
      this.selectedPrescriptionVisitId != null &&
      !this.isPrescriptionVisitSaleDone(this.selectedPrescriptionVisitId) &&
      this.prescriptionRowsEligibleForDispense().length > 0
    );
  }

  toggleAllPrescriptionDispensed(checked: boolean): void {
    if (!this.canToggleAllPrescriptionDispensed()) {
      return;
    }
    for (const row of this.prescriptionRowsEligibleForDispense()) {
      if ((row.dispensed === true) !== checked) {
        this.onPrescriptionPdDspAdmChange(row, 'dispensed', checked);
      }
    }
    this.cdr.detectChanges();
  }

  onPrescriptionPdDspAdmChange(
    row: DoctorPrescriptionRow,
    flag: TreatmentLifecycleFlag,
    checked: boolean
  ): void {
    if (!row?.id) {
      return;
    }
    if (flag === 'dispensed' && checked && this.prescriptionItemTotalStock(row) <= 0) {
      row.dispensed = false;
      this.flashStatus(
        `${row.itemName} is out of stock and cannot be marked dispensed.`,
        true
      );
      return;
    }
    const previous = {
      paid: row.paid !== false,
      dispensed: row.dispensed === true,
      administered: row.administered === true,
      given: row.given,
      status: row.status,
    };
    const prevSubtotal = this.prescriptionSubtotal;
    (row as any)[flag] = checked;
    if (flag === 'paid') {
      row.given = checked;
      row.paid = checked;
    }
    if (flag === 'dispensed' && checked) {
      row.paid = true;
      row.given = true;
      row.status = 'dispensed';
    }
    if (flag === 'dispensed' && !checked) {
      row.status = 'pending';
    }
    const cartLine = this.cart.find(
      (c) => c.lineSource === 'RX' && c.treatmentRequestedId === row.id
    );
    if (cartLine && flag === 'paid') {
      const prevCartSubtotal = this.cartSubtotal;
      cartLine.given = checked;
      this.syncAmountReceivedToSubtotal(prevCartSubtotal);
    }
    this.syncRxAmountReceivedToSubtotal(prevSubtotal);
    this.api.updateTreatmentLifecycleFlags(row.id, treatmentLifecyclePatch(flag, checked)).subscribe({
      next: (dto) => {
        if (dto && typeof dto === 'object') {
          applyTreatmentLifecycleFlags(Object.assign(row, dto));
        }
      },
      error: () => {
        row.paid = previous.paid;
        row.dispensed = previous.dispensed;
        row.administered = previous.administered;
        row.given = previous.given;
        row.status = previous.status;
        this.syncRxAmountReceivedToSubtotal();
      },
    });
  }

  onCartGivenChange(line: OtcCartLine, checked: boolean): void {
    const prevSubtotal = this.cartSubtotal;
    line.given = checked;
    if (line.lineSource === 'RX' && line.treatmentRequestedId) {
      const rx = this.doctorPrescriptionRows.find((r) => r.id === line.treatmentRequestedId);
      if (rx) {
        rx.given = checked;
        this.syncRxAmountReceivedToSubtotal(this.prescriptionSubtotal);
      }
    }
    this.syncAmountReceivedToSubtotal(prevSubtotal);
  }

  /** Billable sell amount for a prescription row (qty × unit sell price). */
  prescriptionLineAmount(row: DoctorPrescriptionRow): number {
    return this.num(row.quantity) * this.num(row.unitSellingPrice);
  }

  /** Total stock for this drug (stock batches or shop items, per facility setting). */
  prescriptionItemTotalStock(row: DoctorPrescriptionRow): number {
    if (this.isSundryPrescriptionRow(row)) {
      // Stock already deducted when the sundry was recorded.
      return Math.max(this.num(row.quantity), this.num(row.prescribedQuantity), 1);
    }
    return getPharmacyItemTotalStock(row, this.itemList);
  }

  onPrescriptionQuantityChange(row: DoctorPrescriptionRow, raw: string | number): void {
    if (this.isSundryPrescriptionRow(row)) {
      return;
    }
    const prevSubtotal = this.prescriptionSubtotal;
    const qty = Math.max(0, Math.floor(Number(raw) || 0));
    row.quantity = qty;
    row.totalAmount = qty * this.num(row.unitSellingPrice);
    const cartLine = this.cart.find(
      (line) => line.lineSource === 'RX' && line.treatmentRequestedId === row.id
    );
    if (cartLine) {
      cartLine.quantity = qty;
      cartLine.totalAmount = row.totalAmount;
      cartLine.totalUnits = qty;
    }
    this.syncRxAmountReceivedToSubtotal(prevSubtotal);
    this.schedulePrescriptionQuantityPersist(row);
  }

  /** Persist qty to treatmentrequested and refresh visit balance/totals. */
  private schedulePrescriptionQuantityPersist(row: DoctorPrescriptionRow): void {
    if (!row?.id || this.isSundryPrescriptionRow(row)) {
      return;
    }
    const existing = this.rxQtyPersistTimers.get(row.id);
    if (existing) {
      clearTimeout(existing);
    }
    const timer = setTimeout(() => {
      this.rxQtyPersistTimers.delete(row.id);
      this.persistPrescriptionQuantity(row);
    }, 400);
    this.rxQtyPersistTimers.set(row.id, timer);
  }

  private persistPrescriptionQuantity(row: DoctorPrescriptionRow): void {
    const qty = Math.max(0, Math.floor(Number(row.quantity) || 0));
    if (qty <= 0) {
      return;
    }
    if (!row.stockBatchId && !row.itemId) {
      this.flashStatus('Cannot update quantity: drug batch/item is missing.', true);
      return;
    }
    const payload: Record<string, unknown> = {
      quantity: qty,
      totalUnits: qty,
      visitId: row.visitId,
      amountPerFrequencyValue: row.amountPerFrequencyValue ?? 0,
      amountPerFrequencyUnit: row.amountPerFrequencyUnit || '',
      frequencyValue: row.frequencyValue ?? 0,
      durationValue: row.durationValue ?? 0,
      instructions: row.instructions || '',
      route: row.route || '',
    };
    if (row.stockBatchId) {
      payload['stockBatchId'] = row.stockBatchId;
    }
    if (row.itemId) {
      payload['itemId'] = row.itemId;
    }
    this.api.updateTreatment(row.id, payload).subscribe({
      next: (res: any) => {
        const data = res?.data ?? res;
        if (data?.totalAmount != null) {
          row.totalAmount = this.num(data.totalAmount);
        }
        if (data?.quantity != null) {
          row.quantity = this.num(data.quantity);
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        const msg =
          err?.error?.message ||
          err?.message ||
          'Could not update prescription quantity on the visit.';
        this.flashStatus(String(msg), true);
      },
    });
  }

  prescriptionQtyExceedsStock(row: DoctorPrescriptionRow): boolean {
    if (row.quantity <= 0) {
      return false;
    }
    const available = this.prescriptionItemTotalStock(row);
    return row.quantity > available;
  }

  cartLineAmount(line: OtcCartLine): number {
    const stored = Number(line.totalAmount) || 0;
    if (stored > 0) {
      return stored;
    }
    return (Number(line.quantity) || 0) * (Number(line.unitSellingPrice) || 0);
  }

  private syncRxAmountReceivedToSubtotal(previousSubtotal?: number): void {
    const total = this.prescriptionSubtotal;
    if (
      this.rxAmountReceived == null ||
      (previousSubtotal != null && this.rxAmountReceived === previousSubtotal)
    ) {
      this.rxAmountReceived = total > 0 ? total : null;
    }
  }

  /** Keep amount received aligned with total due on OTC counter. */
  private syncAmountReceivedToSubtotal(previousSubtotal?: number): void {
    const total = this.cartSubtotal;
    if (
      this.amountReceived == null ||
      (previousSubtotal != null && this.amountReceived === previousSubtotal)
    ) {
      this.amountReceived = total > 0 ? total : null;
    }
  }

  prescriptionRowHasPrescribing(row: DoctorPrescriptionRow): boolean {
    const dosage = String(row.dosage ?? '').trim();
    if (dosage && dosage !== '—' && dosage !== '0') {
      return true;
    }
    if (
      hasPrescribingNumericValue(row.amountPerFrequencyValue) &&
      String(row.amountPerFrequencyUnit ?? '').trim()
    ) {
      return true;
    }
    if (hasPrescribingNumericValue(row.frequencyValue)) {
      return true;
    }
    if (hasPrescribingNumericValue(row.durationValue)) {
      return true;
    }
    return false;
  }

  /** Cap quantity by stock. Do not change PD / DSP / ADM flags. */
  private applyPrescriptionStockAvailability(rows: DoctorPrescriptionRow[]): void {
    for (const row of rows) {
      if (row.dispensed === true || this.isPrescriptionStatusGiven(row.status)) {
        continue;
      }
      const prescribed =
        row.prescribedQuantity > 0 ? row.prescribedQuantity : Math.max(0, row.quantity);
      if (row.prescribedQuantity <= 0) {
        row.prescribedQuantity = prescribed;
      }

      const stock = this.prescriptionItemTotalStock(row);
      if (stock > 0) {
        const targetQty = prescribed > 0 ? prescribed : 1;
        row.quantity = Math.min(targetQty, stock);
      } else {
        row.quantity = prescribed;
      }
      row.totalAmount = this.num(row.quantity) * this.num(row.unitSellingPrice);
    }
  }

  private prescriptionRowsToCartSnapshot(rows: DoctorPrescriptionRow[]): OtcCartLine[] {
    return rows.map((row) => {
      const freqUnit = this.parseRxFrequencyUnit(row.frequencyUnit);
      const durUnit = this.parseRxFrequencyUnit(row.durationUnit);
      return {
        cartLineKey: `rx-${row.id}`,
        lineSource: 'RX' as const,
        given: row.given,
        treatmentRequestedId: row.id,
        visitId: row.visitId,
        patientId: row.patientId,
        patientName: row.patientName,
        stockBatchId: row.stockBatchId ?? 0,
        itemId: row.itemId ?? 0,
        itemName: row.itemName,
        amountPerFrequencyValue: row.amountPerFrequencyValue,
        amountPerFrequencyUnit: row.amountPerFrequencyUnit,
        frequencyValue: row.frequencyValue,
        frequencyUnit: freqUnit,
        durationValue: row.durationValue,
        durationUnit: durUnit,
        quantity: row.quantity,
        totalUnits: row.totalUnits,
        unitBuy: row.unitBuy,
        unitSellingPrice: row.unitSellingPrice,
        totalAmount: row.given ? row.totalAmount : 0,
        instructions: row.instructions || '',
        route: row.route || '',
        stockAtHand: this.prescriptionItemTotalStock(row),
      };
    });
  }

  private parseRxFrequencyUnit(unit: string | number | null): number | null {
    const n = Number(unit);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  cartLineHasPrescribing(line: OtcCartLine): boolean {
    if (
      hasPrescribingNumericValue(line.amountPerFrequencyValue) &&
      String(line.amountPerFrequencyUnit ?? '').trim()
    ) {
      return true;
    }
    if (hasPrescribingNumericValue(line.frequencyValue)) {
      return true;
    }
    if (hasPrescribingNumericValue(line.durationValue)) {
      return true;
    }
    return false;
  }

  /** Qty badge label for stock batch dropdown rows. */
  stockBatchQtyLabel(item: { stockAtHand?: number; uintOfMeasure?: string; unitOfMeasure?: string }): string {
    const qty = Number(item?.stockAtHand ?? 0);
    const uom = String(item?.uintOfMeasure ?? item?.unitOfMeasure ?? '').trim();
    return this.stockBatchQtyBadge(qty, uom);
  }

  stockBatchQtyBadge(qty: number, uom?: string): string {
    const unit = String(uom ?? '').trim();
    return unit ? `Qty: ${qty} ${unit}` : `Qty: ${qty}`;
  }

  /** True when a store chip on a batch line can be selected for sale. */
  distHasSelectableStock(dist: { item?: any | null }): boolean {
    return !!dist?.item && Number(dist.item.stockAtHand ?? 0) > 0;
  }

  /** Batch line is sellable when combined stock across stores is greater than zero. */
  batchLineHasStock(line: { totalStock?: number }): boolean {
    return Number(line?.totalStock ?? 0) > 0;
  }

  private batchLineTotalStock(distributions: any[]): number {
    return distributions.reduce((sum, row) => sum + Number(row?.stockAtHand ?? 0), 0);
  }

  /** Combined stock for the same item + batch across all stores. */
  batchLineTotalForItem(item: any): number {
    if (!item) {
      return 0;
    }
    const itemKey = String(item.stockItemId ?? item.stockItemName ?? item.id ?? '').trim();
    if (!itemKey) {
      return Number(item.stockAtHand ?? 0);
    }
    return this.itemList
      .filter((row) => {
        const rowKey = String(row.stockItemId ?? row.stockItemName ?? row.id ?? '').trim();
        return rowKey === itemKey && this.stockBatchLineKey(itemKey, row) === this.stockBatchLineKey(itemKey, item);
      })
      .reduce((sum, row) => sum + Number(row?.stockAtHand ?? 0), 0);
  }

  private availableStockForCartLine(line: OtcCartLine): number {
    if (line.stockBatchId != null && line.stockBatchId > 0) {
      const batch = this.itemList.find((row) => row._stockBatchId === line.stockBatchId);
      if (!batch) {
        return Number(line.stockAtHand ?? 0);
      }
      return this.batchLineTotalForItem(batch);
    }
    const item = this.itemList.find((row) => Number(row?.id) === Number(line.itemId));
    return Number(item?.stockAtHand ?? line.stockAtHand ?? 0);
  }

  formatBatchMoney(amount: number | null | undefined): string {
    return formatMoneyWholeDisplay(amount ?? 0);
  }

  /** Expiry badge: red under 1y, yellow 1–2y, green 2y+ (calendar years). */
  batchExpiryToneClass(tone: string): string {
    if (tone === 'danger') {
      return 'otc-stock-batch-expiry--danger';
    }
    if (tone === 'warning') {
      return 'otc-stock-batch-expiry--warning';
    }
    if (tone === 'safe') {
      return 'otc-stock-batch-expiry--safe';
    }
    return 'otc-stock-batch-expiry--unknown';
  }

  filteredItemList(): any[] {
    if (!Array.isArray(this.itemList)) {
      return [];
    }

    let filteredItemList = [...this.itemList];

    if (this.searchText && this.searchText.trim()) {
      const q = this.searchText.toLowerCase().trim();
      filteredItemList = filteredItemList.filter((item) => {
        const blob = [
          item?.title,
          item?.name,
          item?.stockItemName,
          item?.itemName,
          item?.storeName,
          item?.store?.name,
          item?.batchNumber != null ? String(item.batchNumber) : '',
          item?._stockBatchId != null ? String(item._stockBatchId) : '',
          item?.id != null ? String(item.id) : '',
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return blob.includes(q);
      });
    }

    return filteredItemList.sort(
      (a, b) =>
        (b?._stockBatchId ?? b?.id ?? 0) - (a?._stockBatchId ?? a?.id ?? 0)
    );
  }

  /** Rebuild grouped dropdown rows when item list or search filter changes. */
  refreshGroupedStockItems(): void {
    type StoreDist = {
      storeId: number;
      storeName: string;
      qtyLabel: string;
      storeLabel: string;
      item: any | null;
    };
    type BatchLine = {
      batchKey: string;
      batchLabel: string;
      distributions: any[];
      storeDistribution: StoreDist[];
    };
    type ItemGroup = { itemKey: string; stockItemName: string; batchLineMap: Map<string, BatchLine> };
    const itemMap = new Map<string, ItemGroup>();

    for (const batch of this.filteredItemList()) {
      const itemKey = String(batch.stockItemId ?? batch.stockItemName ?? batch.id ?? '').trim();
      if (!itemKey) {
        continue;
      }
      let group = itemMap.get(itemKey);
      if (!group) {
        group = {
          itemKey,
          stockItemName: String(batch.stockItemName ?? this.plainDrugName(batch)).trim(),
          batchLineMap: new Map<string, BatchLine>(),
        };
        itemMap.set(itemKey, group);
      }

      const batchKey = this.stockBatchLineKey(itemKey, batch);
      let line = group.batchLineMap.get(batchKey);
      if (!line) {
        line = {
          batchKey,
          batchLabel: String(
            batch.batchLabel ?? `Batch ${batch.batchNumber ?? batch._stockBatchId ?? '?'}`
          ).trim(),
          distributions: [],
          storeDistribution: [],
        };
        group.batchLineMap.set(batchKey, line);
      }
      line.distributions.push(batch);
    }

    this.groupedStockItems = Array.from(itemMap.values())
      .map((group) => {
        const batchLines = Array.from(group.batchLineMap.values())
          .filter((line) => this.batchLineTotalStock(line.distributions) > 0)
          .map((line) => {
            const expiry = this.batchLineExpiryInfo(line.distributions);
            const pricing = extractBatchLinePricing(line.distributions);
            return {
              batchKey: line.batchKey,
              batchLabel: line.batchLabel,
              expiryLabel: expiry.label,
              expiryTone: expiry.tone,
              totalStock: this.batchLineTotalStock(line.distributions),
              unitCost: pricing.unitCost,
              sellingModels: pricing.sellingModels,
              storeDistribution: this.buildBatchStoreDistribution(line.distributions),
            };
          })
          .sort((a, b) =>
            a.batchLabel.localeCompare(b.batchLabel, undefined, { sensitivity: 'base', numeric: true })
          );
        return {
          itemKey: group.itemKey,
          stockItemName: group.stockItemName,
          completelyOutOfStock: batchLines.length === 0,
          batchLines,
        };
      })
      .sort((a, b) =>
        a.stockItemName.localeCompare(b.stockItemName, undefined, { sensitivity: 'base' })
      );
  }

  groupedStockItemList(): typeof this.groupedStockItems {
    return this.groupedStockItems;
  }

  trackGroupedStockItem(_index: number, group: { itemKey: string }): string {
    return group.itemKey;
  }

  private buildBatchStoreDistribution(distributions: any[]): {
    storeId: number;
    storeName: string;
    qtyLabel: string;
    storeLabel: string;
    item: any | null;
  }[] {
    const byStoreId = new Map<number, any>();
    for (const row of distributions) {
      const sid = Number(row?.storeId);
      if (Number.isFinite(sid) && sid > 0 && Number(row?.stockAtHand ?? 0) > 0) {
        byStoreId.set(sid, row);
      }
    }
    const defaultUom = String(
      distributions[0]?.uintOfMeasure ?? distributions[0]?.unitOfMeasure ?? 'unit'
    ).trim();

    return Array.from(byStoreId.values())
      .map((item) => {
        const storeId = Number(item.storeId);
        const storeName = String(item.storeName ?? `Store #${storeId}`).trim();
        const qty = Number(item.stockAtHand ?? 0);
        const uom = String(item.uintOfMeasure ?? item.unitOfMeasure ?? defaultUom).trim();
        const qtyLabel = this.stockBatchQtyBadge(qty, uom);
        return {
          storeId,
          storeName,
          qtyLabel,
          storeLabel: `${storeName} ${qtyLabel}`,
          item,
        };
      })
      .sort((a, b) => a.storeName.localeCompare(b.storeName, undefined, { sensitivity: 'base' }));
  }

  private stockBatchLineKey(itemKey: string, batch: any): string {
    const batchNumber = String(batch.batchNumber ?? '').trim();
    if (batchNumber) {
      return `${itemKey}::bn:${batchNumber}`;
    }
    return `${itemKey}::id:${batch._stockBatchId ?? batch.id ?? ''}`;
  }

  loadPharmacyStock(): void {
    this.isLoadingDrugList = true;
    if (!this.pharmacyUseStockBatch) {
      this.api.getAllItems().subscribe({
        next: (items: any) => {
          this.itemList = Array.isArray(items) ? items : [];
          this.allStockBatchesCache = [];
          this.groupedStockItems = [];
          this.isLoadingDrugList = false;
          if (this.doctorPrescriptionRows.length) {
            this.applyPrescriptionStockAvailability(this.doctorPrescriptionRows);
            if (this.selectedPrescriptionVisitId != null) {
              this.syncRxAmountReceivedToSubtotal();
            }
          }
        },
        error: () => {
          this.isLoadingDrugList = false;
          this.itemList = [];
          this.allStockBatchesCache = [];
          this.groupedStockItems = [];
          this.flashStatus('Could not load pharmacy items.', true);
        },
      });
      return;
    }

    forkJoin({
      stores: this.api.getAllStores().pipe(
        map((res: any) => this.normalizeList(res)),
        catchError(() => of([]))
      ),
      batches: this.api.getAllStockBatches().pipe(
        map((res: any) => this.normalizeList(res)),
        catchError(() => of([]))
      ),
    }).subscribe({
      next: ({ stores, batches }: { stores: any[]; batches: any[] }) => {
        const pharmacy = this.resolvePharmacyStore(stores);
        this.pharmacyStoreId = pharmacy.id;
        this.pharmacyStoreName = pharmacy.name;
        this.storeList = stores;
        this.allStockBatchesCache = batches;
        this.itemList = batches.map((batch: any) =>
          this.mapStockBatchToTreatmentDropdownItem(batch)
        );
        this.isLoadingDrugList = false;
        this.refreshGroupedStockItems();
        if (this.doctorPrescriptionRows.length) {
          this.applyPrescriptionStockAvailability(this.doctorPrescriptionRows);
          if (this.selectedPrescriptionVisitId != null) {
            this.syncRxAmountReceivedToSubtotal();
          }
        }
      },
      error: () => {
        this.isLoadingDrugList = false;
        this.itemList = [];
        this.allStockBatchesCache = [];
        this.groupedStockItems = [];
        this.storeList = [];
        this.flashStatus('Could not load pharmacy stock.', true);
      },
    });
  }

  toggleOtcDrugDropdown(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.otcDrugDropdownOpen) {
      this.otcDrugDropdownOpen = false;
      return;
    }
    this.openOtcDrugDropdown();
  }

  onOtcDrugSearchChange(): void {
    if (this.pharmacyUseStockBatch) {
      this.refreshGroupedStockItems();
    }
  }

  private openOtcDrugDropdown(): void {
    this.searchText = '';
    if (!this.itemList?.length && !this.isLoadingDrugList) {
      this.loadPharmacyStock();
    } else if (this.pharmacyUseStockBatch) {
      this.refreshGroupedStockItems();
    }
    this.otcDrugDropdownOpen = true;
    setTimeout(() => {
      this.searchInput?.nativeElement?.focus();
    }, 0);
  }

  /** Pick a batch + store — close dropdown, then pre-fill form fields. */
  selectOtcBatch(item: any, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    if (!item || Number(item.stockAtHand ?? 0) <= 0) {
      return;
    }
    this.otcDrugDropdownOpen = false;
    this.changeCurrentItem(item);
  }

  /** Pick a shop item (item-mode) — close dropdown, then pre-fill form fields. */
  selectOtcItem(item: any, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    if (!item) {
      return;
    }
    this.otcDrugDropdownOpen = false;
    this.applySelectedOtcShopItem(item);
  }

  filteredOtcItemList(): any[] {
    if (!Array.isArray(this.itemList)) {
      return [];
    }
    let filtered = [...this.itemList];
    const q = (this.searchText || '').trim().toLowerCase();
    if (q) {
      filtered = filtered.filter((item) => {
        const blob = [
          item?.title,
          item?.name,
          item?.itemName,
          item?.stockItemName,
          item?.batchNumber,
          item?.storeName,
        ]
          .map((v) => String(v ?? '').toLowerCase())
          .join(' ');
        return blob.includes(q);
      });
    }
    return filtered;
  }

  otcItemOptionLabel(item: any): string {
    return String(item?.title || item?.name || item?.itemName || 'Item');
  }

  otcItemOptionStock(item: any): string {
    const qty = Number(item?.stockAtHand ?? 0);
    const uom = String(item?.uintOfMeasure || item?.unitOfMeasure || '').trim();
    return uom ? `${qty} ${uom}` : String(qty);
  }

  changeCurrentItem(item: any): void {
    if (!item) {
      this.clearCurrentTreatmentSelection();
      return;
    }
    if (!this.pharmacyUseStockBatch) {
      this.applySelectedOtcShopItem(item);
      return;
    }
    if (Number(item.stockAtHand ?? 0) <= 0) {
      this.flashStatus('Out of stock.', true);
      return;
    }
    this.itemSellingPrice = 0;
    this.availableQuantity = Number(item.stockAtHand) || 0;
    this.unitBuy = Number(item.costPrice) || 0;
    this.unitOfMeasure = item.uintOfMeasure || item.unitOfMeasure || '';
    this.currentItemFullLabel = item.title || item.name || '';
    const drugName = item.plainName || this.plainDrugName(item) || item.title || item.name || 'Unknown Treatment';
    this.currentStockItemName = drugName;
    const storePart = item.storeName ? ` · ${item.storeName}` : '';
    const expiryPart = item.expiryLabel ? ` · EX ${item.expiryLabel}` : '';
    this.currentItem = item.batchLabel
      ? `${drugName} — ${item.batchLabel}${expiryPart}${storePart}`
      : drugName;
    this.currentItemId = item.stockItemId ?? item.id ?? null;
    this.currentStockBatchId =
      item._stockBatchId != null && item._stockBatchId !== '' ? item._stockBatchId : null;
    this.selectedUnitSellingModelId = item.unitSellingModelId ?? null;
    this.lastUnitValue = Number(item.lastUnitValue) > 0 ? Number(item.lastUnitValue) : 1;
    if (!this.currentTreatmentRequested.quantity || this.currentTreatmentRequested.quantity <= 0) {
      this.currentTreatmentRequested.quantity = 1;
    }
    this.applyItemPrescribingPrefill(item);
    this.calculateTotal();
  }

  /** Shop-item mode: capture Item.id only — never look up StockItem. */
  private applySelectedOtcShopItem(item: any): void {
    if (!item) {
      this.clearCurrentTreatmentSelection();
      return;
    }
    if (Number(item.stockAtHand ?? 0) <= 0) {
      this.flashStatus('Out of stock.', true);
      return;
    }
    const name = String(item.title || item.name || item.itemName || 'Unknown Treatment').trim();
    this.currentItemFullLabel = name;
    this.currentStockItemName = name;
    this.currentItem = name;
    this.currentItemId = Number(item.id ?? item.itemId) || null;
    this.currentStockBatchId = null;
    this.selectedUnitSellingModelId = item.unitSellingModelId ?? item.unit_selling_model_id ?? null;
    this.availableQuantity = Number(item.stockAtHand) || 0;
    this.unitBuy = Number(item.costPrice) || 0;
    this.itemSellingPrice =
      Number(item.sellingPrice ?? item.unitSellingPrice ?? item.salePrice ?? 0) || 0;
    this.unitOfMeasure = item.uintOfMeasure || item.unitOfMeasure || '';
    this.lastUnitValue = Number(item.lastUnitValue) > 0 ? Number(item.lastUnitValue) : 1;
    if (!this.currentTreatmentRequested.quantity || this.currentTreatmentRequested.quantity <= 0) {
      this.currentTreatmentRequested.quantity = 1;
    }
    applyPrescribingPrefillToTreatmentForm(this.currentTreatmentRequested, item);
    if (this.otcIncludePrescribing) {
      this.calculateNoOfUnits();
      this.calculateTotalQty();
    }
    this.calculateTotal();
  }

  private applyItemPrescribingPrefill(item: any): void {
    const recalc = () => {
      if (this.otcIncludePrescribing) {
        this.calculateNoOfUnits();
        this.calculateTotalQty();
      }
      this.calculateTotal();
    };

    if (!this.currentTreatmentRequested.quantity) {
      this.currentTreatmentRequested.quantity = 1;
    }

    applyPrescribingPrefillToTreatmentForm(this.currentTreatmentRequested, item);
    recalc();

    if (!this.pharmacyUseStockBatch) {
      return;
    }

    const stockItemId = Number(item?.stockItemId ?? item?.id);
    if (!Number.isFinite(stockItemId) || stockItemId <= 0) {
      return;
    }

    this.api.getStockItemById(stockItemId).subscribe({
      next: (data) => {
        applyPrescribingPrefillToTreatmentForm(this.currentTreatmentRequested, {
          ...item,
          ...(data ?? {}),
        });
        recalc();
      },
      error: () => recalc(),
    });
  }

  calculateNoOfUnits(): void {
    const dose = Number(this.currentTreatmentRequested.amountPerFrequencyValue) || 0;
    if (dose > 0 && this.lastUnitValue > 0) {
      this.currentTreatmentRequested.totalUnits = dose / this.lastUnitValue;
    } else {
      this.currentTreatmentRequested.totalUnits = 0;
    }
  }

  applyStandardDosageOption(option: StandardDosageOption): void {
    this.currentTreatmentRequested.amountPerFrequencyValue = option.doseValue;
    this.currentTreatmentRequested.amountPerFrequencyUnit = normalizeDosageUnitForSelect(option.doseUnit);
    this.currentTreatmentRequested.frequencyValue = option.frequencyValue;
    this.currentTreatmentRequested.frequencyUnit = option.frequencyUnit;
    this.currentTreatmentRequested.durationValue = option.durationValue;
    this.currentTreatmentRequested.durationUnit = option.durationUnit;
    this.currentTreatmentRequested.quantity = option.quantity;
    this.currentTreatmentRequested.totalUnits = option.totalUnits;
    this.currentTreatmentRequested.instructions = option.instructions;
    this.currentTreatmentRequested.route = option.route;
    this.calculateNoOfUnits();
    this.calculateTotalQty();
    this.calculateTotal();
  }

  otcStandardDosagePatientAge(): number | null {
    return null;
  }

  otcStandardDosagePatientWeight(): number | null {
    return null;
  }

  calculateTotalQty(): void {
    const freq = Number(this.currentTreatmentRequested.frequencyValue) || 0;
    const dur = Number(this.currentTreatmentRequested.durationValue) || 0;
    const dose = Number(this.currentTreatmentRequested.amountPerFrequencyValue) || 0;
    if (freq > 0 && dur > 0 && dose > 0 && this.lastUnitValue > 0) {
      this.currentTreatmentRequested.quantity = (freq * dur * dose) / this.lastUnitValue;
    }
    this.calculateTotal();
  }

  calculateDurationUnit(): void {
    this.currentTreatmentRequested.durationUnit = this.currentTreatmentRequested.frequencyUnit;
  }

  get lineTotalAmount(): number {
    const qty = Number(this.currentTreatmentRequested.quantity) || 0;
    const unitPrice = Number(this.itemSellingPrice) || 0;
    if (qty > 0 && unitPrice > 0) {
      return Math.round(qty * unitPrice * 100) / 100;
    }
    return Number(this.currentTreatmentRequested.totalAmount) || 0;
  }

  /** Qty changed — update line total sell. */
  calculateTotalFromQuantity(): void {
    const unitPrice = Number(this.itemSellingPrice) || 0;
    const total = (Number(this.currentTreatmentRequested.quantity) || 0) * unitPrice;
    this.currentTreatmentRequested.totalAmount = total;
  }

  /** Total sell changed — derive qty from amount ÷ unit sell price. */
  calculateQuantityFromTotalSell(): void {
    const unitPrice = this.itemSellingPrice || 0;
    const totalSell = Number(this.currentTreatmentRequested.totalAmount);
    if (unitPrice <= 0 || !Number.isFinite(totalSell) || totalSell <= 0) {
      return;
    }

    let qty = totalSell / unitPrice;
    qty = Math.round(qty * 10000) / 10000;

    if (this.availableQuantity > 0 && qty > this.availableQuantity) {
      qty = this.availableQuantity;
      this.currentTreatmentRequested.totalAmount =
        Math.round(qty * unitPrice * 100) / 100;
    }

    this.currentTreatmentRequested.quantity = qty;
    if (this.otcIncludePrescribing) {
      this.currentTreatmentRequested.totalUnits = qty;
    }
  }

  calculateTotal(): number {
    this.calculateTotalFromQuantity();
    return this.lineTotalAmount;
  }

  returnUnitCost(): number {
    return Number(this.itemSellingPrice) || 0;
  }

  onOtcUnitSellingModelPriceChange(price: number): void {
    this.applyUnitSellingModelPrice(price);
  }

  private applyUnitSellingModelPrice(price: number): void {
    this.itemSellingPrice = Number(price) || 0;
    this.calculateTotal();
  }

  addToSaleList(formValue: any): void {
    if (!this.currentItemId) {
      this.flashStatus('Select a treatment / drug from the list first.', true);
      return;
    }
    if (this.pharmacyUseStockBatch && !this.currentStockBatchId) {
      this.flashStatus('Select a stock batch / store from the list first.', true);
      return;
    }

    const data = { ...this.currentTreatmentRequested, ...formValue };
    const qty = Number(data.quantity);
    if (!qty || qty <= 0) {
      this.flashStatus('Total quantity must be greater than zero.', true);
      return;
    }
    if (this.availableQuantity <= 0) {
      this.flashStatus('Out of stock.', true);
      return;
    }
    if (qty > this.availableQuantity) {
      this.flashStatus(`Insufficient stock. Available: ${this.availableQuantity} ${this.unitOfMeasure}`, true);
      return;
    }
    const freqUnit = this.optionalPrescribingNumber(data.frequencyUnit);
    const durUnit = this.optionalPrescribingNumber(data.durationUnit);
    if (
      this.otcIncludePrescribing &&
      freqUnit != null &&
      durUnit != null &&
      freqUnit !== durUnit
    ) {
      this.flashStatus('Duration unit and frequency unit must match.', true);
      return;
    }

    const itemId = Number(this.currentItemId);
    const batchId =
      this.pharmacyUseStockBatch && this.currentStockBatchId != null
        ? Number(this.currentStockBatchId)
        : null;
    const hasBatch = batchId != null && Number.isFinite(batchId) && batchId > 0;
    const cartLineKey = hasBatch ? `otc-batch-${batchId}` : `otc-item-${itemId}`;
    const lineBase = {
      cartLineKey,
      lineSource: 'OTC' as const,
      given: true,
      stockBatchId: hasBatch ? batchId : null,
      itemId,
      itemName:
        this.currentStockItemName ||
        this.otcPlainItemName({ title: this.currentItem }) ||
        'Item',
      quantity: qty,
      unitBuy: this.unitBuy,
      unitSellingPrice: this.itemSellingPrice,
      totalAmount: Number(data.totalAmount) || qty * this.itemSellingPrice,
      stockAtHand: this.availableQuantity,
      unitSellingModelId: this.selectedUnitSellingModelId,
    };
    const line: OtcCartLine = this.otcIncludePrescribing
      ? {
          ...lineBase,
          amountPerFrequencyValue: this.optionalPrescribingNumber(data.amountPerFrequencyValue),
          amountPerFrequencyUnit: String(data.amountPerFrequencyUnit ?? '').trim(),
          frequencyValue: this.optionalPrescribingNumber(data.frequencyValue),
          frequencyUnit: freqUnit,
          durationValue: this.optionalPrescribingNumber(data.durationValue),
          durationUnit: durUnit,
          totalUnits: this.optionalPrescribingNumber(data.totalUnits),
          instructions: String(data.instructions ?? '').trim(),
          route: String(data.route ?? '').trim(),
        }
      : {
          ...lineBase,
          amountPerFrequencyValue: null,
          amountPerFrequencyUnit: '',
          frequencyValue: null,
          frequencyUnit: null,
          durationValue: null,
          durationUnit: null,
          totalUnits: qty,
          instructions: String(data.instructions ?? '').trim(),
          route: String(data.route ?? '').trim(),
        };

    const existing = this.cart.find(
      (c) =>
        c.lineSource === 'OTC' &&
        (hasBatch
          ? c.stockBatchId === line.stockBatchId
          : c.itemId === line.itemId && (c.stockBatchId == null || c.stockBatchId <= 0))
    );
    if (existing) {
      const newQty = existing.quantity + line.quantity;
      const maxStock = this.availableStockForCartLine(existing);
      if (newQty > maxStock) {
        this.flashStatus(`Cannot exceed stock (${maxStock}).`, true);
        return;
      }
      existing.quantity = newQty;
      existing.totalAmount = newQty * existing.unitSellingPrice;
      existing.stockAtHand = maxStock;
      existing.totalUnits = line.totalUnits;
      existing.amountPerFrequencyValue = line.amountPerFrequencyValue;
      existing.amountPerFrequencyUnit = line.amountPerFrequencyUnit;
      existing.frequencyValue = line.frequencyValue;
      existing.frequencyUnit = line.frequencyUnit;
      existing.durationValue = line.durationValue;
      existing.durationUnit = line.durationUnit;
      existing.route = line.route;
      existing.instructions = line.instructions;
    } else {
      this.cart = [...this.cart, line];
    }

    this.flashStatus('Added to counter sale list.', false);
    this.clearTreatmentForm();
  }

  removeLine(line: OtcCartLine): void {
    this.cart = this.cart.filter((c) => c.cartLineKey !== line.cartLineKey);
  }

  editLine(line: OtcCartLine): void {
    const item =
      line.stockBatchId != null && line.stockBatchId > 0
        ? this.itemList.find((i) => i._stockBatchId === line.stockBatchId)
        : this.itemList.find((i) => Number(i?.id) === Number(line.itemId));
    if (item) {
      this.changeCurrentItem(item);
    }
    this.currentTreatmentRequested = {
      amountPerFrequencyValue: line.amountPerFrequencyValue,
      amountPerFrequencyUnit: line.amountPerFrequencyUnit,
      frequencyValue: line.frequencyValue,
      frequencyUnit: line.frequencyUnit,
      durationValue: line.durationValue,
      durationUnit: line.durationUnit,
      quantity: line.quantity,
      totalUnits: line.totalUnits,
      totalAmount: line.totalAmount,
      instructions: line.instructions,
      route: line.route,
    };
    this.removeLine(line);
  }

  clearTreatmentForm(): void {
    this.currentItem = 'Choose Treatment';
    this.currentItemFullLabel = '';
    this.currentStockItemName = '';
    this.currentItemId = null;
    this.currentStockBatchId = null;
    this.selectedUnitSellingModelId = null;
    this.availableQuantity = 0;
    this.unitBuy = 0;
    this.itemSellingPrice = 0;
    this.unitOfMeasure = '';
    this.currentTreatmentRequested = this.defaultTreatmentForm();
    this.otcTreatmentForm?.resetForm(this.defaultTreatmentForm());
  }

  clearCart(): void {
    this.cart = [];
    this.amountReceived = null;
    this.showStatusBanner = false;
  }

  completePrescriptionSale(collectPayment: boolean = true): void {
    if (this.processing) {
      return;
    }
    if (this.selectedPrescriptionVisitId == null) {
      this.flashStatus('Select a patient from the queue first.', true);
      return;
    }
    const allRows = this.selectedPrescriptionRows();
    if (!allRows.length) {
      this.flashStatus('No prescription lines for this visit.', true);
      return;
    }
    const billable = this.dispensablePrescriptionRows();
    if (!billable.length && !allRows.every((row) => this.prescriptionItemTotalStock(row) <= 0)) {
      this.flashStatus('Set a quantity for at least one in-stock drug to dispense.', true);
      return;
    }
    for (const row of billable) {
      if (row.quantity <= 0) {
        this.flashStatus(`Enter a quantity greater than zero for ${row.itemName}.`, true);
        return;
      }
      const available = this.prescriptionItemTotalStock(row);
      if (row.quantity > available) {
        this.flashStatus(
          `${row.itemName}: quantity (${row.quantity}) exceeds available stock (${available}).`,
          true
        );
        return;
      }
    }
    const total = this.prescriptionSubtotal;
    if (billable.length > 0 && total <= 0) {
      this.flashStatus('Sale total must be greater than zero.', true);
      return;
    }
    const received = collectPayment
      ? billable.length > 0
        ? this.effectiveAmountReceived(this.rxAmountReceived, total)
        : 0
      : 0;
    if (collectPayment && billable.length > 0 && received < total) {
      this.flashStatus('Amount received is less than total due.', true);
      return;
    }
    const group = this.selectedPrescriptionGroup();
    const visitId = this.selectedPrescriptionVisitId;
    const patientName = group?.patientName ?? billable[0]?.patientName ?? allRows[0]?.patientName;

    // Mark lines being dispensed so the backend includes them and DSP is set.
    // Do not mark paid=true when money was not collected.
    for (const row of billable) {
      row.given = true;
      if (collectPayment) {
        row.paid = true;
      }
    }

    this.processing = true;
    this.flashStatus(
      collectPayment
        ? 'Processing dispense with payment…'
        : 'Processing dispense without payment…',
      false
    );
    const receivedBy = this.loggedInStaffName();

    this.api
      .completeOtcPharmacySale({
        amountReceived: received,
        paymentForm: collectPayment ? this.rxPaymentMethod : 'Not paid',
        receivedBy,
        notes: this.rxSaleNotes || (collectPayment
          ? 'Pharmacy prescription sale'
          : 'Pharmacy prescription dispensed — money not received'),
        visitId,
        patientName,
        recordPayment: collectPayment,
        lines: allRows.map((row) => {
          const inBillable = billable.some((b) => this.samePrescriptionRow(b, row));
          return this.prescriptionRowToSaleLine({
            ...row,
            given: inBillable,
          });
        }),
      })
      .subscribe({
        next: (res: any) => {
          this.processing = false;
          const changeAmt = collectPayment ? Math.max(0, received - total) : 0;
          const cartSnapshot = this.prescriptionRowsToCartSnapshot(
            billable.length ? billable : allRows
          );
          const saleData = this.extractCompletedSalePayload(res);
          const allTreatmentIds = billable
            .filter((row) => !this.isSundryPrescriptionRow(row))
            .map((row) => row.id)
            .filter((id) => id > 0);
          this.markPrescriptionVisitSaleCompleted(visitId, billable.length ? billable : allRows);
          this.notifyPatientVisitPharmacyUpdated(visitId, allTreatmentIds, res);
          if (collectPayment) {
            this.openReceiptModal(
              saleData,
              cartSnapshot,
              total,
              received,
              changeAmt,
              receivedBy,
              patientName
            );
          }
          const saleNo = saleData?.saleNo ? ` (${saleData.saleNo})` : '';
          const backendMsg = String(res?.message ?? res?.data?.message ?? '').trim();
          const notGivenCount = allRows.filter(
            (row) => !billable.some((b) => this.samePrescriptionRow(b, row))
          ).length;
          const visitNote = backendMsg.includes('Visit')
            ? collectPayment
              ? ' Visit payment / invoice updated.'
              : ' Visit invoice updated (balance remains until paid).'
            : '';
          const outOfStockNote =
            notGivenCount > 0
              ? ` ${notGivenCount} item(s) not dispensed (out of stock or qty 0).`
              : '';
          this.flashStatus(
            (backendMsg ||
              (collectPayment
                ? `Dispensed with payment${saleNo} — ${this.formatMoney(total)}. Change: ${this.formatMoney(changeAmt)}.`
                : `Dispensed without payment${saleNo} — ${this.formatMoney(total)} on visit balance.`)) +
              outOfStockNote +
              visitNote,
            false
          );
          this.loadDoctorPrescriptions();
          this.loadSalesHistory();
          this.loadPharmacyStock();
        },
        error: (err: any) => {
          this.processing = false;
          for (const row of billable) {
            row.given = row.dispensed === true;
          }
          this.flashStatus(this.extractApiErrorMessage(err, 'Prescription dispense could not be completed.'), true);
        },
      });
  }

  private prescriptionRowToSaleLine(row: DoctorPrescriptionRow): Record<string, unknown> {
    if (this.isSundryPrescriptionRow(row)) {
      return {
        visitSundryId: row.visitSundryId || row.id,
        given: row.given,
        quantity: row.given ? row.quantity : row.prescribedQuantity || row.quantity,
      };
    }
    const line: Record<string, unknown> = {
      treatmentRequestedId: row.id,
      given: row.given,
      quantity: row.given ? row.quantity : row.prescribedQuantity || row.quantity,
      amountPerFrequencyValue: row.amountPerFrequencyValue ?? undefined,
      amountPerFrequencyUnit: row.amountPerFrequencyUnit || undefined,
      frequencyValue: row.frequencyValue ?? undefined,
      frequencyUnit: this.parseRxFrequencyUnit(row.frequencyUnit) ?? undefined,
      durationValue: row.durationValue ?? undefined,
      durationUnit: this.parseRxFrequencyUnit(row.durationUnit) ?? undefined,
      totalUnits: row.totalUnits ?? undefined,
      instructions: row.instructions || undefined,
      route: row.route || undefined,
    };
    if (this.pharmacyUseStockBatch) {
      if (row.stockBatchId != null && row.stockBatchId > 0) {
        line['stockBatchId'] = row.stockBatchId;
      }
    } else if (row.itemId != null && row.itemId > 0) {
      line['itemId'] = row.itemId;
    }
    return line;
  }

  private extractApiErrorMessage(err: any, fallback: string): string {
    const body = err?.error;
    if (typeof body === 'string' && body.trim()) {
      return body.trim();
    }
    if (body?.message) {
      return String(body.message);
    }
    if (body?.label) {
      return String(body.label);
    }
    if (err?.message) {
      return String(err.message);
    }
    return fallback;
  }

  completeSale(): void {
    if (this.processing || !this.otcOnlyCart.length) {
      return;
    }
    const billable = this.otcOnlyCart.filter((line) => line.given);
    if (!billable.length) {
      this.flashStatus('Mark at least one line as Given to include it in the bill.', true);
      return;
    }
    const total = this.cartSubtotal;
    if (total <= 0) {
      this.flashStatus('Sale total must be greater than zero.', true);
      return;
    }
    const received = this.effectiveAmountReceived(this.amountReceived, total);
    if (received < total) {
      this.flashStatus('Amount received is less than total due.', true);
      return;
    }

    this.processing = true;
    this.flashStatus('Processing sale…', false);
    const receivedBy = this.loggedInStaffName();

    this.api
      .completeOtcPharmacySale({
        amountReceived: received,
        paymentForm: this.paymentMethod,
        receivedBy,
        notes: this.saleNotes || 'OTC counter sale',
        lines: billable.map((line) => {
          const payload: Record<string, unknown> = {
            treatmentRequestedId: line.treatmentRequestedId,
            given: line.given,
            quantity: line.quantity,
            amountPerFrequencyValue: line.amountPerFrequencyValue ?? undefined,
            amountPerFrequencyUnit: line.amountPerFrequencyUnit || undefined,
            frequencyValue: line.frequencyValue ?? undefined,
            frequencyUnit: line.frequencyUnit ?? undefined,
            durationValue: line.durationValue ?? undefined,
            durationUnit: line.durationUnit ?? undefined,
            totalUnits: line.totalUnits ?? undefined,
            instructions: line.instructions || undefined,
            route: line.route || undefined,
            unitSellingModelId: line.unitSellingModelId ?? undefined,
          };
          if (line.stockBatchId != null && line.stockBatchId > 0) {
            payload['stockBatchId'] = line.stockBatchId;
          } else if (line.itemId != null && line.itemId > 0) {
            payload['itemId'] = line.itemId;
          }
          return payload;
        }),
      })
      .subscribe({
        next: (res: any) => {
          this.processing = false;
          const receivedAmt = received;
          const changeAmt = Math.max(0, receivedAmt - total);
          const cartSnapshot = billable.map((line) => ({ ...line }));
          const saleData = this.extractCompletedSalePayload(res);
          this.openReceiptModal(
            saleData,
            cartSnapshot,
            total,
            receivedAmt,
            changeAmt,
            receivedBy,
            undefined
          );
          const saleNo = saleData?.saleNo ? ` (${saleData.saleNo})` : '';
          this.flashStatus(
            `Sale completed${saleNo} — ${this.formatMoney(total)}. Change: ${this.formatMoney(changeAmt)}.`,
            false
          );
          this.clearCart();
          this.loadPharmacyStock();
          this.loadSalesHistory();
          this.loadDoctorPrescriptions();
        },
        error: (err: any) => {
          this.processing = false;
          this.flashStatus(this.extractApiErrorMessage(err, 'Sale could not be completed.'), true);
        },
      });
  }

  loadSalesHistoryLast7Days(): void {
    this.filterDateFrom = '';
    this.filterDateTo = '';
    const { from, to } = this.getLast7DaysRange();
    this.fetchSalesHistory(from, to);
  }

  applySalesDateFilter(): void {
    const from = (this.filterDateFrom || '').trim();
    const to = (this.filterDateTo || '').trim();
    if (from && to) {
      this.fetchSalesHistory(from, to);
    } else if (!from && !to) {
      this.loadSalesHistoryLast7Days();
    } else {
      this.fetchSalesHistory(from || undefined, to || undefined);
    }
  }

  clearSalesFilters(): void {
    this.filterDateFrom = '';
    this.filterDateTo = '';
    this.salesHistoryDrugSearch = '';
    this.salesHistoryStaffFilter = '';
    this.salesHistorySourceFilter = '';
    this.loadSalesHistoryLast7Days();
  }

  loadSalesHistory(): void {
    const from = (this.filterDateFrom || '').trim();
    const to = (this.filterDateTo || '').trim();
    if (from || to) {
      this.applySalesDateFilter();
      return;
    }
    const { from: f, to: t } = this.getLast7DaysRange();
    this.fetchSalesHistory(f, t);
  }

  private fetchSalesHistory(fromDate?: string, toDate?: string): void {
    this.loadingSalesHistory = true;
    this.salesHistoryError = '';
    const range = {
      from: (fromDate || '').trim() || this.getLast7DaysRange().from,
      to: (toDate || '').trim() || this.getLast7DaysRange().to,
    };

    this.api
      .listOtcPharmacySales(range.from, range.to)
      .pipe(
        map((rows) =>
          (Array.isArray(rows) ? rows : [])
            .map((r) => this.mapHistoryRow(r))
            .sort((a, b) => this.compareSoldRows(b, a))
        ),
        catchError((err) => {
          this.salesHistoryError = err?.message || 'Failed to load sales history.';
          return of([] as OtcSoldRow[]);
        })
      )
      .subscribe((rows) => {
        this.soldRows = rows;
        this.soldOrders = this.groupRowsIntoOrders(rows);
        this.enrichSoldOrdersMissingPatientNames(this.soldOrders);
        this.loadingSalesHistory = false;
      });
  }

  private groupRowsIntoOrders(rows: OtcSoldRow[]): PharmacySoldOrder[] {
    const map = new Map<string, PharmacySoldOrder>();
    for (const row of rows) {
      const key = this.soldOrderGroupKey(row);
      let order = map.get(key);
      if (!order) {
        order = {
          orderKey: key,
          orderNo:
            row.saleNo?.trim() ||
            (row.saleSource === 'RX'
              ? `VISIT-${row.visitId ?? row.saleId}`
              : `OTC-${row.saleId}`),
          saleSource: row.saleSource,
          visitDate: row.visitDate,
          visitTime: row.visitTime,
          visitId: row.visitId,
          visitNumber: row.visitNumber,
          patientName: row.patientName,
          totalCost: 0,
          totalSell: 0,
          amountReceived: this.num(row.amountReceived),
          saleTotalAmount: this.num(row.saleTotalAmount) || undefined,
          lineCount: 0,
          lines: [],
          receivedBy: this.normalizeReceivedBy(row.receivedBy),
        };
        map.set(key, order);
      }
      order.lines.push(row);
      order.lineCount += 1;
      order.totalCost += this.num(row.quantity) * this.num(row.unitBuy);
      order.totalSell += this.num(row.totalAmount);
      if (!order.amountReceived && this.num(row.amountReceived) > 0) {
        order.amountReceived = this.num(row.amountReceived);
      }
      if (!order.saleTotalAmount && this.num(row.saleTotalAmount) > 0) {
        order.saleTotalAmount = this.num(row.saleTotalAmount);
      }
      if (!order.receivedBy) {
        order.receivedBy = this.normalizeReceivedBy(row.receivedBy);
      }
      if (!order.patientName && row.patientName) {
        order.patientName = row.patientName;
      }
      if (!order.visitId && row.visitId) {
        order.visitId = row.visitId;
      }
      if (!order.visitNumber && row.visitNumber) {
        order.visitNumber = row.visitNumber;
      }
    }
    return Array.from(map.values()).sort((a, b) => this.compareSoldOrders(b, a));
  }

  private soldOrderGroupKey(row: OtcSoldRow): string {
    if (row.saleSource === 'RX') {
      const saleId = Number(row.saleId);
      if (Number.isFinite(saleId) && saleId > 0) {
        return `RX-SALE:${saleId}`;
      }
      const visitId = Number(row.visitId);
      if (Number.isFinite(visitId) && visitId > 0) {
        return `RX-VISIT:${visitId}`;
      }
      return `RX:${row.saleNo || row.lineId}`;
    }
    return `OTC:${row.saleId || row.saleNo}`;
  }

  private compareSoldOrders(a: PharmacySoldOrder, b: PharmacySoldOrder): number {
    const da = `${a.visitDate} ${a.visitTime}`;
    const db = `${b.visitDate} ${b.visitTime}`;
    return da.localeCompare(db);
  }

  loadDoctorPrescriptions(): void {
    this.loadingDoctorPrescriptions = true;
    this.doctorPrescriptionsError = '';
    const runLoad = (toModuleId: number | null) => {
      this.api
      .listPendingDoctorPrescriptions(toModuleId)
      .pipe(
        map((rows) =>
          (Array.isArray(rows) ? rows : [])
            .filter((r) => this.isPrescriptionQueuePendingStatus(r?.status))
            .map((r) => this.mapDoctorPrescriptionRow(r))
        ),
        catchError((err) => {
          this.doctorPrescriptionsError =
            err?.error?.message || err?.message || 'Failed to load doctor prescriptions.';
          return of([] as DoctorPrescriptionRow[]);
        })
      )
      .subscribe((rows: DoctorPrescriptionRow[]) => {
        const pendingRows = rows.filter(
          (row) => !this.completedPrescriptionVisitIds.has(row.visitId)
        );
        const doneRows: DoctorPrescriptionRow[] = [];
        for (const visitId of this.completedPrescriptionVisitIds) {
          const snapshot = this.soldPrescriptionVisitSnapshots.get(visitId);
          if (snapshot?.length) {
            doneRows.push(...snapshot);
          }
        }
        this.doctorPrescriptionRows = [...pendingRows, ...doneRows];
        this.applyPrescriptionStockAvailability(pendingRows);
        this.loadingDoctorPrescriptions = false;
        const visits = this.groupedPrescriptionVisits();
        if (!visits.length) {
          this.selectedPrescriptionVisitId = null;
          this.selectedPrescriptionDetailRows = [];
          this.prescriptionSundriesRows = [];
          this.prescriptionSundriesLoading = false;
          return;
        }
        const stillSelected = visits.some(
          (g) => g.visitId === this.selectedPrescriptionVisitId
        );
        if (!stillSelected) {
          const first = visits[0];
          this.selectPrescriptionVisit(first.visitId, first.rows);
        } else if (this.selectedPrescriptionVisitId != null) {
          this.selectPrescriptionVisit(this.selectedPrescriptionVisitId);
        }
      });
    };

    const cached = getQueuePageModuleIdFromSession();
    if (cached) {
      this.pharmacyModuleId = cached;
      runLoad(cached);
      return;
    }
    this.api.getAllHospitalModules().subscribe({
      next: (res: any) => {
        const modules = normalizeHospitalModules(res);
        this.hospitalModules = modules;
        const id = resolveModuleIdForUrl(this.router.url, modules);
        this.pharmacyModuleId = id;
        applyQueuePageModuleToSession(id);
        runLoad(id);
      },
      error: () => runLoad(null),
    });
  }

  private loadPrescriptionSundriesForSelectedVisit(): void {
    const visitId = Number(this.selectedPrescriptionVisitId);
    if (!Number.isFinite(visitId) || visitId <= 0) {
      this.prescriptionSundriesRows = [];
      this.prescriptionSundriesLoading = false;
      return;
    }
    this.prescriptionSundriesLoading = true;
    this.api.getVisitSundriesByVisitId(visitId).subscribe({
      next: (rows: any[]) => {
        const list = Array.isArray(rows) ? rows : [];
        this.prescriptionSundriesRows = list;
        this.prescriptionSundriesLoading = false;
        // Fallback for backends that do not yet return sundries in pending Rx list:
        // merge undispensed sundries into the dispense item lines.
        const alreadyHasSundry = this.selectedPrescriptionDetailRows.some((r) =>
          this.isSundryPrescriptionRow(r)
        );
        if (alreadyHasSundry) {
          this.cdr.markForCheck();
          return;
        }
        const group = this.selectedPrescriptionGroup();
        const mapped = list
          .filter((s) => s && s.dispensed !== true && s.dispensed !== 1 && `${s.dispensed}` !== '1')
          .map((s) =>
            this.mapDoctorPrescriptionRow({
              ...s,
              id: s.id,
              visitSundryId: s.id,
              lineKind: 'SUNDRY',
              quantity: s.quantityUsed ?? s.quantity,
              unitBuy: s.unitCostPrice,
              unitSellingPrice: s.unitSellingPrice,
              totalAmount: s.lineTotal,
              visitId,
              visitNumber: group?.visitNumber ?? 0,
              visitDate: group?.visitDate ?? '',
              visitTime: group?.visitTime ?? '',
              patientName: group?.patientName ?? '',
              patientId: this.selectedPrescriptionDetailRows[0]?.patientId ?? null,
              status: 'pending',
              paid: true,
              dispensed: false,
              route: 'SUNDRY',
              dosage: 'Sundry',
            })
          )
          .filter((r) => r.id > 0 && this.num(r.quantity) > 0);
        if (mapped.length) {
          this.selectedPrescriptionDetailRows = [
            ...this.selectedPrescriptionDetailRows,
            ...mapped,
          ];
          this.syncRxAmountReceivedToSubtotal();
        }
        this.cdr.markForCheck();
      },
      error: () => {
        this.prescriptionSundriesRows = [];
        this.prescriptionSundriesLoading = false;
      },
    });
  }

  openPrescriptionVisit(row: DoctorPrescriptionRow): void {
    const patientId = row?.patientId;
    const visitId = row?.visitId;
    if (!patientId || !visitId) {
      this.flashStatus('Patient or visit not found for this prescription.', true);
      return;
    }
    if (this.openingPrescriptionVisitId != null) {
      return;
    }
    this.openingPrescriptionVisitId = visitId;
    const parts = (row.patientName || '').trim().split(/\s+/);
    const item = {
      id: patientId,
      patientId,
      patientFirstName: parts.slice(1).join(' ') || parts[0] || '',
      patientSecondName: parts.length > 1 ? parts[0] : '',
      patientFileNo: '',
      patientProfilePic: 'assets/images/vector.jpeg',
    };
    this.api.getPatientVisitByVisitId(visitId).subscribe({
      next: (visitRes) => {
        const initialVisit = visitRes != null && typeof visitRes === 'object' ? visitRes : { id: visitId };
        sessionStorage.setItem('item', JSON.stringify(item));
        sessionStorage.setItem('initialPatientVisit', JSON.stringify(initialVisit));
        sessionStorage.setItem('patientVisitOpenTab', 'pharmacy');
        sessionStorage.setItem('pharmacistDispenseMode', 'true');
        this.openingPrescriptionVisitId = null;
        this.router.navigate(['/overview/consultations-center']);
      },
      error: () => {
        sessionStorage.setItem('item', JSON.stringify(item));
        sessionStorage.setItem('initialPatientVisit', JSON.stringify({ id: visitId }));
        sessionStorage.setItem('patientVisitOpenTab', 'pharmacy');
        sessionStorage.setItem('pharmacistDispenseMode', 'true');
        this.openingPrescriptionVisitId = null;
        this.router.navigate(['/overview/consultations-center']);
      },
    });
  }

  private formatDisplayName(name: string | null | undefined): string {
    const raw = String(name ?? '').trim();
    if (!raw || raw === '—') {
      return raw;
    }
    return raw
      .split(/\s+/)
      .map((part) =>
        part ? part.charAt(0).toUpperCase() + part.slice(1).toLowerCase() : ''
      )
      .join(' ');
  }

  private mapDoctorPrescriptionRow(row: any): DoctorPrescriptionRow {
    const time = row?.visitTime != null ? String(row.visitTime) : '';
    const rawUnit = String(row?.amountPerFrequencyUnit ?? '').trim();
    const mappedUnit = rawUnit ? mapPrescribingUnitToDosageUnit(rawUnit) : '';
    const dosageLabel = String(row?.dosage ?? '').trim();
    const lineKindRaw = String(row?.lineKind ?? row?.line_kind ?? '').trim().toUpperCase();
    const visitSundryId =
      row?.visitSundryId != null
        ? Number(row.visitSundryId)
        : row?.visit_sundry_id != null
          ? Number(row.visit_sundry_id)
          : null;
    const isSundry =
      lineKindRaw === 'SUNDRY' ||
      (visitSundryId != null && visitSundryId > 0) ||
      String(row?.route ?? '').toUpperCase() === 'SUNDRY';
    return {
      id: Number(row?.id) || 0,
      patientId: row?.patientId != null ? Number(row.patientId) : null,
      visitId: Number(row?.visitId) || 0,
      visitNumber: Number(row?.visitNumber) || 0,
      visitDate: row?.visitDate != null ? String(row.visitDate) : '',
      visitTime: time.length > 8 ? time.slice(0, 8) : time,
      patientName: this.formatDisplayName(row?.patientName) || '—',
      stockBatchId: row?.stockBatchId != null ? Number(row.stockBatchId) : null,
      itemId: row?.itemId != null ? Number(row.itemId) : null,
      given: row?.paid !== false,
      paid: row?.paid !== false,
      dispensed: row?.dispensed === true || this.isPrescriptionStatusGiven(row?.status),
      administered: row?.administered === true,
      itemName: row?.itemName || (isSundry ? 'Sundry item' : '—'),
      status: row?.status || 'pending',
      prescribedQuantity: this.num(row?.quantity ?? row?.quantityUsed),
      quantity: this.num(row?.quantity ?? row?.quantityUsed),
      unitBuy: this.num(row?.unitBuy ?? row?.unitCostPrice),
      unitSellingPrice: this.num(row?.unitSellingPrice),
      dosage: isSundry
        ? 'Sundry'
        : this.otcPrescribingLabel(
            dosageLabel,
            row?.amountPerFrequencyValue,
            mappedUnit || rawUnit
          ),
      amountPerFrequencyValue: this.numOrNull(row?.amountPerFrequencyValue),
      amountPerFrequencyUnit: mappedUnit || rawUnit,
      frequencyValue: this.numOrNull(row?.frequencyValue),
      frequencyUnit: row?.frequencyUnit ?? null,
      durationValue: this.numOrNull(row?.durationValue),
      durationUnit: row?.durationUnit ?? null,
      totalUnits: this.num(row?.totalUnits ?? row?.quantity ?? row?.quantityUsed),
      totalAmount: this.prescriptionLineAmountFromApi(row),
      instructions: row?.instructions || '',
      route: isSundry ? 'SUNDRY' : row?.route || '',
      lineKind: isSundry ? 'SUNDRY' : 'RX',
      visitSundryId: isSundry ? visitSundryId || Number(row?.id) || null : null,
    };
  }

  private prescriptionLineAmountFromApi(row: any): number {
    const stored = this.num(row?.totalAmount ?? row?.lineTotal);
    if (stored > 0) {
      return stored;
    }
    return this.num(row?.quantity ?? row?.quantityUsed) * this.num(row?.unitSellingPrice);
  }

  private mapHistoryRow(row: any): OtcSoldRow {
    const time = row?.saleTime != null ? String(row.saleTime) : '';
    const qty = this.num(row?.quantity);
    const rawUnit = String(row?.amountPerFrequencyUnit ?? '').trim();
    const mappedUnit = rawUnit ? mapPrescribingUnitToDosageUnit(rawUnit) : '';
    const dosageLabel = String(row?.dosage ?? '').trim();
    const dosage = this.otcPrescribingLabel(
      dosageLabel,
      row?.amountPerFrequencyValue,
      mappedUnit || rawUnit
    );
    const source = this.resolveHistoryRowSaleSource(row);
    const visitId = this.resolveHistoryRowVisitId(row);
    const rawLineId = Number(row?.lineId ?? row?.line_id) || 0;
    const saleId = Number(row?.saleId) || 0;
    const lineId =
      rawLineId > 0 ? rawLineId : source === 'RX' ? saleId : 0;
    return {
      saleSource: source,
      lineId,
      saleId,
      saleNo: row?.saleNo != null ? String(row.saleNo) : '',
      patientName: this.resolveHistoryRowPatientName(row),
      visitId,
      visitNumber: Number(row?.visitNumber ?? row?.visit_number) || 0,
      visitDate: row?.saleDate != null ? String(row.saleDate) : '',
      visitTime: time.length > 8 ? time.slice(0, 8) : time,
      itemName: row?.itemName || '—',
      dosage,
      amountPerFrequencyValue: this.numOrNull(row?.amountPerFrequencyValue),
      amountPerFrequencyUnit: mappedUnit || rawUnit,
      frequencyValue: this.numOrNull(row?.frequencyValue),
      frequencyUnit: row?.frequencyUnit ?? null,
      durationValue: this.numOrNull(row?.durationValue),
      durationUnit: row?.durationUnit ?? null,
      quantity: qty,
      totalUnits: this.num(row?.totalUnits) || qty,
      unitBuy: this.num(row?.unitBuy),
      unitSellingPrice: this.num(row?.unitSellingPrice),
      totalAmount: this.num(row?.totalAmount),
      amountReceived: this.num(row?.amountReceived ?? row?.amount_received),
      saleTotalAmount: this.num(row?.saleTotalAmount ?? row?.sale_total_amount) || undefined,
      receivedBy: this.normalizeReceivedBy(
        row?.receivedBy ?? row?.received_by ?? row?.servedBy ?? row?.served_by
      ),
    };
  }

  private normalizeReceivedBy(value: unknown): string {
    const text = String(value ?? '').trim();
    return text || '';
  }

  private compareSoldRows(a: OtcSoldRow, b: OtcSoldRow): number {
    const da = `${a.visitDate} ${a.visitTime}`;
    const db = `${b.visitDate} ${b.visitTime}`;
    return da.localeCompare(db);
  }

  private getLast7DaysRange(): { from: string; to: string } {
    const to = new Date();
    const from = new Date(to);
    from.setDate(from.getDate() - 7);
    return {
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
    };
  }

  private num(v: unknown): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  private numOrNull(v: unknown): number | null {
    return hasPrescribingNumericValue(v) ? this.num(v) : null;
  }

  private optionalPrescribingNumber(v: unknown): number | null {
    return hasPrescribingNumericValue(v) ? this.num(v) : null;
  }

  /** Line items, costs, and history — always 2 decimal places. */
  formatMoney(amount: number): string {
    return formatMoney2DecimalsDisplay(amount ?? 0);
  }

  /** Items sold tab totals — whole shillings, no decimals. */
  formatSoldMoney(amount: number): string {
    return formatMoneyWholeDisplay(amount ?? 0);
  }

  /** Final payment total due — rounded up to the next 100 shillings. */
  formatPaymentTotal(amount: number): string {
    return formatUgxPaymentTotalDisplay(amount);
  }

  private defaultTreatmentForm(): any {
    return {
      amountPerFrequencyValue: null,
      amountPerFrequencyUnit: '',
      frequencyValue: null,
      frequencyUnit: null,
      durationValue: null,
      durationUnit: null,
      quantity: 1,
      totalUnits: null,
      totalAmount: 0,
      instructions: '',
      route: '',
    };
  }

  /** Treat empty/zero input as "pay exact total" (avoids blocking Complete when field is blank). */
  private effectiveAmountReceived(value: number | null | undefined, total: number): number {
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) {
      return n;
    }
    return total;
  }

  private flashStatus(message: string, isError: boolean): void {
    this.responseMessage = message;
    this.responseColor = isError ? 'rgb(238, 16, 16)' : 'rgb(11, 155, 112)';
    this.showStatusBanner = true;
    if (this.statusBannerTimer) {
      clearTimeout(this.statusBannerTimer);
      this.statusBannerTimer = null;
    }
    if (isError) {
      this.statusBannerTimer = setTimeout(() => (this.showStatusBanner = false), 5000);
      return;
    }
    if (!this.processing) {
      this.statusBannerTimer = setTimeout(() => (this.showStatusBanner = false), 4000);
    }
  }

  private normalizeList(res: any): any[] {
    if (Array.isArray(res)) return res;
    if (Array.isArray(res?.data)) return res.data;
    return [];
  }

  private resolvePharmacyStore(stores: any[]): { id: number | null; name: string } {
    const list = Array.isArray(stores) ? stores : [];
    const storeIdOf = (s: any) => s?.id ?? s?.storeId;
    const storeNameOf = (s: any) => String(s?.name ?? '').trim();
    const raw = sessionStorage.getItem('pharmacyStoreId');
    if (raw) {
      const n = parseInt(raw, 10);
      if (Number.isFinite(n) && n > 0) {
        const match = list.find((s) => Number(storeIdOf(s)) === n);
        return { id: n, name: match ? storeNameOf(match) : 'Pharmacy' };
      }
    }
    const exact = list.find((s) => storeNameOf(s).toLowerCase() === 'pharmacy');
    if (exact) {
      const id = storeIdOf(exact);
      return { id: id != null ? Number(id) : null, name: storeNameOf(exact) };
    }
    const partial = list.find((s) => /pharmacy/i.test(storeNameOf(s)));
    if (partial) {
      const id = storeIdOf(partial);
      return { id: id != null ? Number(id) : null, name: storeNameOf(partial) };
    }
    return { id: null, name: '' };
  }

  private batchStoreId(batch: any): number | null {
    const sid =
      batch?.storeId ?? batch?.store?.id ?? batch?.stockStoreId ?? batch?.locationStoreId;
    const n = Number(sid);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  private batchStoreLabel(batch: any, stores: any[]): string {
    const fromBatch = String(batch?.storeName ?? batch?.store?.name ?? '').trim();
    if (fromBatch) {
      return this.formatDisplayName(fromBatch);
    }
    const sid = this.batchStoreId(batch);
    if (sid == null) {
      return 'Unknown store';
    }
    const storeIdOf = (s: any) => s?.id ?? s?.storeId;
    const storeNameOf = (s: any) => String(s?.name ?? '').trim();
    const match = stores.find((s) => Number(storeIdOf(s)) === sid);
    const label = match ? storeNameOf(match) || `Store #${sid}` : `Store #${sid}`;
    return this.formatDisplayName(label);
  }

  formatTreatmentPeriodUnit(unit: unknown): string {
    return formatTreatmentPeriodUnit(unit);
  }

  formatFrequencyDisplay(
    totalUnits: unknown,
    frequencyValue: unknown,
    frequencyUnit: unknown
  ): string {
    return formatFrequencyDisplay(totalUnits, frequencyValue, frequencyUnit);
  }

  formatDosageDisplay(value: unknown, unit: unknown): string {
    return this.otcPrescribingLabel('', value, unit);
  }

  formatFrequencyDisplayForTable(
    totalUnits: unknown,
    frequencyValue: unknown,
    frequencyUnit: unknown
  ): string {
    const label = formatFrequencyDisplay(totalUnits, frequencyValue, frequencyUnit);
    return label === '—' ? '' : label;
  }

  formatCartDurationDisplay(item: OtcCartLine): string {
    if (!hasPrescribingNumericValue(item.durationValue)) {
      return '';
    }
    const period = this.formatTreatmentPeriodUnit(item.durationUnit);
    return `${item.durationValue}${period ? ` ${period}` : ''}`.trim();
  }

  private otcPrescribingLabel(
    existing: string,
    value: unknown,
    unit: unknown
  ): string {
    const trimmed = String(existing ?? '').trim();
    if (trimmed && trimmed !== '—' && trimmed !== '0') {
      return trimmed;
    }
    const built = formatDosageDisplayLabel(value, unit);
    return built === '—' || built === '0' ? '' : built;
  }

  /** True when a sold row has prescription details (not a quantity-only line). */
  soldRowHasPrescribing(row: OtcSoldRow): boolean {
    const dosage = String(row.dosage ?? '').trim();
    if (dosage && dosage !== '—' && dosage !== '0') {
      return true;
    }
    if (
      hasPrescribingNumericValue(row.amountPerFrequencyValue) &&
      String(row.amountPerFrequencyUnit ?? '').trim()
    ) {
      return true;
    }
    if (hasPrescribingNumericValue(row.frequencyValue)) {
      return true;
    }
    if (hasPrescribingNumericValue(row.durationValue)) {
      return true;
    }
    return false;
  }

  soldRowDosage(row: OtcSoldRow): string {
    if (!this.otcIncludePrescribing || !this.soldRowHasPrescribing(row)) {
      return '';
    }
    return row.dosage;
  }

  soldRowFrequency(row: OtcSoldRow): string {
    if (!this.otcIncludePrescribing || !this.soldRowHasPrescribing(row)) {
      return '';
    }
    return this.formatFrequencyDisplayForTable(
      row.totalUnits,
      row.frequencyValue,
      row.frequencyUnit
    );
  }

  soldRowDuration(row: OtcSoldRow): string {
    if (!this.otcIncludePrescribing || !this.soldRowHasPrescribing(row)) {
      return '';
    }
    if (!hasPrescribingNumericValue(row.durationValue)) {
      return '';
    }
    const period = this.formatTreatmentPeriodUnit(row.durationUnit);
    return `${row.durationValue}${period ? ` ${period}` : ''}`.trim();
  }

  prescriptionRowDosage(row: DoctorPrescriptionRow): string {
    const built = this.formatDosageDisplay(row.amountPerFrequencyValue, row.amountPerFrequencyUnit);
    if (built) {
      return built;
    }
    const fallback = String(row.dosage ?? '').trim();
    return fallback || '—';
  }

  prescriptionRowFrequency(row: DoctorPrescriptionRow): string {
    const dose = this.formatTreatmentFrequencyPart(row.totalUnits ?? row.amountPerFrequencyValue);
    const frequency = this.formatTreatmentFrequencyPart(row.frequencyValue);
    const frequencyUnit = this.formatTreatmentPeriodUnit(row.frequencyUnit);
    if (dose && frequency) {
      return `${dose} X ${frequency}${frequencyUnit ? ` (${frequencyUnit})` : ''}`;
    }
    const label = [dose, frequency].filter(Boolean).join(' X ');
    return label || '—';
  }

  prescriptionRowDuration(row: DoctorPrescriptionRow): string {
    if (!hasPrescribingNumericValue(row.durationValue)) {
      return '—';
    }
    const period = this.formatTreatmentPeriodUnit(row.durationUnit);
    return `${row.durationValue}${period ? ` ${period}` : ''}`.trim();
  }

  prescriptionRowTtCost(row: DoctorPrescriptionRow): number {
    return (row.quantity || 0) * (row.unitBuy || 0);
  }

  prescriptionRowTtSell(row: DoctorPrescriptionRow): number {
    if (row.given) {
      return this.prescriptionLineAmount(row);
    }
    return row.totalAmount || 0;
  }

  private formatTreatmentFrequencyPart(value: unknown): string {
    if (value == null || value === '') {
      return '';
    }
    const n = Number(value);
    if (Number.isFinite(n)) {
      return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2)));
    }
    return String(value).trim();
  }

  closeReceiptModal(): void {
    this.showReceiptModal = false;
    document.body.classList.remove('otc-receipt-modal-open');
  }

  /** Build receipt PDF and open print dialog (falls back to download if pop-ups blocked). */
  async printOtcReceipt(): Promise<void> {
    if (!this.receipt) {
      return;
    }
    await this.facilityBranding.loadLogoDataUrl();
    const pdf = this.buildReceiptPdf(this.receipt);
    const filename = this.receiptPdfFilename(this.receipt);
    const blobUrl = this.pdfBlobUrlString(pdf);
    const win = window.open(blobUrl, '_blank');
    if (!win) {
      pdf.save(filename);
      this.flashStatus('Receipt saved as PDF. Allow pop-ups to print from the browser.', false);
      return;
    }
    const triggerPrint = () => {
      try {
        win.focus();
        win.print();
      } catch {
        /* print may be blocked until PDF loads */
      }
    };
    win.addEventListener('load', triggerPrint);
    setTimeout(triggerPrint, 600);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 120_000);
  }

  downloadReceiptPdf(): void {
    if (!this.receipt) {
      return;
    }
    this.buildReceiptPdf(this.receipt).save(this.receiptPdfFilename(this.receipt));
  }

  private receiptPdfFilename(r: OtcReceiptData): string {
    const safe = String(r.saleNo ?? 'otc').replace(/[^\w-]+/g, '-');
    return `otc-receipt-${safe}.pdf`;
  }

  private pdfBlobUrlString(pdf: jsPDF): string {
    const out = pdf.output('bloburl');
    if (typeof out === 'string') {
      return out;
    }
    if (out instanceof URL) {
      return out.href;
    }
    return String(out);
  }

  private buildReceiptPdf(r: OtcReceiptData): jsPDF {
    const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    const pageW = pdf.internal.pageSize.getWidth();
    const margin = 18;
    const right = pageW - margin;
    const withPrescribing = r.includePrescribing !== false;
    const colItemW = withPrescribing ? 72 : 100;
    const colDosageW = 38;
    const colQtyW = 14;
    const xItem = margin;
    const xDosage = xItem + colItemW;
    const xQty = withPrescribing ? xDosage + colDosageW : xItem + colItemW;
    const xAmt = xQty + colQtyW;
    let y = 22;
    const logoW = 28;
    const logoH = 22;
    if (this.facilityBranding.addLogoToJsPdf(pdf, (pageW - logoW) / 2, y, logoW, logoH)) {
      y += logoH + 4;
    }

    const ensureSpace = (needMm: number) => {
      const pageH = pdf.internal.pageSize.getHeight();
      if (y + needMm > pageH - margin) {
        pdf.addPage();
        y = margin;
      }
    };

    const centerLine = (text: string, size: number, bold = false) => {
      ensureSpace(8);
      pdf.setFont('helvetica', bold ? 'bold' : 'normal');
      pdf.setFontSize(size);
      const w = pdf.getTextWidth(text);
      pdf.text(text, (pageW - w) / 2, y);
      y += size * 0.38 + 3;
    };

    const drawTotalRow = (label: string, value: string, bold = false) => {
      ensureSpace(7);
      pdf.setFont('helvetica', bold ? 'bold' : 'normal');
      pdf.setFontSize(10);
      pdf.text(label, margin, y);
      const vw = pdf.getTextWidth(value);
      pdf.text(value, right - vw, y);
      y += 5.5;
    };

    centerLine(r.facilityName, 14, true);
    centerLine(r.patientName ? 'Pharmacy Visit Sale' : 'OTC Counter Sale', 10);
    if (r.patientName?.trim()) {
      centerLine(`Patient: ${r.patientName.trim()}`, 10, true);
    }
    centerLine(r.saleNo, 11, true);
    centerLine(`${r.saleDateLabel} · ${r.saleTimeLabel}`, 9);
    centerLine(`Served by: ${r.receivedBy}`, 9);
    y += 2;

    ensureSpace(10);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.text('Item', xItem, y);
    if (withPrescribing) {
      pdf.text('Dosage', xDosage, y);
    }
    pdf.text('Qty', xQty + colQtyW - pdf.getTextWidth('Qty'), y);
    pdf.text('Amount', right - pdf.getTextWidth('Amount'), y);
    y += 2;
    pdf.setLineWidth(0.2);
    pdf.line(margin, y, right, y);
    y += 4;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    for (const line of r.lines) {
      const itemLines = pdf.splitTextToSize(line.itemName, colItemW - 2);
      const dosageLines = withPrescribing
        ? pdf.splitTextToSize(line.dosage || '—', colDosageW - 2)
        : [];
      const rowLines = Math.max(itemLines.length, dosageLines.length, 1);
      const rowH = rowLines * 4.2 + 2;
      ensureSpace(rowH);
      const rowY = y;
      pdf.text(itemLines, xItem, rowY);
      if (withPrescribing) {
        pdf.text(dosageLines, xDosage, rowY);
      }
      const qty = String(line.quantity);
      pdf.text(qty, xQty + colQtyW - pdf.getTextWidth(qty), rowY);
      const amt = this.formatMoney(line.lineTotal);
      pdf.text(amt, right - pdf.getTextWidth(amt), rowY);
      y = rowY + rowH;
      pdf.setDrawColor(220);
      pdf.line(margin, y - 1.5, right, y - 1.5);
    }

    y += 2;
    pdf.setDrawColor(0);
    pdf.setLineDashPattern([1, 1], 0);
    pdf.line(margin, y, right, y);
    pdf.setLineDashPattern([], 0);
    y += 6;

    drawTotalRow('Total due', this.formatPaymentTotal(r.subtotal), true);
    drawTotalRow('Payment', r.paymentMethod);
    drawTotalRow('Amount received', this.formatMoney(r.amountReceived), true);
    drawTotalRow('Change', this.formatMoney(r.changeDue), true);

    if (r.notes?.trim()) {
      y += 2;
      ensureSpace(12);
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      const noteLines = pdf.splitTextToSize(`Notes: ${r.notes}`, right - margin);
      pdf.text(noteLines, margin, y);
      y += noteLines.length * 4.2 + 2;
    }

    y += 4;
    centerLine('Thank you', 11, true);
    return pdf;
  }

  private extractCompletedSalePayload(res: any): any {
    const payload = res?.data ?? res;
    if (payload?.sale != null) {
      return payload.sale;
    }
    if (payload?.saleNo != null || Array.isArray(payload?.lines)) {
      return payload;
    }
    if (payload?.data != null) {
      return payload.data;
    }
    return payload;
  }

  private isPrescriptionStatusGiven(status: unknown): boolean {
    const s = String(status ?? '').toLowerCase();
    return s === 'given' || s === 'dispensed';
  }

  /** Pending queue — exclude rows already dispensed or paid. */
  private isPrescriptionQueuePendingStatus(status: unknown): boolean {
    const s = String(status ?? '').toLowerCase();
    return (
      s !== 'given' &&
      s !== 'dispensed' &&
      s !== 'paid' &&
      s !== 'completed' &&
      s !== 'sold'
    );
  }

  /** After a successful sale: mark Done and keep the patient in the table. */
  private markPrescriptionVisitSaleCompleted(
    visitId: number,
    soldRows: DoctorPrescriptionRow[]
  ): void {
    this.completedPrescriptionVisitIds.add(visitId);
    const snapshot = soldRows.map((row) => ({
      ...row,
      status: row.given ? 'dispensed' : String(row.status || 'pending'),
      dispensed: row.given || row.dispensed === true,
      paid: row.given || row.paid !== false,
    }));
    this.soldPrescriptionVisitSnapshots.set(visitId, snapshot);
    for (const row of this.doctorPrescriptionRows) {
      if (row.visitId !== visitId) {
        continue;
      }
      const updated = snapshot.find((s) => s.id === row.id);
      if (updated) {
        row.given = updated.given;
        row.paid = updated.paid;
        row.dispensed = updated.dispensed;
        row.administered = updated.administered;
        row.status = updated.status;
      }
    }
    this.clearPrescriptionVisitCart(visitId, true);
  }

  /** Remove a visit from the table after queuing to the next station. */
  private removePrescriptionVisitFromTable(visitId: number): void {
    this.completedPrescriptionVisitIds.delete(visitId);
    this.soldPrescriptionVisitSnapshots.delete(visitId);
    this.doctorPrescriptionRows = this.doctorPrescriptionRows.filter(
      (row) => row.visitId !== visitId
    );
    this.clearPrescriptionVisitCart(visitId, true);
  }

  private clearPrescriptionVisitCart(visitId: number, deselect: boolean): void {
    this.cart = this.cart.filter(
      (line) => !(line.lineSource === 'RX' && line.visitId === visitId)
    );
    if (deselect && this.selectedPrescriptionVisitId === visitId) {
      this.selectedPrescriptionVisitId = null;
      this.selectedPrescriptionDetailRows = [];
      this.rxAmountReceived = null;
    }
  }

  /** @deprecated Use removePrescriptionVisitFromTable — kept for partial legacy callers. */
  private removeCompletedPrescriptionFromQueue(
    visitId: number,
    soldTreatmentIds: number[]
  ): void {
    if (!soldTreatmentIds.length) {
      return;
    }
    const soldSet = new Set(soldTreatmentIds);
    this.doctorPrescriptionRows = this.doctorPrescriptionRows.filter(
      (row) => !(row.visitId === visitId && soldSet.has(row.id))
    );
    this.cart = this.cart.filter(
      (line) =>
        !(
          line.lineSource === 'RX' &&
          line.visitId === visitId &&
          line.treatmentRequestedId != null &&
          soldSet.has(line.treatmentRequestedId)
        )
    );
    const visitStillQueued = this.doctorPrescriptionRows.some((row) => row.visitId === visitId);
    if (!visitStillQueued && this.selectedPrescriptionVisitId === visitId) {
      this.selectedPrescriptionVisitId = null;
      this.selectedPrescriptionDetailRows = [];
      this.rxAmountReceived = null;
    }
  }

  private notifyPatientVisitPharmacyUpdated(
    visitId: number,
    treatmentRequestedIds: number[],
    res: any
  ): void {
    const payment = this.extractVisitPaymentFromSaleResponse(res);
    this.pharmacyVisitSync.notifyPrescriptionSaleCompleted({
      visitId,
      treatmentRequestedIds,
      amountPaid: payment.amountPaid,
      balanceDue: payment.balanceDue,
      totalAmount: payment.totalAmount,
      visitPaymentRecorded: payment.visitPaymentRecorded,
    });
  }

  private extractVisitPaymentFromSaleResponse(res: any): {
    amountPaid?: number | string;
    balanceDue?: number | string;
    totalAmount?: number | string;
    visitPaymentRecorded?: boolean;
  } {
    const payload = res?.data ?? res;
    const visit = payload?.visit ?? payload?.visitUpdate ?? payload?.patientVisit;
    const invoice = payload?.invoice ?? visit?.invoice;
    return {
      amountPaid:
        visit?.amountPaid ??
        invoice?.amountPaid ??
        payload?.amountPaid ??
        payload?.AmountPaid,
      balanceDue:
        visit?.balanceDue ??
        invoice?.balanceDue ??
        payload?.balanceDue ??
        payload?.BalanceDue,
      totalAmount:
        visit?.totalAmount ??
        invoice?.totalAmount ??
        payload?.totalAmount ??
        payload?.TotalAmount,
      visitPaymentRecorded: payload?.visitPaymentRecorded === true,
    };
  }

  private openReceiptModal(
    saleData: any,
    cartSnapshot: OtcCartLine[],
    subtotal: number,
    amountReceived: number,
    changeDue: number,
    receivedBy: string,
    patientName?: string
  ): void {
    const lines = this.buildReceiptLines(saleData?.lines, cartSnapshot);
    const resolvedPatient =
      patientName?.trim() ||
      String(saleData?.patientName ?? '').trim() ||
      undefined;
    const receiptPrescribing =
      this.otcIncludePrescribing ||
      cartSnapshot.some((l) => this.cartLineHasPrescribing(l));
    this.receipt = {
      saleNo: String(saleData?.saleNo ?? 'OTC'),
      saleDateLabel: this.formatReceiptDate(saleData?.saleDate),
      saleTimeLabel: this.formatReceiptTime(saleData?.saleTime),
      facilityName: this.facilityBranding.getFacilityName(),
      patientName: resolvedPatient,
      receivedBy: String(saleData?.receivedBy ?? receivedBy),
      paymentMethod: String(saleData?.paymentForm ?? this.paymentMethod),
      notes: String(saleData?.notes ?? this.saleNotes ?? '').trim(),
      includePrescribing: receiptPrescribing,
      lines,
      subtotal: this.num(saleData?.totalAmount) || subtotal,
      amountReceived: this.num(saleData?.amountReceived) || amountReceived,
      changeDue: this.num(saleData?.changeAmount) ?? changeDue,
    };
    this.showReceiptModal = true;
    document.body.classList.add('otc-receipt-modal-open');
  }

  private buildReceiptLines(apiLines: unknown, cartSnapshot: OtcCartLine[]): OtcReceiptLine[] {
    if (cartSnapshot.length) {
      return cartSnapshot.map((l) => ({
        itemName: this.cartItemDisplayName(l),
        dosage: this.formatDosageDisplay(l.amountPerFrequencyValue, l.amountPerFrequencyUnit),
        quantity: l.quantity,
        unitPrice: l.unitSellingPrice,
        lineTotal: l.given ? l.totalAmount : 0,
        given: l.given,
        statusNote: l.given ? undefined : 'Not given · Not billed',
      }));
    }
    if (Array.isArray(apiLines) && apiLines.length) {
      return apiLines.map((l: any) => {
        const given = l?.given !== false;
        const qty = this.num(l?.quantity);
        const unitPrice = this.num(l?.unitSellingPrice);
        const lineTotal = given
          ? this.num(l?.totalAmount) || qty * unitPrice
          : 0;
        return {
          itemName: this.otcPlainItemName({ itemName: l?.itemName }),
          dosage:
            String(l?.dosage ?? '').trim() ||
            this.formatDosageDisplay(l?.amountPerFrequencyValue, l?.amountPerFrequencyUnit),
          quantity: qty,
          unitPrice,
          lineTotal,
          given,
          statusNote: given ? undefined : 'Not given · Not billed',
        };
      });
    }
    return [];
  }

  private formatReceiptDate(value: unknown): string {
    if (!value) {
      return new Date().toLocaleDateString();
    }
    const s = String(value).slice(0, 10);
    const d = new Date(s + 'T12:00:00');
    return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString();
  }

  private formatReceiptTime(value: unknown): string {
    if (!value) {
      return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    const s = String(value);
    if (/^\d{1,2}:\d{2}/.test(s)) {
      return s.slice(0, 8);
    }
    return s;
  }

  /** Show inventory unit in the list when it is not one of the standard dropdown values. */
  get customPrefilledDosageUnit(): string {
    const v = String(this.currentTreatmentRequested?.amountPerFrequencyUnit ?? '').trim();
    if (!v || isStandardDosageUnit(v)) {
      return '';
    }
    return v;
  }

  /** Drug name only — strips batch / qty suffix from dropdown title. */
  cartItemDisplayName(line: { itemName?: string }): string {
    return this.otcPlainItemName({ itemName: line?.itemName, title: line?.itemName });
  }

  private otcPlainItemName(source: any): string {
    const name = String(source?.stockItemName ?? source?.itemName ?? '').trim();
    if (name && !name.includes(' — ')) {
      return name;
    }
    const title = String(source?.title ?? name ?? '').trim();
    const sep = title.indexOf(' — ');
    if (sep > 0) {
      return title.slice(0, sep).trim();
    }
    return title.replace(/\s*·\s*Qty:.*$/i, '').trim() || 'Item';
  }

  private formatBatchExpiryShort(batch: any): string {
    const dt = this.parseBatchExpiryDate(batch);
    return dt ? this.formatExpiryDateLabel(dt) : '';
  }

  private formatExpiryDateLabel(dt: Date): string {
    return `${dt.getDate()}/${dt.getMonth() + 1}/${dt.getFullYear()}`;
  }

  private parseBatchExpiryDate(batch: any): Date | null {
    const raw =
      batch?.expiryDate ??
      batch?.expiry ??
      batch?.expireDate ??
      batch?.expirationDate ??
      batch?.expiry_date;
    return this.parseExpiryValue(raw);
  }

  /** Parse API expiry values (ISO, YYYY/MM/DD, Java LocalDate array, {year,month,day}). */
  private parseExpiryValue(raw: unknown): Date | null {
    if (raw == null || raw === '') {
      return null;
    }
    if (typeof raw === 'object' && !Array.isArray(raw)) {
      const obj = raw as { year?: unknown; month?: unknown; day?: unknown };
      if (obj.year != null && obj.month != null && obj.day != null) {
        return this.buildExpiryDate(Number(obj.year), Number(obj.month), Number(obj.day));
      }
      return null;
    }
    if (Array.isArray(raw) && raw.length >= 3) {
      let y = Number(raw[0]);
      let m = Number(raw[1]);
      let d = Number(raw[2]);
      if (y <= 31 && d >= 100) {
        [y, d] = [d, y];
      }
      return this.buildExpiryDate(y, m, d);
    }
    if (typeof raw === 'number' && raw >= 19000101 && raw <= 29991231) {
      const s = String(Math.trunc(raw));
      if (s.length === 8) {
        return this.buildExpiryDate(Number(s.slice(0, 4)), Number(s.slice(4, 6)), Number(s.slice(6, 8)));
      }
    }
    const text = String(raw).trim();
    const slashMatch = text.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
    if (slashMatch) {
      return this.buildExpiryDate(
        Number(slashMatch[1]),
        Number(slashMatch[2]),
        Number(slashMatch[3])
      );
    }
    const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      return this.buildExpiryDate(
        Number(isoMatch[1]),
        Number(isoMatch[2]),
        Number(isoMatch[3])
      );
    }
    const parsed = new Date(text);
    if (!Number.isNaN(parsed.getTime())) {
      parsed.setHours(0, 0, 0, 0);
      return parsed;
    }
    return null;
  }

  private buildExpiryDate(year: number, month: number, day: number): Date | null {
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
      return null;
    }
    if (year < 100) {
      year += year >= 70 ? 1900 : 2000;
    }
    const monthIdx = month >= 1 && month <= 12 ? month - 1 : month;
    const dt = new Date(year, monthIdx, day);
    dt.setHours(0, 0, 0, 0);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }

  private batchExpiryToneFromDate(expiry: Date): 'danger' | 'warning' | 'safe' {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const exp = new Date(expiry);
    exp.setHours(0, 0, 0, 0);
    if (exp.getTime() < today.getTime()) {
      return 'danger';
    }
    const fullYears = this.fullYearsUntil(exp, today);
    if (fullYears < 1) {
      return 'danger';
    }
    if (fullYears < 2) {
      return 'warning';
    }
    return 'safe';
  }

  private fullYearsUntil(expiry: Date, today: Date): number {
    let years = expiry.getFullYear() - today.getFullYear();
    const monthDiff = expiry.getMonth() - today.getMonth();
    const dayDiff = expiry.getDate() - today.getDate();
    if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
      years--;
    }
    return years;
  }

  private batchLineExpiryInfo(distributions: any[]): {
    label: string;
    tone: 'danger' | 'warning' | 'safe' | 'unknown';
  } {
    for (const row of distributions) {
      const dt = this.parseBatchExpiryDate(row);
      if (!dt) {
        continue;
      }
      return {
        label: this.formatExpiryDateLabel(dt),
        tone: this.batchExpiryToneFromDate(dt),
      };
    }
    return { label: '', tone: 'unknown' };
  }

  private mapStockBatchToTreatmentDropdownItem(batch: any): any {
    if (!batch) {
      return { id: null, title: '', sellingPrice: 0, stockAtHand: 0, costPrice: 0, uintOfMeasure: '' };
    }
    const stockItemId =
      batch.stockItemId ??
      batch.stockItem?.id ??
      batch.consumableItemId ??
      batch.consumableItems?.id ??
      batch.itemId;
    const name = this.plainDrugName(batch);
    const batchPart =
      batch.batchNumber != null && String(batch.batchNumber).trim() !== ''
        ? `Batch ${batch.batchNumber}`
        : `Batch #${batch.id ?? '?'}`;
    const expiryLabel = this.formatBatchExpiryShort(batch);
    const storeId = Number(batch?.storeId ?? batch?.store_id ?? 0) || null;
    const storeName = this.resolveStoreDisplayName(
      storeId ?? 0,
      batch?.storeName ?? batch?.store_name
    );
    const title = this.stockBatchTreatmentLabel(batch);
    const prescribing = resolveStockPrescribingSource(batch);
    const prescribingUnit =
      batch.lastUnitOfPrescribingMeasureStrengthUnitTitle ??
      batch.amountPerFrequencyUnit ??
      batch.dosageUnit ??
      prescribing['lastUnitOfPrescribingMeasureStrengthUnitTitle'] ??
      prescribing['amountPerFrequencyUnit'] ??
      '';
    return {
      ...prescribing,
      ...batch,
      stockItemId: stockItemId ?? batch.id,
      stockItemName: name,
      storeId,
      storeName,
      batchLabel: batchPart,
      expiryLabel,
      lastUnitOfPrescribingMeasureStrengthUnitTitle: prescribingUnit,
      amountPerFrequencyUnit: prescribingUnit || batch.amountPerFrequencyUnit,
      dosageUnit: prescribingUnit || batch.dosageUnit,
      id: stockItemId ?? batch.id,
      title,
      plainName: name,
      sellingPrice:
        batch.sellingPrice ??
        batch.unitSellingPrice ??
        batch.salePrice ??
        batch.unitSalePrice ??
        0,
      stockAtHand:
        batch.stockAtHand ??
        batch.stock_at_hand ??
        batch.quantityOnHand ??
        batch.qtyOnHand ??
        0,
      costPrice:
        batch.costPrice ??
        batch.unitCostPrice ??
        batch.buyPrice ??
        0,
      uintOfMeasure:
        batch.uintOfMeasure ??
        batch.unitOfMeasure ??
        batch.uom ??
        '',
      lastUnitValue: batch.lastUnitValue,
      _stockBatchId: batch.id,
      unitSellingModelId: batch.unitSellingModelId ?? batch.unit_selling_model_id ?? null,
    };
  }

  private plainDrugName(batch: any): string {
    return String(batch?.stockItemName || batch?.itemName || 'Item').trim();
  }

  private resolveStoreDisplayName(storeId: number, batchFallback?: string): string {
    const id = Number(storeId);
    if (Number.isFinite(id) && id > 0 && this.storeList?.length) {
      const store = this.storeList.find((s) => Number(s?.id ?? s?.storeId) === id);
      if (store) {
        const name = String(store?.name ?? store?.storeName ?? '').trim();
        if (name) {
          return name;
        }
      }
    }
    const fromBatch = String(batchFallback ?? '').trim();
    if (fromBatch) {
      return fromBatch;
    }
    return Number.isFinite(id) && id > 0 ? `Store #${id}` : 'Unknown store';
  }

  private stockBatchTreatmentLabel(batch: any): string {
    if (!batch) {
      return '';
    }
    const name = this.plainDrugName(batch);
    const batchNo =
      batch.batchNumber != null && String(batch.batchNumber).trim() !== ''
        ? String(batch.batchNumber).trim()
        : String(batch.id ?? '?');
    const expiry = this.formatBatchExpiryShort(batch);
    const uom = String(
      batch.uintOfMeasure ?? batch.unitOfMeasure ?? batch.uom ?? this.unitOfMeasure ?? ''
    ).trim();
    const uomSuffix = uom ? ` ${uom}` : '';
    const parts = [name, `BTH ${batchNo}`];
    if (expiry) {
      parts.push(`EX ${expiry}`);
    }
    const storeName = String(batch?.storeName ?? batch?.store_name ?? '').trim();
    const hand = Number(batch?.stockAtHand ?? batch?.stock_at_hand ?? 0);
    if (storeName && hand > 0) {
      parts.push(`${storeName} ${hand}${uomSuffix}`);
    }
    return parts.join(' · ');
  }
}
