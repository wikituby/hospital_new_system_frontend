import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, Subscription, of } from 'rxjs';
import { catchError, switchMap, takeUntil } from 'rxjs/operators';
import { ApiService, FilterVisitsQuery } from '../services/api.service';
import { ThemeService } from '../services/theme.service';
import {
  downloadBlob,
  exportVisitsTableToExcel,
  sanitizeFilenamePart,
  sortVisitsLatestFirst,
} from '../utils/group-medical-invoice-export.util';
import { userHasRole } from '../utils/user-roles.util';

interface PharmacySoldOrderSummary {
  orderKey: string;
  saleSource: 'OTC' | 'RX';
  visitId?: number | null;
  totalCost: number;
  totalSell: number;
  amountReceived: number;
}

@Component({
  selector: 'app-patient-visits-list',
  templateUrl: './patient-visits-list.component.html',
  styleUrls: ['./patient-visits-list.component.css']
})
export class PatientVisitsListComponent implements OnInit, OnDestroy {
  visits: any[] = [];
  /** Sorted once when visits load — avoid re-sorting on every change detection. */
  filteredVisits: any[] = [];
  loading = true;
  error: string | null = null;
  exportMessage: string | null = null;
  exportInProgress = false;
  exportMenuOpen = false;
  isDarkMode = false;
  private themeSub?: Subscription;
  private readonly destroy$ = new Subject<void>();
  private readonly filterTrigger$ = new Subject<{ from?: string; to?: string }>();

  filterDateFrom = '';
  filterDateTo = '';
  /** Date range actually used for the current visit list / totals. */
  appliedDateFrom = '';
  appliedDateTo = '';
  filterPatientName = '';
  filterDiagnosis = '';
  filterAgeFrom: number | null = null;
  filterAgeTo: number | null = null;
  filterGender = '';
  filterDebt = '';
  filterWeightFrom: number | null = null;
  filterWeightTo: number | null = null;

  patientGroupsList: any[] = [];
  patientGroupsSortedCache: any[] = [];
  patientGroupsLoading = false;
  selectedPatientGroupId: number | null = null;
  groupDropdownOpen = false;
  groupSearchQuery = '';

  servicesOfferedList: any[] = [];
  servicesOfferedSortedCache: any[] = [];
  servicesOfferedLoading = false;
  selectedOfferedServiceId: any = null;
  procedureDropdownOpen = false;
  procedureSearchQuery = '';

  drugList: any[] = [];
  drugListSortedCache: any[] = [];
  drugListLoading = false;
  selectedTreatmentItemId: any = null;
  drugDropdownOpen = false;
  drugSearchQuery = '';

  filtersCollapsed = false;
  isMdUser = false;

  showPayAllDebtsModal = false;
  payAllInProgress = false;
  payAllPaymentForm = 'cash';

  expenseTransactions: any[] = [];
  expenseTransactionsTotal = 0;

  /** Pharmacy Items sold tab — grouped orders for the applied date range. */
  pharmacySoldOrders: PharmacySoldOrderSummary[] = [];
  pharmacyTotalCost = 0;
  pharmacyTotalSell = 0;
  pharmacyAmountReceived = 0;

  /** Cached stats so templates don't re-walk the list every CD cycle. */
  totalAmountPaid = 0;
  /** Total sell (visits + pharmacy counter / non-duplicated RX). */
  totalVisitCost = 0;
  /** Total cost (visits + pharmacy counter / non-duplicated RX). */
  totalCostAmount = 0;
  totalDebtAmount = 0;
  visitsWithDebtCount = 0;
  totalProfit = 0;

  constructor(
    private api: ApiService,
    private router: Router,
    private themeService: ThemeService
  ) {}

  ngOnInit(): void {
    this.themeSub = this.themeService.isDarkMode$.subscribe((isDark) => {
      this.isDarkMode = isDark;
    });
    // Pay All Debts is MD-only (primary or secondary role).
    this.isMdUser = userHasRole('md');
    this.setupFilterPipeline();
    this.loadPatientGroups();
    this.loadServicesOffered();
    this.loadDrugList();
    this.loadLast7Days();
  }

  ngOnDestroy(): void {
    this.themeSub?.unsubscribe();
    this.destroy$.next();
    this.destroy$.complete();
  }

  private setupFilterPipeline(): void {
    this.filterTrigger$
      .pipe(
        switchMap(({ from, to }) => {
          this.loading = true;
          this.error = null;
          const query = this.buildFilterQuery(from, to);
          this.appliedDateFrom = String(query.datefrom || '').trim();
          this.appliedDateTo = String(query.dateto || '').trim();
          this.pharmacySoldOrders = [];
          this.loadExpenseTransactionsTotal();
          this.loadPharmacySalesTotals();
          return this.api.filterVisits(query).pipe(
            catchError((err: any) => {
              this.error = err?.message || 'Failed to load visits';
              return of([]);
            })
          );
        }),
        takeUntil(this.destroy$)
      )
      .subscribe((data: any) => {
        this.setVisits(Array.isArray(data) ? data : []);
        this.loading = false;
      });
  }

  private setVisits(list: any[]): void {
    this.visits = list || [];
    this.filteredVisits = sortVisitsLatestFirst(this.visits);
    this.recomputeVisitStats();
  }

  private recomputeVisitStats(): void {
    let paid = 0;
    let visitSell = 0;
    let visitCost = 0;
    let debt = 0;
    let debtCount = 0;
    const visitIds = new Set<number>();
    for (const visit of this.filteredVisits) {
      const visitId = Number(visit?.id ?? visit?.visitId);
      if (Number.isFinite(visitId) && visitId > 0) {
        visitIds.add(visitId);
      }
      const paidVal = Number(visit?.amountPaid);
      const sellVal = Number(visit?.totalAmount);
      const costVal = Number(visit?.totalCost);
      const bal = Number(visit?.balanceDue);
      if (Number.isFinite(paidVal)) {
        paid += paidVal;
      }
      if (Number.isFinite(sellVal)) {
        visitSell += sellVal;
      }
      if (Number.isFinite(costVal)) {
        visitCost += costVal;
      }
      if (Number.isFinite(bal) && bal > 0) {
        debt += bal;
        debtCount += 1;
      }
    }

    let pharmaSell = 0;
    let pharmaCost = 0;
    let pharmaPaid = 0;
    for (const order of this.pharmacySoldOrders) {
      if (order.saleSource === 'RX' && order.visitId && visitIds.has(Number(order.visitId))) {
        continue;
      }
      pharmaSell += order.totalSell;
      pharmaCost += order.totalCost;
      pharmaPaid += order.amountReceived;
    }

    this.pharmacyTotalSell = pharmaSell;
    this.pharmacyTotalCost = pharmaCost;
    this.pharmacyAmountReceived = pharmaPaid;
    this.totalAmountPaid = paid + pharmaPaid;
    this.totalVisitCost = visitSell + pharmaSell;
    this.totalCostAmount = visitCost + pharmaCost;
    this.totalDebtAmount = debt;
    this.visitsWithDebtCount = debtCount;
    this.totalProfit = this.totalVisitCost - this.totalCostAmount - this.totalExpense;
  }

  private loadPharmacySalesTotals(): void {
    const from = this.appliedDateFrom;
    const to = this.appliedDateTo;
    if (!from && !to) {
      this.pharmacySoldOrders = [];
      this.recomputeVisitStats();
      return;
    }
    this.api.listOtcPharmacySales(from, to).subscribe({
      next: (rows: any) => {
        this.pharmacySoldOrders = this.groupPharmacyRowsIntoOrders(Array.isArray(rows) ? rows : []);
        this.recomputeVisitStats();
      },
      error: () => {
        this.pharmacySoldOrders = [];
        this.recomputeVisitStats();
      },
    });
  }

  private groupPharmacyRowsIntoOrders(rows: any[]): PharmacySoldOrderSummary[] {
    const map = new Map<string, PharmacySoldOrderSummary>();
    for (const raw of rows) {
      const row = this.mapPharmacySaleRow(raw);
      const key = this.pharmacyOrderGroupKey(row);
      let order = map.get(key);
      if (!order) {
        order = {
          orderKey: key,
          saleSource: row.saleSource,
          visitId: row.visitId,
          totalCost: 0,
          totalSell: 0,
          amountReceived: row.amountReceived,
        };
        map.set(key, order);
      }
      order.totalCost += row.unitBuy * row.quantity;
      order.totalSell += row.totalAmount;
      if (!order.amountReceived && row.amountReceived) {
        order.amountReceived = row.amountReceived;
      }
    }
    return Array.from(map.values());
  }

  private mapPharmacySaleRow(row: any): {
    saleSource: 'OTC' | 'RX';
    visitId?: number | null;
    saleId: number;
    saleNo: string;
    lineId: number;
    quantity: number;
    unitBuy: number;
    totalAmount: number;
    amountReceived: number;
  } {
    const sourceRaw = String(row?.saleSource ?? '').trim().toUpperCase();
    const visitId = Number(row?.visitId ?? row?.visit_id);
    const saleId = Number(row?.saleId ?? row?.sale_id) || 0;
    const lineId = Number(row?.lineId ?? row?.line_id) || saleId;
    const qty = Number(row?.quantity);
    const quantity = Number.isFinite(qty) ? qty : 0;
    const unitBuy = Number(row?.unitBuy ?? row?.unit_buy);
    const totalAmount = Number(row?.totalAmount ?? row?.total_amount);
    const amountReceived = Number(row?.amountReceived ?? row?.amount_received ?? row?.saleTotalAmount);
    return {
      saleSource: sourceRaw === 'RX' || (Number.isFinite(visitId) && visitId > 0) ? 'RX' : 'OTC',
      visitId: Number.isFinite(visitId) && visitId > 0 ? visitId : null,
      saleId,
      saleNo: String(row?.saleNo ?? row?.sale_no ?? '').trim(),
      lineId,
      quantity,
      unitBuy: Number.isFinite(unitBuy) ? unitBuy : 0,
      totalAmount: Number.isFinite(totalAmount) ? totalAmount : 0,
      amountReceived: Number.isFinite(amountReceived) ? amountReceived : 0,
    };
  }

  private pharmacyOrderGroupKey(row: {
    saleSource: 'OTC' | 'RX';
    visitId?: number | null;
    saleId: number;
    saleNo: string;
    lineId: number;
  }): string {
    if (row.saleSource === 'RX') {
      if (row.saleId > 0) {
        return `RX-SALE:${row.saleId}`;
      }
      if (row.visitId) {
        return `RX-VISIT:${row.visitId}`;
      }
      return `RX:${row.saleNo || row.lineId}`;
    }
    return `OTC:${row.saleId || row.saleNo || row.lineId}`;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const t = event.target as HTMLElement;
    if (!t.closest('.procedure-select-wrapper')) {
      this.procedureDropdownOpen = false;
      this.drugDropdownOpen = false;
      this.groupDropdownOpen = false;
    }
    if (!t.closest('.export-menu-wrapper')) {
      this.exportMenuOpen = false;
    }
  }

  get patientGroupsSorted(): any[] {
    return this.patientGroupsSortedCache;
  }

  get filteredGroupsForDropdown(): any[] {
    const sorted = this.patientGroupsSortedCache;
    const q = (this.groupSearchQuery || '').trim().toLowerCase();
    if (!q) {
      return sorted;
    }
    return sorted.filter((g) => {
      const name = String(g?.groupName ?? '').toLowerCase();
      const short = String(g?.groupNameShortForm ?? '').toLowerCase();
      return name.includes(q) || short.includes(q);
    });
  }

  get selectedPatientGroup(): any | null {
    if (this.selectedPatientGroupId == null) {
      return null;
    }
    return (
      this.patientGroupsList.find((g) => g != null && Number(g.id) === Number(this.selectedPatientGroupId)) ?? null
    );
  }

  get selectedGroupLabel(): string {
    if (this.patientGroupsLoading) {
      return 'Loading groups…';
    }
    const group = this.selectedPatientGroup;
    if (!group) {
      return 'Select patient group';
    }
    const name = String(group.groupName ?? '').trim();
    const short = String(group.groupNameShortForm ?? '').trim();
    return short && short !== name ? `${name} (${short})` : name || short || 'Patient group';
  }

  toggleGroupDropdown(): void {
    if (this.patientGroupsLoading) {
      return;
    }
    this.groupDropdownOpen = !this.groupDropdownOpen;
    if (this.groupDropdownOpen) {
      this.groupSearchQuery = '';
    }
  }

  selectPatientGroupOption(group: any | null): void {
    this.selectedPatientGroupId = group?.id != null ? Number(group.id) : null;
    this.groupDropdownOpen = false;
    this.groupSearchQuery = '';
  }

  isGroupRowSelected(group: any): boolean {
    return Number(this.selectedPatientGroupId) === Number(group?.id);
  }

  trackByGroupId(_: number, g: any): unknown {
    return g?.id;
  }

  toggleExportMenu(): void {
    if (this.exportInProgress) {
      return;
    }
    this.exportMenuOpen = !this.exportMenuOpen;
  }

  get servicesOfferedSorted(): any[] {
    return this.servicesOfferedSortedCache;
  }

  get filteredServicesForDropdown(): any[] {
    const sorted = this.servicesOfferedSortedCache;
    const q = (this.procedureSearchQuery || '').trim().toLowerCase();
    if (!q) {
      return sorted;
    }
    return sorted.filter((s) =>
      String(s?.procedureName ?? '')
        .toLowerCase()
        .includes(q)
    );
  }

  get selectedProcedureLabel(): string {
    if (this.selectedOfferedServiceId == null || this.selectedOfferedServiceId === '') {
      return 'All services';
    }
    const want = Number(this.selectedOfferedServiceId);
    if (Number.isNaN(want)) {
      return 'All services';
    }
    const row = this.servicesOfferedList.find((s) => s != null && Number(s.id) === want);
    const name = row?.procedureName;
    return name != null && String(name).trim() !== '' ? String(name) : 'All services';
  }

  toggleProcedureDropdown(): void {
    if (this.servicesOfferedLoading) {
      return;
    }
    this.procedureDropdownOpen = !this.procedureDropdownOpen;
    if (this.procedureDropdownOpen) {
      this.procedureSearchQuery = '';
    }
  }

  selectProcedureOption(service: any | null): void {
    this.selectedOfferedServiceId = service?.id ?? null;
    this.procedureDropdownOpen = false;
    this.procedureSearchQuery = '';
  }

  isProcedureRowSelected(service: any): boolean {
    if (this.selectedOfferedServiceId == null || this.selectedOfferedServiceId === '') {
      return false;
    }
    return Number(this.selectedOfferedServiceId) === Number(service?.id);
  }

  trackByProcedureId(_: number, s: any): unknown {
    return s?.id;
  }

  get drugListSorted(): any[] {
    return this.drugListSortedCache;
  }

  get filteredDrugsForDropdown(): any[] {
    const sorted = this.drugListSortedCache;
    const q = (this.drugSearchQuery || '').trim().toLowerCase();
    if (!q) {
      return sorted;
    }
    return sorted.filter((d) => this.drugDisplayName(d).toLowerCase().includes(q));
  }

  get selectedDrugLabel(): string {
    if (this.selectedTreatmentItemId == null || this.selectedTreatmentItemId === '') {
      return 'All drugs';
    }
    const want = Number(this.selectedTreatmentItemId);
    if (Number.isNaN(want)) {
      return 'All drugs';
    }
    const row = this.drugList.find((d) => d != null && Number(d.id) === want);
    const name = row ? this.drugDisplayName(row) : '';
    return name.trim() !== '' ? name : 'All drugs';
  }

  drugDisplayName(drug: any): string {
    return String(drug?.stockItemName ?? drug?.itemName ?? drug?.title ?? '—');
  }

  toggleDrugDropdown(): void {
    if (this.drugListLoading) {
      return;
    }
    this.drugDropdownOpen = !this.drugDropdownOpen;
    if (this.drugDropdownOpen) {
      this.drugSearchQuery = '';
    }
  }

  selectDrugOption(drug: any | null): void {
    this.selectedTreatmentItemId = drug?.id ?? null;
    this.drugDropdownOpen = false;
    this.drugSearchQuery = '';
  }

  isDrugRowSelected(drug: any): boolean {
    if (this.selectedTreatmentItemId == null || this.selectedTreatmentItemId === '') {
      return false;
    }
    return Number(this.selectedTreatmentItemId) === Number(drug?.id);
  }

  trackByDrugId(_: number, d: any): unknown {
    return d?.id;
  }

  private loadPatientGroups(): void {
    this.patientGroupsLoading = true;
    this.api.getAllPatientGroups().subscribe({
      next: (groups: any) => {
        this.patientGroupsList = Array.isArray(groups) ? groups : [];
        this.patientGroupsSortedCache = [...this.patientGroupsList].sort((a, b) =>
          String(a?.groupName ?? '')
            .toLowerCase()
            .localeCompare(String(b?.groupName ?? '').toLowerCase())
        );
        this.patientGroupsLoading = false;
      },
      error: () => {
        this.patientGroupsList = [];
        this.patientGroupsSortedCache = [];
        this.patientGroupsLoading = false;
      }
    });
  }

  private loadDrugList(): void {
    this.drugListLoading = true;
    this.api.getAllStockItems().subscribe({
      next: (res: any) => {
        this.drugList = Array.isArray(res) ? res : [];
        this.drugListSortedCache = [...this.drugList].sort((a, b) =>
          this.drugDisplayName(a)
            .toLowerCase()
            .localeCompare(this.drugDisplayName(b).toLowerCase())
        );
        this.drugListLoading = false;
      },
      error: () => {
        this.drugList = [];
        this.drugListSortedCache = [];
        this.drugListLoading = false;
      }
    });
  }

  private loadServicesOffered(): void {
    this.servicesOfferedLoading = true;
    this.api.getAllServices().subscribe({
      next: (res: any) => {
        this.servicesOfferedList = Array.isArray(res) ? res : [];
        this.servicesOfferedSortedCache = [...this.servicesOfferedList].sort((a, b) =>
          String(a?.procedureName ?? '')
            .toLowerCase()
            .localeCompare(String(b?.procedureName ?? '').toLowerCase())
        );
        this.servicesOfferedLoading = false;
      },
      error: () => {
        this.servicesOfferedList = [];
        this.servicesOfferedSortedCache = [];
        this.servicesOfferedLoading = false;
      }
    });
  }

  private getLast7DaysRange(): { from: string; to: string } {
    const to = new Date();
    const from = new Date(to);
    from.setDate(from.getDate() - 7);
    return {
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10)
    };
  }

  loadLast7Days(): void {
    const { from, to } = this.getLast7DaysRange();
    this.filterDateFrom = '';
    this.filterDateTo = '';
    this.fetchVisitsWithFilters(from, to);
  }

  private buildFilterQuery(fromDate?: string, toDate?: string): FilterVisitsQuery {
    const useExplicit = fromDate != null || toDate != null;
    const range = useExplicit
      ? { from: (fromDate || '').trim(), to: (toDate || '').trim() }
      : this.getLast7DaysRange();

    const patientName = (this.filterPatientName || '').trim();
    const diagnosis = (this.filterDiagnosis || '').trim();
    const group = this.selectedPatientGroup;
    const patientGroupId =
      this.selectedPatientGroupId != null && !Number.isNaN(Number(this.selectedPatientGroupId))
        ? Number(this.selectedPatientGroupId)
        : undefined;
    // Legacy text fallback only when the dropdown has no id (should not happen for normal UI use).
    const visitGroup =
      patientGroupId != null
        ? undefined
        : String(group?.groupNameShortForm || group?.groupName || '').trim();

    let procedureId: number | undefined;
    if (this.selectedOfferedServiceId != null && this.selectedOfferedServiceId !== '') {
      const n = Number(this.selectedOfferedServiceId);
      if (!Number.isNaN(n)) {
        procedureId = n;
      }
    }

    const ageFrom = this.parseNumericFilter(this.filterAgeFrom);
    const ageTo = this.parseNumericFilter(this.filterAgeTo);
    const patientGender = (this.filterGender || '').trim();
    const debtFilter = (this.filterDebt || '').trim();
    let hasDebt: boolean | undefined;
    if (debtFilter === 'with_debt') {
      hasDebt = true;
    } else if (debtFilter === 'no_debt') {
      hasDebt = false;
    }
    const weightFrom = this.parseNumericFilter(this.filterWeightFrom);
    const weightTo = this.parseNumericFilter(this.filterWeightTo);

    let treatmentItemId: number | undefined;
    if (this.selectedTreatmentItemId != null && this.selectedTreatmentItemId !== '') {
      const n = Number(this.selectedTreatmentItemId);
      if (!Number.isNaN(n)) {
        treatmentItemId = n;
      }
    }

    return {
      patientGroupId,
      visitGroup: visitGroup || undefined,
      datefrom: range.from || undefined,
      dateto: range.to || undefined,
      patientName: patientName || undefined,
      diagnosis: diagnosis || undefined,
      procedureId,
      ageFrom,
      ageTo,
      patientGender: patientGender || undefined,
      hasDebt,
      weightFrom,
      weightTo,
      treatmentItemId
    };
  }

  private fetchVisitsWithFilters(fromDate?: string, toDate?: string): void {
    this.filterTrigger$.next({ from: fromDate, to: toDate });
  }

  private loadExpenseTransactionsTotal(): void {
    this.api.getAllExpensesMade().subscribe({
      next: (data: any) => {
        const all = Array.isArray(data) ? data : [];
        const from = this.appliedDateFrom;
        const to = this.appliedDateTo;
        const filtered = all.filter((t: any) => {
          if (t.reversed) return false;
          const rawDate = String(t.dateOfExpenseTransaction || t.transactionDate || t.date || '').trim();
          if (!rawDate) return false;
          const d = rawDate.replace(/\//g, '-').substring(0, 10);
          if (from && d < from) return false;
          if (to && d > to) return false;
          return true;
        });
        this.expenseTransactionsTotal = filtered.reduce((sum: number, t: any) => {
          const amt = Number(t.amountTransacted ?? t.amount ?? 0);
          return sum + (Number.isFinite(amt) ? amt : 0);
        }, 0);
        this.recomputeVisitStats();
      },
      error: () => {
        this.expenseTransactionsTotal = 0;
        this.recomputeVisitStats();
      }
    });
  }

  get totalsDateRangeLabel(): string {
    if (this.appliedDateFrom && this.appliedDateTo) {
      return `${this.appliedDateFrom} → ${this.appliedDateTo}`;
    }
    if (this.appliedDateFrom) {
      return `From ${this.appliedDateFrom}`;
    }
    if (this.appliedDateTo) {
      return `Until ${this.appliedDateTo}`;
    }
    return 'Current filters';
  }

  applyDateFilter(): void {
    const from = (this.filterDateFrom || '').trim();
    const to = (this.filterDateTo || '').trim();
    if (from && to) {
      this.fetchVisitsWithFilters(from, to);
    } else if (!from && !to) {
      this.loadLast7Days();
    } else {
      this.fetchVisitsWithFilters(from || undefined, to || undefined);
    }
  }

  get totalExpense(): number {
    return this.expenseTransactionsTotal;
  }

  trackByVisitId(_: number, visit: any): unknown {
    return visit?.id ?? visit?.visitId;
  }

  formatAmount(value: unknown): string {
    if (value == null || value === '') {
      return '–';
    }
    const n = Number(value);
    if (!Number.isFinite(n)) {
      return String(value);
    }
    return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }

  formatVisitDate(value: unknown): string {
    const raw = String(value ?? '').trim();
    if (!raw) {
      return '—';
    }
    const isoDay = raw.match(/^(\d{4}-\d{2}-\d{2})/);
    if (isoDay) {
      return isoDay[1];
    }
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }
    return raw;
  }

  clientInitials(visit: any): string {
    const parts = String(visit?.patientName || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (!parts.length) {
      return '—';
    }
    const letters = parts.slice(0, 2).map((part) => part.charAt(0).toUpperCase());
    return letters.join('');
  }

  visitTypeClass(visitType: unknown): string {
    const value = String(visitType || '').toLowerCase();
    if (value.includes('emerg')) {
      return 'pvl-pill--emergency';
    }
    if (value.includes('inpatient') || value.includes('admit')) {
      return 'pvl-pill--inpatient';
    }
    if (value.includes('review') || value.includes('revisit') || value.includes('follow')) {
      return 'pvl-pill--review';
    }
    if (value.includes('open') || value.includes('new') || value.includes('outpatient')) {
      return 'pvl-pill--open';
    }
    return '';
  }

  hasOutstandingBalance(visit: any): boolean {
    const n = Number(visit?.balanceDue);
    return Number.isFinite(n) && n > 0;
  }

  get uniqueDebtorPatientIds(): number[] {
    const ids = new Set<number>();
    (this.filteredVisits || []).forEach(v => {
      if (this.hasOutstandingBalance(v) && v?.patientId) {
        ids.add(v.patientId);
      }
    });
    return Array.from(ids);
  }

  openPayAllDebtsModal(): void {
    if (!this.isMdUser) {
      return;
    }
    this.showPayAllDebtsModal = true;
    this.payAllPaymentForm = 'cash';
  }

  closePayAllDebtsModal(): void {
    this.showPayAllDebtsModal = false;
  }

  confirmPayAllDebts(): void {
    if (!this.isMdUser) {
      return;
    }
    const patientIds = this.uniqueDebtorPatientIds;
    if (!patientIds.length) return;

    this.payAllInProgress = true;
    this.showPayAllDebtsModal = false;

    const debtByPatient = new Map<number, number>();
    (this.filteredVisits || []).forEach(v => {
      if (this.hasOutstandingBalance(v) && v?.patientId) {
        debtByPatient.set(v.patientId, (debtByPatient.get(v.patientId) || 0) + Number(v.balanceDue));
      }
    });

    let completed = 0;
    let errors = 0;
    patientIds.forEach(pid => {
      const amount = debtByPatient.get(pid) || 0;
      this.api.payAllPatientDebt(pid, {
        amountToPay: amount,
        paymentForm: this.payAllPaymentForm,
        status: 'approved'
      }).subscribe({
        next: () => {
          completed++;
          if (completed + errors === patientIds.length) this.onPayAllComplete(completed, errors);
        },
        error: () => {
          errors++;
          if (completed + errors === patientIds.length) this.onPayAllComplete(completed, errors);
        }
      });
    });
  }

  private onPayAllComplete(success: number, failed: number): void {
    this.payAllInProgress = false;
    if (failed === 0) {
      this.exportMessage = `All debts cleared successfully for ${success} client(s).`;
    } else {
      this.exportMessage = `Debts cleared for ${success} client(s), ${failed} failed.`;
    }
    this.applyDateFilter();
    setTimeout(() => this.exportMessage = null, 6000);
  }

  getDiagnosis(visit: any): string {
    const c = visit?.consultation;
    if (Array.isArray(c) && c.length) {
      const d = c[0]?.diagnosis;
      return d != null ? String(d) : '';
    }
    if (visit?.diagnosis != null) {
      return String(visit.diagnosis);
    }
    return '';
  }

  clearFilters(): void {
    this.filterDateFrom = '';
    this.filterDateTo = '';
    this.filterPatientName = '';
    this.filterDiagnosis = '';
    this.selectedPatientGroupId = null;
    this.groupDropdownOpen = false;
    this.groupSearchQuery = '';
    this.filterAgeFrom = null;
    this.filterAgeTo = null;
    this.filterGender = '';
    this.filterDebt = '';
    this.filterWeightFrom = null;
    this.filterWeightTo = null;
    this.selectedTreatmentItemId = null;
    this.drugDropdownOpen = false;
    this.drugSearchQuery = '';
    this.selectedOfferedServiceId = null;
    this.procedureDropdownOpen = false;
    this.procedureSearchQuery = '';
    this.loadLast7Days();
  }

  private parseNumericFilter(value: number | null | undefined): number | undefined {
    if (value == null || value === ('' as unknown as number)) {
      return undefined;
    }
    const n = Number(value);
    if (Number.isNaN(n) || n < 0) {
      return undefined;
    }
    return n;
  }

  private validateExportFilters(requireGroup = false): string | null {
    if (requireGroup && !this.selectedPatientGroup) {
      return 'Select a patient group before exporting.';
    }
    const from = (this.filterDateFrom || '').trim();
    const to = (this.filterDateTo || '').trim();
    if (!from || !to) {
      return 'Select both From date and To date before exporting.';
    }
    return null;
  }

  private validateVisitsAvailableForExport(): string | null {
    if (!this.filteredVisits.length) {
      const debt = (this.filterDebt || '').trim();
      if (debt === 'with_debt') {
        return 'No visits with outstanding debt match the selected filters.';
      }
      if (debt === 'no_debt') {
        return 'No fully paid visits match the selected filters.';
      }
      return 'No visits match the selected filters.';
    }
    return null;
  }

  private async readExportErrorMessage(err: any, fallback: string): Promise<string> {
    const body = err?.error;
    if (body instanceof Blob) {
      try {
        const text = (await body.text()).trim();
        if (text) {
          return text;
        }
      } catch {
        // fall through
      }
    }
    if (typeof body === 'string' && body.trim()) {
      return body.trim();
    }
    if (body?.message) {
      return String(body.message);
    }
    if (err?.message) {
      return String(err.message);
    }
    return fallback;
  }

  private currentExportDateRange(): { from: string; to: string } {
    return {
      from: (this.filterDateFrom || '').trim(),
      to: (this.filterDateTo || '').trim(),
    };
  }

  private fetchVisitsForExport(): Promise<any[]> {
    const { from, to } = this.currentExportDateRange();
    const query = this.buildFilterQuery(from, to);
    return new Promise((resolve, reject) => {
      this.api.filterVisits(query).subscribe({
        next: (data: any) => resolve(Array.isArray(data) ? data : []),
        error: (err: any) => reject(err),
      });
    });
  }

  exportAsInvoice(): void {
    const validation = this.validateExportFilters(true);
    if (validation) {
      this.exportMessage = validation;
      return;
    }
    const visitsValidation = this.validateVisitsAvailableForExport();
    if (visitsValidation) {
      this.exportMessage = visitsValidation;
      return;
    }
    this.exportInProgress = true;
    this.exportMenuOpen = false;
    this.exportMessage = null;
    const { from, to } = this.currentExportDateRange();
    const query = this.buildFilterQuery(from, to);
    const groupName = sanitizeFilenamePart(String(this.selectedPatientGroup?.groupName ?? 'group'));
    this.api.exportGroupInvoicePeriodDocx(query).subscribe({
      next: (blob) => {
        downloadBlob(blob, `${groupName}_medical_invoice_${from}_${to}.docx`);
        this.exportMessage = 'Word invoice exported.';
        this.exportInProgress = false;
      },
      error: async (err) => {
        this.exportMessage = await this.readExportErrorMessage(
          err,
          'Failed to export Word invoice. Use a backend with the compassion invoice template (logo and table format).'
        );
        this.exportInProgress = false;
      },
    });
  }

  exportHmis033bAggregate(): void {
    const validation = this.validateExportFilters(false);
    if (validation) {
      this.exportMessage = validation;
      return;
    }
    this.exportInProgress = true;
    this.exportMenuOpen = false;
    this.exportMessage = null;
    const { from, to } = this.currentExportDateRange();
    this.api.getHmis033bAggregate(from, to).subscribe({
      next: (data) => {
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        downloadBlob(blob, `hmis_033b_${from}_${to}.json`);
        this.exportMessage = 'HMIS 033b aggregate exported (JSON).';
        this.exportInProgress = false;
      },
      error: async (err) => {
        this.exportMessage = await this.readExportErrorMessage(err, 'Failed to export HMIS 033b aggregate.');
        this.exportInProgress = false;
      },
    });
  }

  exportHmis033bPdf(): void {
    const validation = this.validateExportFilters(false);
    if (validation) {
      this.exportMessage = validation;
      return;
    }
    this.exportInProgress = true;
    this.exportMenuOpen = false;
    this.exportMessage = null;
    const { from, to } = this.currentExportDateRange();
    this.api.exportHmis033bPdf(from, to).subscribe({
      next: (blob) => {
        downloadBlob(blob, `hmis_033b_${from}_${to}.pdf`);
        this.exportMessage = 'HMIS 033b weekly report exported (PDF).';
        this.exportInProgress = false;
      },
      error: async (err) => {
        this.exportMessage = await this.readExportErrorMessage(err, 'Failed to export HMIS 033b PDF.');
        this.exportInProgress = false;
      },
    });
  }

  exportHmis105Pdf(): void {
    const validation = this.validateExportFilters(false);
    if (validation) {
      this.exportMessage = validation;
      return;
    }
    this.exportInProgress = true;
    this.exportMenuOpen = false;
    this.exportMessage = null;
    const { from, to } = this.currentExportDateRange();
    this.api.exportHmis105Pdf(from, to).subscribe({
      next: (blob) => {
        const month = from.slice(0, 7);
        downloadBlob(blob, `hmis_105_${month}.pdf`);
        this.exportMessage = 'HMIS 105 monthly report exported (PDF).';
        this.exportInProgress = false;
      },
      error: async (err) => {
        this.exportMessage = await this.readExportErrorMessage(err, 'Failed to export HMIS 105 PDF.');
        this.exportInProgress = false;
      },
    });
  }

  exportAsExcel(): void {
    const validation = this.validateExportFilters(false);
    if (validation) {
      this.exportMessage = validation;
      return;
    }
    this.exportInProgress = true;
    this.exportMenuOpen = false;
    this.exportMessage = null;
    this.fetchVisitsForExport()
      .then((visits) => {
        const rows = sortVisitsLatestFirst(visits).map((visit, index) => ({
          No: index + 1,
          Date: visit?.visitDate ?? '',
          ID: visit?.patientId ?? '',
          Name: visit?.patientName ?? '',
          Age: visit?.patientAge ?? '',
          'Visit type': visit?.visitType ?? '',
          Diagnosis: this.getDiagnosis(visit),
          'Total amount': visit?.totalAmount ?? '',
          'Total cost (expenses)': visit?.totalCost ?? '',
          'Amount paid': visit?.amountPaid ?? '',
          'Balance due': visit?.balanceDue ?? '',
          'Visit group': visit?.visitGroup ?? '',
        }));
        const { from, to } = this.currentExportDateRange();
        exportVisitsTableToExcel(rows, `patient_visits_${from}_${to}.xlsx`);
        this.exportMessage = `Exported ${rows.length} visit(s) to Excel.`;
      })
      .catch(() => {
        this.exportMessage = 'Failed to export visits to Excel.';
      })
      .finally(() => {
        this.exportInProgress = false;
      });
  }

  exportAsPdf(): void {
    const validation = this.validateExportFilters(true);
    if (validation) {
      this.exportMessage = validation;
      return;
    }
    const visitsValidation = this.validateVisitsAvailableForExport();
    if (visitsValidation) {
      this.exportMessage = visitsValidation;
      return;
    }
    this.exportInProgress = true;
    this.exportMenuOpen = false;
    this.exportMessage = null;
    const { from, to } = this.currentExportDateRange();
    const query = this.buildFilterQuery(from, to);
    this.api.exportGroupInvoicePeriodPdf(query).subscribe({
      next: (blob) => {
        const groupName = sanitizeFilenamePart(String(this.selectedPatientGroup?.groupName ?? 'group'));
        downloadBlob(blob, `${groupName}_invoice_${from}_${to}.pdf`);
        this.exportMessage = 'PDF invoice exported.';
        this.exportInProgress = false;
      },
      error: async (err) => {
        this.exportMessage = await this.readExportErrorMessage(err, 'Failed to export PDF invoice.');
        this.exportInProgress = false;
      },
    });
  }

  openVisit(visit: any): void {
    if (!visit) return;
    const patient = {
      id: visit.patientId,
      patientFirstName: visit.patientName || '',
      patientName: visit.patientName || ''
    };
    sessionStorage.setItem('item', JSON.stringify(patient));
    sessionStorage.setItem('initialPatientVisit', JSON.stringify(visit));
    this.router.navigate(['/overview/consultation-v2']);
  }
}
