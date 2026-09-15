import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ApiService } from '../../services/api.service';
import { FacilityBrandingService } from '../../services/facility-branding.service';
import { applyTreatmentLifecycleFlags, isTreatmentDispensed } from '../../utils/treatment-lifecycle.util';

@Component({
  selector: 'app-treatment-chart-modal',
  templateUrl: './treatment-chart-modal.component.html',
  styleUrls: ['./treatment-chart-modal.component.css'],
})
export class TreatmentChartModalComponent implements OnChanges, OnDestroy {
  @Input() visitId: number | null = null;
  @Input() open = false;
  @Input() facilityDisplayName = '';
  @Input() facilityLogoUrl = '';
  @Output() openChange = new EventEmitter<boolean>();
  @Output() closed = new EventEmitter<void>();
  @Output() chartSaved = new EventEmitter<void>();

  @ViewChild('tcModalOverlay') tcModalOverlay?: ElementRef<HTMLElement>;

  treatmentRequestListForChart: any[] = [];
  treatmentChartsList: any[] = [];
  allStockBatchesCache: any[] = [];
  lastTreatmentChartRequestId: number | null = null;
  treatmentChartHistoryLoading = false;
  isDeletingTreatmentChart: number | null = null;
  selectedTreatmentRequestForChart: any = null;
  currentTreatmentRequested: any = {};
  treatmentChartForm: any = this.emptyTreatmentChartForm();
  private treatmentChartIntervalUserSet = false;
  private treatmentChartNextDoseUserSet = false;
  treatmentChartId: number | null = null;
  isLoadingTreatmentChart = false;
  treatmentChartResponseMessage = '';
  treatmentChartResponseColor = '';
  treatmentChartPendingDelete: any = null;
  searchTextTreatmentChart = '';
  treatmentChartDrugDropdownOpen = false;
  private treatmentChartDrugDropdownIgnoreDocumentClose = false;
  private userName = sessionStorage.getItem('username') || '';
  private bodyScrollLocked = false;

  constructor(
    private api: ApiService,
    private facilityBranding: FacilityBrandingService,
    private cdr: ChangeDetectorRef
  ) {}

  get resolvedFacilityDisplayName(): string {
    return (
      (this.facilityDisplayName || '').trim() ||
      this.facilityBranding.getFacilityName() ||
      ''
    );
  }

  get resolvedFacilityLogoUrl(): string {
    return (
      (this.facilityLogoUrl || '').trim() ||
      this.facilityBranding.getLogoUrlForDisplay() ||
      'assets/images/logo.jpg'
    );
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open']?.currentValue === true) {
      this.openTreatmentChartModal();
      this.scheduleOverlayAttach();
    }
    if (changes['open'] && changes['open'].currentValue === false) {
      this.unlockBodyScroll();
    }
  }

  ngOnDestroy(): void {
    this.treatmentChartDrugDropdownOpen = false;
    this.unlockBodyScroll();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (
      this.open &&
      this.treatmentChartDrugDropdownOpen &&
      !this.treatmentChartDrugDropdownIgnoreDocumentClose &&
      !target.closest('.pv-treatment-chart-drug-dropdown')
    ) {
      this.treatmentChartDrugDropdownOpen = false;
      this.cdr.markForCheck();
    }
  }

  close(): void {
    this.treatmentChartDrugDropdownOpen = false;
    this.treatmentChartPendingDelete = null;
    this.unlockBodyScroll();
    this.openChange.emit(false);
    this.closed.emit();
  }

  private scheduleOverlayAttach(): void {
    setTimeout(() => this.attachOverlayToBody(), 0);
  }

  private attachOverlayToBody(): void {
    const overlay = this.tcModalOverlay?.nativeElement;
    if (!overlay) {
      return;
    }
    if (overlay.parentElement !== document.body) {
      document.body.appendChild(overlay);
    }
    if (!this.bodyScrollLocked) {
      document.body.style.overflow = 'hidden';
      this.bodyScrollLocked = true;
    }
  }

  private unlockBodyScroll(): void {
    if (!this.bodyScrollLocked) {
      return;
    }
    document.body.style.overflow = '';
    this.bodyScrollLocked = false;
  }

  openTreatmentChartModal(): void {
    const restoreRequestId =
      this.lastTreatmentChartRequestId ?? this.selectedTreatmentRequestForChart?.id ?? null;
    this.treatmentChartId = null;
    this.searchTextTreatmentChart = '';
    this.treatmentChartDrugDropdownOpen = false;
    this.treatmentChartForm = this.emptyTreatmentChartForm();
    this.userName = sessionStorage.getItem('username') || this.userName || '';

    if (!this.visitId) {
      this.treatmentRequestListForChart = [];
      this.treatmentChartsList = [];
      return;
    }

    forkJoin({
      treatments: this.api.getTreatmentRequestedByVisit(this.visitId).pipe(
        map((res: any) =>
          Array.isArray(res) ? res : res?.data && Array.isArray(res.data) ? res.data : []
        ),
        catchError(() => of([]))
      ),
      charts: this.api.getTreatmentChartsByVisitId(this.visitId).pipe(catchError(() => of([]))),
      batches:
        this.allStockBatchesCache.length > 0
          ? of(this.allStockBatchesCache)
          : this.api.getAllStockBatches().pipe(
              map((batchRes: any) => this.normalizeStockBatchesResponse(batchRes)),
              catchError(() => of([]))
            ),
    }).subscribe(({ treatments, charts, batches }) => {
      if (Array.isArray(batches) && batches.length) {
        this.allStockBatchesCache = batches;
      }
      this.treatmentRequestListForChart = (Array.isArray(treatments) ? treatments : []).map((row) =>
        applyTreatmentLifecycleFlags({ ...row })
      );
      this.treatmentChartsList = Array.isArray(charts) ? charts : [];
      this.restoreTreatmentChartModalSelection(restoreRequestId);
      this.cdr.markForCheck();
    });
  }

  private emptyTreatmentChartForm(): any {
    return {
      dateGiven: '',
      timeGiven: '',
      givenBy: '',
      timeForNextDosage: '',
      dateForNextDosage: '',
      timeBetweenGivenToNextDosage: '',
      nextDoseIntervalHours: null,
      nextDoseIntervalMinutes: null,
      overallTotalDosages: null,
      totalDosagesGiven: null,
      unitsUsed: null,
      totalDosagesRemaining: null,
      status: '',
      /** '' | HOME | PERIPHERAL_CLINIC */
      administrationPlace: '',
    };
  }

  private restoreTreatmentChartModalSelection(restoreRequestId: number | null): void {
    const source = this.treatmentChartDropdownSource().filter((item) => {
      const matchVisit =
        item.visitId == this.visitId ||
        item.visit?.id == this.visitId ||
        !item.visitId;
      return matchVisit && this.isTreatmentEligibleForChart(item);
    });
    if (!source.length) {
      this.selectedTreatmentRequestForChart = null;
      this.currentTreatmentRequested = {};
      return;
    }

    let treatment =
      restoreRequestId != null
        ? source.find((r: any) => Number(r.id) === Number(restoreRequestId))
        : null;
    if (!treatment) {
      const chartRequestIds = new Set(
        (this.treatmentChartsList || []).map((c: any) => Number(c.treatmentRequestedId))
      );
      treatment = source.find((r: any) => chartRequestIds.has(Number(r.id))) || source[0];
    }
    if (treatment) {
      this.selectTreatmentRequestForChart(treatment);
    }
  }

  loadTreatmentChartsForVisit(): void {
    if (!this.visitId) {
      this.treatmentChartsList = [];
      return;
    }
    this.api.getTreatmentChartsByVisitId(this.visitId).subscribe({
      next: (list: any) => {
        this.treatmentChartsList = Array.isArray(list) ? list : [];
        if (this.selectedTreatmentRequestForChart) {
          if (!this.treatmentChartId) {
            const latest = this.getLatestChartForRequest(
              Number(this.selectedTreatmentRequestForChart.id)
            );
            this.currentTreatmentRequested = this.buildTreatmentChartDrugFields(
              this.selectedTreatmentRequestForChart,
              latest
            );
          }
          this.applyTreatmentChartAutofill(this.selectedTreatmentRequestForChart, {
            chartId: this.treatmentChartId,
            preserveGivenFields: !!this.treatmentChartId,
          });
        }
        this.cdr.markForCheck();
      },
      error: () => {
        this.treatmentChartsList = [];
      },
    });
  }

  editTreatmentChart(chart: any): void {
    const requestId = chart?.treatmentRequestedId;
    if (requestId == null) return;
    const source = this.treatmentRequestListForChart?.length
      ? this.treatmentRequestListForChart
      : [];
    let treatmentRequest = source.find((r: any) => r.id == requestId);
    if (!treatmentRequest) {
      treatmentRequest = {
        id: requestId,
        itemName: chart.treatmentName || chart.itemName || 'Treatment',
        title: chart.treatmentName || chart.itemName || 'Treatment',
        visitId: this.visitId,
      };
    }
    this.selectedTreatmentRequestForChart = treatmentRequest;
    this.lastTreatmentChartRequestId = Number(requestId);
    this.currentTreatmentRequested = this.buildTreatmentChartDrugFields(treatmentRequest, chart);
    const t = (v: any) =>
      v != null && v !== undefined ? (typeof v === 'string' ? v : String(v).substring(0, 10)) : '';
    const timeStr = (v: any) => (v != null && v !== undefined ? String(v).substring(0, 5) : '');
    this.treatmentChartId = chart.id;
    this.treatmentChartForm = {
      dateGiven: t(chart.dateGiven),
      timeGiven: timeStr(chart.timeGiven),
      givenBy: chart.givenBy || '',
      timeForNextDosage: timeStr(chart.timeForNextDosage),
      dateForNextDosage: t(chart.dateForNextDosage),
      timeBetweenGivenToNextDosage: chart.timeBetweenGivenToNextDosage || '',
      nextDoseIntervalHours: null,
      nextDoseIntervalMinutes: null,
      overallTotalDosages: chart.overallTotalDosages ?? null,
      totalDosagesGiven: chart.totalDosagesGiven ?? null,
      unitsUsed: chart.unitsUsed ?? null,
      totalDosagesRemaining: chart.totalDosagesRemaining ?? null,
      status: chart.status || '',
      administrationPlace: String(chart.administrationPlace || '').trim(),
    };
    this.loadTreatmentChartIntervalFromChart(chart);
    this.treatmentChartIntervalUserSet = true;
    this.updateTreatmentChartDosageCounts(treatmentRequest, { chartId: chart.id });
    if (this.isTreatmentChartLastDose(treatmentRequest)) {
      this.clearTreatmentChartNextDoseFields();
    }
    this.loadChartHistoryForSelectedTreatment(requestId);
  }

  deleteTreatmentChart(chart: any, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    if (typeof event?.stopImmediatePropagation === 'function') {
      event.stopImmediatePropagation();
    }
    const id = this.resolveTreatmentChartId(chart);
    if (id == null) {
      this.treatmentChartResponseMessage = 'Cannot delete this chart entry. Missing id.';
      this.treatmentChartResponseColor = 'rgb(238, 16, 16)';
      setTimeout(() => {
        this.treatmentChartResponseMessage = '';
      }, 3000);
      return;
    }
    this.treatmentChartPendingDelete = chart;
    this.cdr.markForCheck();
  }

  cancelTreatmentChartDelete(): void {
    if (this.isDeletingTreatmentChart != null) {
      return;
    }
    this.treatmentChartPendingDelete = null;
    this.cdr.markForCheck();
  }

  confirmTreatmentChartDelete(): void {
    const chart = this.treatmentChartPendingDelete;
    if (chart) {
      this.performDeleteTreatmentChart(chart);
    }
  }

  private resolveTreatmentChartId(chart: any): number | null {
    const id = Number(chart?.id ?? chart?.treatmentChartId ?? chart?.chartId);
    return Number.isFinite(id) && id > 0 ? id : null;
  }

  private performDeleteTreatmentChart(chart: any): void {
    const id = this.resolveTreatmentChartId(chart);
    if (id == null) return;
    this.isDeletingTreatmentChart = id;
    this.api.deleteTreatmentChart(id).subscribe({
      next: () => {
        this.treatmentChartsList = (this.treatmentChartsList || []).filter(
          (c: any) => this.resolveTreatmentChartId(c) !== id
        );
        if (Number(this.treatmentChartId) === id) {
          this.clearTreatmentChartEntryForm();
        }
        this.treatmentChartPendingDelete = null;
        this.isDeletingTreatmentChart = null;
        this.treatmentChartResponseMessage = 'Treatment chart deleted successfully';
        this.treatmentChartResponseColor = 'rgb(11, 155, 112)';
        if (this.selectedTreatmentRequestForChart?.id != null) {
          this.loadChartHistoryForSelectedTreatment(this.selectedTreatmentRequestForChart.id);
        }
        this.loadTreatmentChartsForVisit();
        this.chartSaved.emit();
        setTimeout(() => {
          this.treatmentChartResponseMessage = '';
        }, 3000);
      },
      error: (err) => {
        this.isDeletingTreatmentChart = null;
        this.treatmentChartResponseMessage = err?.error?.message || 'Failed to delete treatment chart';
        this.treatmentChartResponseColor = 'rgb(238, 16, 16)';
        setTimeout(() => {
          this.treatmentChartResponseMessage = '';
        }, 3000);
      },
    });
  }

  clearTreatmentChartEntryForm(): void {
    this.treatmentChartId = null;
    this.treatmentChartIntervalUserSet = false;
    this.treatmentChartNextDoseUserSet = false;
    this.treatmentChartForm = this.emptyTreatmentChartForm();
    if (this.selectedTreatmentRequestForChart) {
      this.applyTreatmentChartAutofill(this.selectedTreatmentRequestForChart);
    }
  }

  resetTreatmentChartForm(): void {
    this.clearTreatmentChartEntryForm();
    this.selectedTreatmentRequestForChart = null;
    this.lastTreatmentChartRequestId = null;
    this.currentTreatmentRequested = {};
    this.searchTextTreatmentChart = '';
  }

  private afterTreatmentChartSaved(): void {
    const reqId = this.selectedTreatmentRequestForChart?.id;
    if (reqId != null) {
      this.lastTreatmentChartRequestId = Number(reqId);
    }
    this.treatmentChartId = null;
    this.treatmentChartForm = this.emptyTreatmentChartForm();
    this.selectedTreatmentRequestForChart = null;
    this.currentTreatmentRequested = {};
    this.loadTreatmentChartsForVisit();
    this.chartSaved.emit();
  }

  private resolveTreatmentRequestRoute(item: any): string {
    if (!item) return '';
    const direct = item.route ?? item.routeOfAdministration ?? item.routeOfAdminTitle ?? '';
    if (String(direct).trim()) return String(direct).trim();

    const batchId = Number(item.stockBatchId ?? item.stockBatch?.id ?? 0);
    const itemId = Number(item.itemId ?? item.stockItemId ?? 0);
    for (const batch of this.allStockBatchesCache || []) {
      const bid = Number(batch.id ?? batch._stockBatchId ?? 0);
      const sid = Number(batch.stockItemId ?? batch.itemId ?? 0);
      if ((batchId > 0 && bid === batchId) || (itemId > 0 && sid === itemId)) {
        const route =
          batch.route ?? batch.routeOfAdminTitle ?? batch.routeOfAdministration ?? '';
        if (String(route).trim()) return String(route).trim();
      }
    }
    return '';
  }

  private isIvRouteOfAdministration(route: string | null | undefined): boolean {
    const normalized = String(route ?? '')
      .trim()
      .toLowerCase()
      .replace(/\./g, '')
      .replace(/\s+/g, '');
    if (!normalized) return false;
    return (
      normalized === 'iv' ||
      normalized.startsWith('iv') ||
      normalized.includes('intravenous') ||
      normalized.includes('intraven') ||
      normalized === 'ivbolus' ||
      normalized.includes('ivinfusion')
    );
  }

  private enrichTreatmentRequestForChart(item: any): any {
    const route = this.resolveTreatmentRequestRoute(item);
    return {
      ...item,
      route: item.route ?? route,
      routeOfAdministration: item.routeOfAdministration ?? route,
    };
  }

  private treatmentChartDropdownSource(): any[] {
    const source = this.treatmentRequestListForChart || [];
    return (Array.isArray(source) ? source : []).map((item) =>
      this.enrichTreatmentRequestForChart(item)
    );
  }

  private isTreatmentEligibleForChart(item: any): boolean {
    if (!isTreatmentDispensed(item)) {
      return false;
    }
    if (item?.administered === true) {
      return false;
    }
    const reqId = Number(item?.id);
    if (Number.isFinite(reqId) && reqId > 0 && this.isTreatmentTakenAway(reqId)) {
      return false;
    }
    return true;
  }

  private isTreatmentTakenAway(requestId: number): boolean {
    return (this.treatmentChartsList || []).some(
      (c: any) =>
        Number(c.treatmentRequestedId) === Number(requestId) &&
        !!String(c.administrationPlace || '').trim()
    );
  }

  isTakeawayAdministrationSelected(): boolean {
    const place = String(this.treatmentChartForm?.administrationPlace || '').trim();
    return place === 'HOME' || place === 'PERIPHERAL_CLINIC';
  }

  administrationPlaceLabel(place: unknown): string {
    const p = String(place || '').trim().toUpperCase();
    if (p === 'HOME') return 'Drugs taken from home';
    if (p === 'PERIPHERAL_CLINIC') return 'Drugs taken for a peripheral clinic';
    return String(place || '–');
  }

  get facilityTreatmentChartsHistory(): any[] {
    return this.allTreatmentChartsHistory.filter(
      (c) => !String(c?.administrationPlace || '').trim()
    );
  }

  get takenAwayTreatmentCharts(): any[] {
    return this.allTreatmentChartsHistory.filter((c) =>
      !!String(c?.administrationPlace || '').trim()
    );
  }

  filteredTreatmentRequestedList(): any[] {
    const source = this.treatmentChartDropdownSource();
    if (!source.length) return [];

    const facilityChartRequestIds = new Set(
      (this.treatmentChartsList || [])
        .filter((c: any) => !String(c?.administrationPlace || '').trim())
        .map((c: any) => Number(c.treatmentRequestedId))
        .filter((id: number) => Number.isFinite(id) && id > 0)
    );

    let filtered = source.filter((item: any) => {
      const matchVisit =
        item.visitId == this.visitId || item.visit?.id == this.visitId || !item.visitId;
      if (!matchVisit) return false;
      const reqId = Number(item.id);
      // Taken-away / fully administered drugs leave the select list entirely.
      if (item?.administered === true) return false;
      if (Number.isFinite(reqId) && reqId > 0 && this.isTreatmentTakenAway(reqId)) {
        return false;
      }
      return (
        this.isTreatmentEligibleForChart(item) ||
        (Number.isFinite(reqId) && facilityChartRequestIds.has(reqId))
      );
    });

    if (this.searchTextTreatmentChart) {
      const searchTerm = this.searchTextTreatmentChart.toLowerCase();
      filtered = filtered.filter((item: any) => {
        const name = `${item.itemName ?? item.title ?? ''}`.toLowerCase();
        const route = `${item.route ?? item.routeOfAdministration ?? ''}`.toLowerCase();
        return name.includes(searchTerm) || route.includes(searchTerm);
      });
    }
    return filtered;
  }

  onAdministrationPlaceChange(): void {
    if (this.isTakeawayAdministrationSelected()) {
      this.clearTreatmentChartNextDoseFields();
      const tr = this.selectedTreatmentRequestForChart;
      const remaining = this.getRemainingDosesBeforeNewEntry(Number(tr?.id), tr);
      this.treatmentChartForm.totalDosagesRemaining = remaining;
      this.treatmentChartForm.unitsUsed =
        this.currentTreatmentRequested?.totalUnits ?? tr?.totalUnits ?? remaining;
      this.treatmentChartForm.status = 'Dispensed';
    } else {
      this.treatmentChartForm.status = 'Given';
      if (this.selectedTreatmentRequestForChart) {
        this.applyTreatmentChartAutofill(this.selectedTreatmentRequestForChart, {
          chartId: this.treatmentChartId,
          preserveGivenFields: true,
        });
      }
    }
    this.cdr.markForCheck();
  }

  private mapTreatmentChartFrequencyUnit(u: any, fallback?: any): number {
    const n = Number(u);
    if (Number.isFinite(n) && n > 0) return n;
    if (u === 'Minute(s)' || u === 'Minute') return 1 / 1440;
    if (u === 'Hour(s)' || u === 'Hour') return 1 / 24;
    if (u === 'Day' || u === 'Day(s)') return 1;
    if (u === 'Week' || u === 'Week(s)') return 7;
    if (u === 'Month' || u === 'Month(s)') return 30;
    const fb = Number(fallback);
    return Number.isFinite(fb) && fb > 0 ? fb : 1;
  }

  private mapTreatmentChartDurationUnit(u: any, fallback?: any): number {
    const n = Number(u);
    if (Number.isFinite(n) && n > 0) return n;
    if (u === 'Minute(s)' || u === 'Minute') return 1 / 1440;
    if (u === 'Hour(s)' || u === 'Hour') return 1 / 24;
    if (u === 'Day(s)' || u === 'Day') return 1;
    if (u === 'Week(s)' || u === 'Week') return 7;
    if (u === 'Month(s)' || u === 'Month') return 30;
    const fb = Number(fallback);
    return Number.isFinite(fb) && fb > 0 ? fb : 1;
  }

  private getLatestChartNextDoseDateTime(requestId: number): Date | null {
    const latest = this.getLatestChartForRequest(requestId);
    if (!latest) return null;
    const dateRaw = latest.dateForNextDosage ?? latest.dateForNextDosaage;
    const timeRaw = latest.timeForNextDosage ?? latest.timeForNextDosaage;
    if (
      dateRaw == null ||
      timeRaw == null ||
      `${dateRaw}`.trim() === '' ||
      `${timeRaw}`.trim() === ''
    ) {
      return null;
    }
    const dateStr = this.formatTreatmentChartDate(dateRaw);
    const timeStr = this.formatTreatmentChartTime(timeRaw);
    if (dateStr === '–' || timeStr === '–') return null;
    const dt = new Date(`${dateStr}T${timeStr}`);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }

  private getRemainingDosesBeforeNewEntry(requestId: number, treatmentRequest?: any): number {
    const reqId = Number(requestId);
    if (!Number.isFinite(reqId) || reqId <= 0) return 0;

    const latest = this.getLatestChartForRequest(reqId);
    if (latest != null) {
      const fromLatest = Number(latest.totalDosagesRemaining);
      if (Number.isFinite(fromLatest)) return Math.max(0, fromLatest);
    }

    const tr = treatmentRequest || this.selectedTreatmentRequestForChart || {};
    const req = this.currentTreatmentRequested || {};
    const overall = this.computeOverallTotalDosages(
      req.frequencyValue ?? tr.frequencyValue,
      req.durationValue ?? tr.durationValue
    );
    const chartsForReq = (this.treatmentChartsList || []).filter(
      (c: any) => Number(c.treatmentRequestedId) === reqId
    );
    return Math.max(0, overall - chartsForReq.length);
  }

  canAddTreatmentChartDose(requestId?: number | null, treatmentRequest?: any): boolean {
    const id = Number(requestId ?? this.selectedTreatmentRequestForChart?.id);
    if (!Number.isFinite(id) || id <= 0) return false;
    return this.getRemainingDosesBeforeNewEntry(id, treatmentRequest) > 0;
  }

  private validateTreatmentChartCanGiveNewDose(): { ok: boolean; message?: string } {
    if (this.treatmentChartId) return { ok: true };
    const requestId = Number(this.selectedTreatmentRequestForChart?.id);
    if (!Number.isFinite(requestId) || requestId <= 0) {
      return { ok: false, message: 'Please select a treatment request' };
    }

    const remaining = this.getRemainingDosesBeforeNewEntry(
      requestId,
      this.selectedTreatmentRequestForChart
    );
    if (remaining <= 0) {
      const treatmentName =
        this.selectedTreatmentRequestForChart?.itemName ||
        this.selectedTreatmentRequestForChart?.title ||
        'This treatment';
      return {
        ok: false,
        message: `${treatmentName} has no remaining doses. All scheduled doses have already been recorded.`,
      };
    }

    const latest = this.getLatestChartForRequest(requestId);
    if (!latest) return { ok: true };
    const nextDue = this.getLatestChartNextDoseDateTime(requestId);
    if (!nextDue) return { ok: true };
    const givenAt = this.parseTreatmentChartGivenDateTime() ?? new Date();
    if (givenAt.getTime() >= nextDue.getTime()) return { ok: true };
    const lastGivenDate = this.formatTreatmentChartDate(latest.dateGiven);
    const lastGivenTime = this.formatTreatmentChartTime(latest.timeGiven);
    const nextParts = this.formatTreatmentChartDateTimeParts(nextDue);
    return {
      ok: false,
      message:
        `It is not yet time for the next dose. Last given: ${lastGivenDate} at ${lastGivenTime}. ` +
        `Next dose is due on ${nextParts.date} at ${nextParts.time}.`,
    };
  }

  private showTreatmentChartValidationMessage(message: string): void {
    this.treatmentChartResponseMessage = message;
    this.treatmentChartResponseColor = 'rgb(238, 16, 16)';
  }

  private clearTreatmentChartValidationMessageIfAllowed(): void {
    const check = this.validateTreatmentChartCanGiveNewDose();
    if (check.ok) {
      if (this.treatmentChartResponseColor === 'rgb(238, 16, 16)') {
        this.treatmentChartResponseMessage = '';
      }
      return;
    }
    if (check.message) {
      this.showTreatmentChartValidationMessage(check.message);
    }
  }

  private getLatestChartForRequest(requestId: number): any | null {
    const charts = (this.treatmentChartsList || []).filter(
      (c: any) => Number(c.treatmentRequestedId) === Number(requestId)
    );
    if (!charts.length) return null;
    return this.sortTreatmentCharts(charts)[charts.length - 1];
  }

  private buildTreatmentChartDrugFields(treatmentRequest: any, chart?: any | null): any {
    const tr = treatmentRequest || {};
    const ch = chart || null;
    return {
      amountPerFrequencyValue:
        ch?.dosageValue ?? tr.amountPerFrequencyValue ?? tr.dosageValue ?? '',
      amountPerFrequencyUnit:
        ch?.dosageUnit || tr.amountPerFrequencyUnit || tr.lastUnitOfMeasure || '',
      frequencyValue: ch?.frequencyValue ?? tr.frequencyValue ?? '',
      frequencyUnit: this.mapTreatmentChartFrequencyUnit(
        ch?.frequencyUnit ?? tr.frequencyUnit,
        tr.frequencyUnit
      ),
      durationValue: tr.durationValue ?? '',
      durationUnit: this.mapTreatmentChartDurationUnit(tr.durationUnit, tr.durationUnit),
      quantity: tr.quantity ?? '',
      totalUnits: tr.totalUnits ?? '',
      estimatedUnits: this.roundEstimatedUnits(tr.totalUnits),
      totalAmount: tr.totalAmount ?? '',
      route: ch?.route || tr.route || '',
      instructions: ch?.instructions || tr.instructions || '',
    };
  }

  private formatTreatmentChartFrequencyUnitForApi(unit: unknown): string {
    const n = Number(unit);
    if (!Number.isFinite(n) || n <= 0) return '1';
    return String(n);
  }

  private buildTreatmentChartSavePayload(data: any): any {
    const req = this.currentTreatmentRequested || {};
    const tr = this.selectedTreatmentRequestForChart || {};
    const takeaway = this.isTakeawayAdministrationSelected();
    const suppressNextDose = takeaway || this.isTreatmentChartLastDose(tr);
    const remaining = takeaway
      ? Number(this.treatmentChartForm.totalDosagesRemaining ?? this.getRemainingDosesBeforeNewEntry(Number(tr.id), tr))
      : this.treatmentChartForm.totalDosagesRemaining ?? null;
    const units = takeaway
      ? Number(
          this.treatmentChartForm.unitsUsed ??
            req.totalUnits ??
            tr.totalUnits ??
            remaining ??
            0
        )
      : this.treatmentChartForm.unitsUsed ?? null;
    return {
      dateGiven: this.treatmentChartForm.dateGiven || data.dateGiven || null,
      timeGiven: this.treatmentChartForm.timeGiven || data.timeGiven || null,
      givenBy: this.treatmentChartForm.givenBy || data.givenBy || '',
      route: req.route || tr.route || data.route || '',
      instructions: req.instructions || tr.instructions || data.instructions || '',
      dosageValue: req.amountPerFrequencyValue ?? tr.amountPerFrequencyValue ?? null,
      dosageUnit: req.amountPerFrequencyUnit || tr.amountPerFrequencyUnit || '',
      frequencyValue: req.frequencyValue ?? tr.frequencyValue ?? null,
      frequencyUnit: this.formatTreatmentChartFrequencyUnitForApi(
        req.frequencyUnit ?? tr.frequencyUnit
      ),
      timeForNextDosage: suppressNextDose
        ? null
        : this.treatmentChartForm.timeForNextDosage || data.timeForNextDosage || null,
      dateForNextDosage: suppressNextDose
        ? null
        : this.treatmentChartForm.dateForNextDosage || data.dateForNextDosage || null,
      timeBetweenGivenToNextDosage: suppressNextDose
        ? null
        : this.treatmentChartForm.timeBetweenGivenToNextDosage ||
          data.timeBetweenGivenToNextDosage ||
          null,
      overallTotalDosages: this.treatmentChartForm.overallTotalDosages ?? null,
      totalDosagesGiven: takeaway
        ? this.treatmentChartForm.overallTotalDosages ?? remaining
        : this.treatmentChartForm.totalDosagesGiven ?? null,
      unitsUsed: units,
      totalDosagesRemaining: remaining,
      status: takeaway ? 'Dispensed' : 'Given',
      administrationPlace: takeaway ? this.treatmentChartForm.administrationPlace : null,
    };
  }

  computeOverallTotalDosages(frequencyValue: unknown, durationValue: unknown): number {
    const freq = Number(frequencyValue);
    const dur = Number(durationValue);
    if (!Number.isFinite(freq) || !Number.isFinite(dur) || freq <= 0 || dur <= 0) return 1;
    return Math.max(1, Math.round(freq * dur));
  }

  computeHoursBetweenDoses(frequencyValue: unknown, frequencyUnit: unknown): number {
    const freq = Number(frequencyValue);
    if (!Number.isFinite(freq) || freq <= 0) return 24;
    const unit = Number(frequencyUnit);
    const dosesPerDay = unit === 7 ? freq / 7 : unit === 30 ? freq / 30 : freq;
    if (dosesPerDay <= 0) return 24;
    return 24 / dosesPerDay;
  }

  parseIntervalHoursFromLabel(label: unknown): number | null {
    if (label == null || label === '') return null;
    const s = String(label).trim().toLowerCase();
    const hrly = s.match(/^(\d+(?:\.\d+)?)\s*hrly$/);
    if (hrly) return Number(hrly[1]);
    const hm = s.match(/(\d+(?:\.\d+)?)\s*h(?:\s+(\d+)\s*m)?/);
    if (hm) {
      const h = Number(hm[1]);
      const m = hm[2] ? Number(hm[2]) : 0;
      if (Number.isFinite(h) && h >= 0) {
        return h + (Number.isFinite(m) ? m / 60 : 0);
      }
    }
    const plain = Number(s);
    if (Number.isFinite(plain) && plain > 0) return plain;
    return null;
  }

  splitIntervalHours(totalHours: number): { hours: number; minutes: number } {
    if (!Number.isFinite(totalHours) || totalHours < 0) return { hours: 0, minutes: 0 };
    const hours = Math.floor(totalHours);
    const minutes = Math.round((totalHours - hours) * 60);
    if (minutes >= 60) return { hours: hours + 1, minutes: 0 };
    return { hours, minutes };
  }

  private formatTreatmentChartDateTimeParts(dt: Date): { date: string; time: string } {
    const pad = (n: number) => String(n).padStart(2, '0');
    return {
      date: `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`,
      time: `${pad(dt.getHours())}:${pad(dt.getMinutes())}`,
    };
  }

  parseTreatmentChartGivenDateTime(): Date | null {
    const date = this.treatmentChartForm?.dateGiven;
    const time = this.treatmentChartForm?.timeGiven;
    if (!date || !time) return null;
    const dt = new Date(`${date}T${String(time).substring(0, 5)}`);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }

  parseTreatmentChartNextDateTime(): Date | null {
    const date = this.treatmentChartForm?.dateForNextDosage;
    const time = this.treatmentChartForm?.timeForNextDosage;
    if (!date || !time) return null;
    const dt = new Date(`${date}T${String(time).substring(0, 5)}`);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }

  getTreatmentChartIntervalTotalHours(): number {
    const h = Number(this.treatmentChartForm?.nextDoseIntervalHours);
    const m = Number(this.treatmentChartForm?.nextDoseIntervalMinutes);
    const hours = Number.isFinite(h) && h >= 0 ? h : 0;
    const minutes = Number.isFinite(m) && m >= 0 ? m : 0;
    return hours + minutes / 60;
  }

  syncTreatmentChartIntervalLabel(): void {
    const total = this.getTreatmentChartIntervalTotalHours();
    this.treatmentChartForm.timeBetweenGivenToNextDosage =
      total > 0 ? this.formatDoseIntervalLabel(total) : '';
  }

  applyTreatmentChartNextDoseFromInterval(): void {
    const given = this.parseTreatmentChartGivenDateTime() ?? new Date();
    const totalHours = this.getTreatmentChartIntervalTotalHours();
    if (totalHours <= 0) return;
    const next = new Date(given.getTime() + totalHours * 3600000);
    const parts = this.formatTreatmentChartDateTimeParts(next);
    this.treatmentChartForm.dateForNextDosage = parts.date;
    this.treatmentChartForm.timeForNextDosage = parts.time;
    this.syncTreatmentChartIntervalLabel();
  }

  applyTreatmentChartIntervalFromNextDose(): void {
    const given = this.parseTreatmentChartGivenDateTime();
    const next = this.parseTreatmentChartNextDateTime();
    if (!given || !next) return;
    const diffMs = next.getTime() - given.getTime();
    if (diffMs < 0) return;
    const split = this.splitIntervalHours(diffMs / 3600000);
    this.treatmentChartForm.nextDoseIntervalHours = split.hours;
    this.treatmentChartForm.nextDoseIntervalMinutes = split.minutes;
    this.syncTreatmentChartIntervalLabel();
  }

  onTreatmentChartGivenDateTimeChange(): void {
    if (this.isTreatmentChartLastDose()) {
      this.clearTreatmentChartNextDoseFields();
      this.clearTreatmentChartValidationMessageIfAllowed();
      return;
    }
    if (this.treatmentChartNextDoseUserSet && !this.treatmentChartIntervalUserSet) {
      this.applyTreatmentChartIntervalFromNextDose();
    } else if (
      this.treatmentChartIntervalUserSet ||
      this.getTreatmentChartIntervalTotalHours() > 0
    ) {
      this.treatmentChartNextDoseUserSet = false;
      this.applyTreatmentChartNextDoseFromInterval();
    } else {
      this.applyTreatmentChartIntervalFromNextDose();
    }
    this.clearTreatmentChartValidationMessageIfAllowed();
  }

  onTreatmentChartIntervalChange(): void {
    if (this.isTreatmentChartLastDose()) {
      this.clearTreatmentChartNextDoseFields();
      return;
    }
    this.treatmentChartIntervalUserSet = true;
    this.treatmentChartNextDoseUserSet = false;
    this.applyTreatmentChartNextDoseFromInterval();
    this.clearTreatmentChartValidationMessageIfAllowed();
  }

  onTreatmentChartNextDoseChange(): void {
    this.treatmentChartIntervalUserSet = true;
    this.treatmentChartNextDoseUserSet = true;
    this.applyTreatmentChartIntervalFromNextDose();
  }

  private suggestTreatmentChartIntervalHours(treatmentRequest: any, requestId: number): number {
    const latestChart = this.getLatestChartForRequest(requestId);
    const fromLatest = this.parseIntervalHoursFromLabel(
      latestChart?.timeBetweenGivenToNextDosage
    );
    if (fromLatest != null && fromLatest > 0) return fromLatest;
    const tr = treatmentRequest || {};
    const req = this.currentTreatmentRequested || {};
    return this.computeHoursBetweenDoses(
      req.frequencyValue ?? tr.frequencyValue,
      req.frequencyUnit ?? tr.frequencyUnit
    );
  }

  private setTreatmentChartIntervalHours(totalHours: number, userSet = false): void {
    const split = this.splitIntervalHours(totalHours);
    this.treatmentChartForm.nextDoseIntervalHours = split.hours;
    this.treatmentChartForm.nextDoseIntervalMinutes = split.minutes;
    this.syncTreatmentChartIntervalLabel();
    if (userSet) this.treatmentChartIntervalUserSet = true;
  }

  private loadTreatmentChartIntervalFromChart(chart: any): void {
    const fromLabel = this.parseIntervalHoursFromLabel(chart?.timeBetweenGivenToNextDosage);
    if (fromLabel != null && fromLabel > 0) {
      this.setTreatmentChartIntervalHours(fromLabel, true);
      return;
    }
    const given =
      chart?.dateGiven && chart?.timeGiven
        ? new Date(
            `${String(chart.dateGiven).substring(0, 10)}T${String(chart.timeGiven).substring(0, 5)}`
          )
        : null;
    const nextDate = chart?.dateForNextDosage ?? chart?.dateForNextDosaage;
    const nextTime = chart?.timeForNextDosage ?? chart?.timeForNextDosaage;
    const next =
      nextDate && nextTime
        ? new Date(`${String(nextDate).substring(0, 10)}T${String(nextTime).substring(0, 5)}`)
        : null;
    if (given && next && !Number.isNaN(given.getTime()) && !Number.isNaN(next.getTime())) {
      const diffMs = next.getTime() - given.getTime();
      if (diffMs > 0) this.setTreatmentChartIntervalHours(diffMs / 3600000, true);
    }
  }

  formatDoseIntervalLabel(hoursBetween: number): string {
    if (!Number.isFinite(hoursBetween) || hoursBetween <= 0) return '24hrly';
    const rounded = Math.round(hoursBetween * 100) / 100;
    const wholeHours = Math.round(rounded);
    if (Math.abs(rounded - wholeHours) < 0.05 && wholeHours >= 1) return `${wholeHours}hrly`;
    const h = Math.floor(rounded);
    const m = Math.round((rounded - h) * 60);
    if (m <= 0) return `${h}hrly`;
    return `${h}h ${m}m`;
  }

  private resolveTotalDosagesGivenForChart(
    treatmentRequestedId: number,
    chartId: number | null
  ): number {
    const chartsForReq = (this.treatmentChartsList || [])
      .filter((c: any) => Number(c.treatmentRequestedId) === Number(treatmentRequestedId))
      .sort((a: any, b: any) => Number(a.id || 0) - Number(b.id || 0));
    if (chartId != null) {
      const idx = chartsForReq.findIndex((c: any) => c.id === chartId);
      if (idx >= 0) return idx + 1;
    }
    return chartsForReq.length + 1;
  }

  refreshTreatmentChartDerivedFields(): void {
    if (!this.selectedTreatmentRequestForChart) return;
    this.updateTreatmentChartDosageCounts(this.selectedTreatmentRequestForChart, {
      chartId: this.treatmentChartId,
    });
    if (this.isTreatmentChartLastDose()) {
      this.clearTreatmentChartNextDoseFields();
    } else if (!this.treatmentChartNextDoseUserSet) {
      if (this.getTreatmentChartIntervalTotalHours() <= 0) {
        const suggested = this.suggestTreatmentChartIntervalHours(
          this.selectedTreatmentRequestForChart,
          Number(this.selectedTreatmentRequestForChart?.id)
        );
        this.setTreatmentChartIntervalHours(suggested, false);
      }
      this.applyTreatmentChartNextDoseFromInterval();
    }
  }

  isTreatmentChartSingleDose(treatmentRequest?: any): boolean {
    const req = this.currentTreatmentRequested || {};
    const tr = treatmentRequest || this.selectedTreatmentRequestForChart || {};
    const freqVal = Number(req.frequencyValue ?? tr.frequencyValue);
    const durVal = Number(req.durationValue ?? tr.durationValue);
    const freqUnit = Number(req.frequencyUnit ?? tr.frequencyUnit ?? 1);
    const durUnit = Number(req.durationUnit ?? tr.durationUnit ?? 1);
    return freqVal === 1 && durVal === 1 && freqUnit === 1 && durUnit === 1;
  }

  isTreatmentChartLastDose(treatmentRequest?: any): boolean {
    if (this.isTreatmentChartSingleDose(treatmentRequest)) return true;
    const requestId = Number(treatmentRequest?.id ?? this.selectedTreatmentRequestForChart?.id);
    if (!Number.isFinite(requestId) || requestId <= 0) return false;
    if (this.treatmentChartId) {
      const remaining = Number(this.treatmentChartForm.totalDosagesRemaining);
      if (Number.isFinite(remaining) && remaining <= 0) return true;
      const overall = Number(this.treatmentChartForm.overallTotalDosages);
      const given = Number(this.treatmentChartForm.totalDosagesGiven);
      return Number.isFinite(overall) && Number.isFinite(given) && given >= overall;
    }
    return this.getRemainingDosesBeforeNewEntry(requestId, treatmentRequest) <= 1;
  }

  treatmentChartShowsNextDoseFields(treatmentRequest?: any): boolean {
    if (this.isTakeawayAdministrationSelected()) {
      return false;
    }
    return !this.isTreatmentChartLastDose(treatmentRequest);
  }

  private clearTreatmentChartNextDoseFields(): void {
    this.treatmentChartForm = {
      ...this.treatmentChartForm,
      nextDoseIntervalHours: null,
      nextDoseIntervalMinutes: null,
      timeBetweenGivenToNextDosage: '',
      dateForNextDosage: '',
      timeForNextDosage: '',
    };
  }

  toggleTreatmentChartDrugDropdown(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.treatmentChartDrugDropdownOpen = !this.treatmentChartDrugDropdownOpen;
    if (this.treatmentChartDrugDropdownOpen) {
      this.treatmentChartDrugDropdownIgnoreDocumentClose = true;
      setTimeout(() => {
        this.treatmentChartDrugDropdownIgnoreDocumentClose = false;
      }, 0);
    }
    this.cdr.markForCheck();
  }

  private updateTreatmentChartDosageCounts(
    treatmentRequest: any,
    options?: { chartId?: number | null }
  ): void {
    if (!treatmentRequest) return;
    const tr = treatmentRequest;
    const req = this.currentTreatmentRequested || {};
    const freqVal = req.frequencyValue ?? tr.frequencyValue;
    const durVal = req.durationValue ?? tr.durationValue;
    const overall = this.computeOverallTotalDosages(freqVal, durVal);
    const requestId = Number(tr.id);
    const totalGiven = this.resolveTotalDosagesGivenForChart(
      requestId,
      options?.chartId ?? this.treatmentChartId
    );
    const unitsUsed =
      Number(
        req.totalUnits ??
          tr.totalUnits ??
          req.amountPerFrequencyValue ??
          tr.amountPerFrequencyValue
      ) || null;
    const remaining = Math.max(0, overall - totalGiven);

    this.treatmentChartForm = {
      ...this.treatmentChartForm,
      overallTotalDosages: overall,
      totalDosagesGiven: totalGiven,
      unitsUsed,
      totalDosagesRemaining: remaining,
      status: this.treatmentChartForm.status || 'Given',
    };

    if (this.isTreatmentChartLastDose(tr)) {
      this.clearTreatmentChartNextDoseFields();
    }
  }

  applyTreatmentChartAutofill(
    treatmentRequest: any,
    options?: { chartId?: number | null; preserveGivenFields?: boolean }
  ): void {
    if (!treatmentRequest) return;
    const tr = treatmentRequest;
    const req = this.currentTreatmentRequested || {};
    const requestId = Number(tr.id);
    const nowParts = this.formatTreatmentChartDateTimeParts(new Date());

    const preserved = options?.preserveGivenFields
      ? {
          dateGiven: this.treatmentChartForm.dateGiven,
          timeGiven: this.treatmentChartForm.timeGiven,
          givenBy: this.treatmentChartForm.givenBy,
          timeForNextDosage: this.treatmentChartForm.timeForNextDosage,
          dateForNextDosage: this.treatmentChartForm.dateForNextDosage,
          nextDoseIntervalHours: this.treatmentChartForm.nextDoseIntervalHours,
          nextDoseIntervalMinutes: this.treatmentChartForm.nextDoseIntervalMinutes,
          timeBetweenGivenToNextDosage: this.treatmentChartForm.timeBetweenGivenToNextDosage,
        }
      : ({} as any);

    if (!this.currentTreatmentRequested) this.currentTreatmentRequested = {};
    if (!options?.preserveGivenFields || !this.currentTreatmentRequested.route) {
      this.currentTreatmentRequested.route = req.route || tr.route || '';
    }
    if (!options?.preserveGivenFields || !this.currentTreatmentRequested.instructions) {
      this.currentTreatmentRequested.instructions = req.instructions || tr.instructions || '';
    }

    if (!options?.preserveGivenFields) {
      this.treatmentChartIntervalUserSet = false;
      this.treatmentChartNextDoseUserSet = false;
    }

    this.updateTreatmentChartDosageCounts(treatmentRequest, {
      chartId: options?.chartId ?? this.treatmentChartId,
    });

    const dateGiven = preserved.dateGiven || nowParts.date;
    const timeGiven = preserved.timeGiven || nowParts.time;

    if (!this.treatmentChartIntervalUserSet && !options?.preserveGivenFields) {
      if (this.treatmentChartShowsNextDoseFields(tr)) {
        const suggested = this.suggestTreatmentChartIntervalHours(treatmentRequest, requestId);
        this.setTreatmentChartIntervalHours(suggested, false);
      }
    } else if (
      preserved.nextDoseIntervalHours == null &&
      preserved.nextDoseIntervalMinutes == null &&
      !this.treatmentChartIntervalUserSet &&
      this.treatmentChartShowsNextDoseFields(tr)
    ) {
      const suggested = this.suggestTreatmentChartIntervalHours(treatmentRequest, requestId);
      this.setTreatmentChartIntervalHours(suggested, false);
    }

    this.treatmentChartForm = {
      ...this.treatmentChartForm,
      dateGiven,
      timeGiven,
      givenBy:
        preserved.givenBy || this.userName || sessionStorage.getItem('username') || '',
      nextDoseIntervalHours:
        preserved.nextDoseIntervalHours ?? this.treatmentChartForm.nextDoseIntervalHours,
      nextDoseIntervalMinutes:
        preserved.nextDoseIntervalMinutes ?? this.treatmentChartForm.nextDoseIntervalMinutes,
      timeBetweenGivenToNextDosage:
        preserved.timeBetweenGivenToNextDosage ??
        this.treatmentChartForm.timeBetweenGivenToNextDosage,
    };

    if (this.isTreatmentChartLastDose(tr)) {
      this.clearTreatmentChartNextDoseFields();
    } else if (
      options?.preserveGivenFields &&
      preserved.timeForNextDosage &&
      preserved.dateForNextDosage
    ) {
      this.treatmentChartForm.timeForNextDosage = preserved.timeForNextDosage;
      this.treatmentChartForm.dateForNextDosage = preserved.dateForNextDosage;
    } else if (
      this.treatmentChartNextDoseUserSet &&
      this.treatmentChartForm.dateForNextDosage &&
      this.treatmentChartForm.timeForNextDosage
    ) {
      this.applyTreatmentChartIntervalFromNextDose();
    } else {
      this.treatmentChartForm.dateGiven = dateGiven;
      this.treatmentChartForm.timeGiven = timeGiven;
      this.applyTreatmentChartNextDoseFromInterval();
    }
  }

  selectTreatmentRequestForChart(treatmentRequest: any, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    if (!treatmentRequest) return;

    this.treatmentChartDrugDropdownOpen = false;
    this.searchTextTreatmentChart = '';

    const enriched = this.enrichTreatmentRequestForChart(treatmentRequest);
    this.selectedTreatmentRequestForChart = enriched;
    this.lastTreatmentChartRequestId = Number(enriched.id);

    const latestChart = this.getLatestChartForRequest(Number(enriched.id));
    this.currentTreatmentRequested = this.buildTreatmentChartDrugFields(enriched, latestChart);

    this.treatmentChartId = null;
    this.treatmentChartIntervalUserSet = false;
    this.treatmentChartNextDoseUserSet = false;
    this.treatmentChartForm = this.emptyTreatmentChartForm();
    this.applyTreatmentChartAutofill(enriched);
    this.loadChartHistoryForSelectedTreatment(enriched.id);
    const doseCheck = this.validateTreatmentChartCanGiveNewDose();
    if (!doseCheck.ok && doseCheck.message) {
      this.showTreatmentChartValidationMessage(doseCheck.message);
    }
    this.cdr.markForCheck();
  }

  get allTreatmentChartsHistory(): any[] {
    return this.sortTreatmentCharts(this.treatmentChartsList || []);
  }

  get selectedTreatmentChartsHistory(): any[] {
    const reqId = this.selectedTreatmentRequestForChart?.id;
    if (reqId == null) return [];
    return this.sortTreatmentCharts(
      (this.treatmentChartsList || []).filter(
        (c: any) => Number(c.treatmentRequestedId) === Number(reqId)
      )
    );
  }

  private sortTreatmentCharts(charts: any[]): any[] {
    return [...charts].sort((a: any, b: any) => {
      const da = this.chartSortKey(a);
      const db = this.chartSortKey(b);
      if (da !== db) return da - db;
      return Number(a.id || 0) - Number(b.id || 0);
    });
  }

  private chartSortKey(chart: any): number {
    const dateRaw = chart?.dateGiven;
    const dateStr =
      typeof dateRaw === 'string'
        ? dateRaw.substring(0, 10)
        : dateRaw?.toString?.()?.split('T')?.[0] || '';
    const timeStr = String(chart?.timeGiven || '00:00').substring(0, 5);
    const t = new Date(`${dateStr}T${timeStr}`).getTime();
    return Number.isNaN(t) ? 0 : t;
  }

  formatTreatmentChartDate(value: unknown): string {
    if (value == null || value === '') return '–';
    if (typeof value === 'string') return value.substring(0, 10);
    return value?.toString?.()?.split('T')?.[0] || '–';
  }

  formatTreatmentChartTime(value: unknown): string {
    if (value == null || value === '') return '–';
    return String(value).substring(0, 5);
  }

  formatTreatmentChartNextDate(chart: any): string {
    return this.formatTreatmentChartDate(
      chart?.dateForNextDosage ?? chart?.dateForNextDosaage
    );
  }

  formatTreatmentChartNextTime(chart: any): string {
    return this.formatTreatmentChartTime(
      chart?.timeForNextDosage ?? chart?.timeForNextDosaage
    );
  }

  private mergeChartsForRequest(requestId: number, rows: any[]): void {
    const id = Number(requestId);
    const others = (this.treatmentChartsList || []).filter(
      (c: any) => Number(c.treatmentRequestedId) !== id
    );
    const normalized = (Array.isArray(rows) ? rows : []).map((c: any) => ({
      ...c,
      treatmentRequestedId: c.treatmentRequestedId ?? id,
    }));
    this.treatmentChartsList = [...others, ...normalized];
  }

  loadChartHistoryForSelectedTreatment(requestId: number | null | undefined): void {
    if (requestId == null) return;
    this.treatmentChartHistoryLoading = true;
    this.api.getTreatmentChartsByRequestId(requestId).subscribe({
      next: (list: any[]) => {
        this.mergeChartsForRequest(Number(requestId), list);
        this.treatmentChartHistoryLoading = false;
        if (this.selectedTreatmentRequestForChart?.id == requestId) {
          this.applyTreatmentChartAutofill(this.selectedTreatmentRequestForChart, {
            chartId: this.treatmentChartId,
            preserveGivenFields: !!this.treatmentChartId,
          });
        }
        this.cdr.markForCheck();
      },
      error: () => {
        this.treatmentChartHistoryLoading = false;
      },
    });
  }

  getUserFormDataTreatmentChart(data: any): void {
    if (!this.selectedTreatmentRequestForChart || !this.selectedTreatmentRequestForChart.id) {
      this.showTreatmentChartValidationMessage('Please select a treatment request');
      setTimeout(() => {
        this.treatmentChartResponseMessage = '';
      }, 5000);
      return;
    }

    const takeaway = this.isTakeawayAdministrationSelected();
    if (!takeaway) {
      const doseCheck = this.validateTreatmentChartCanGiveNewDose();
      if (!doseCheck.ok) {
        this.showTreatmentChartValidationMessage(doseCheck.message || 'Cannot save this dose.');
        setTimeout(() => {
          if (this.treatmentChartResponseColor === 'rgb(238, 16, 16)') {
            this.treatmentChartResponseMessage = '';
          }
        }, 8000);
        return;
      }
    } else if (!this.treatmentChartForm.administrationPlace) {
      this.showTreatmentChartValidationMessage('Select where the drug was taken / administered.');
      return;
    }

    this.isLoadingTreatmentChart = true;
    this.treatmentChartResponseMessage = '';

    this.syncTreatmentChartIntervalLabel();
    if (!takeaway && this.treatmentChartShowsNextDoseFields()) {
      this.applyTreatmentChartNextDoseFromInterval();
    } else {
      this.clearTreatmentChartNextDoseFields();
    }
    if (!takeaway) {
      this.updateTreatmentChartDosageCounts(this.selectedTreatmentRequestForChart, {
        chartId: this.treatmentChartId,
      });
    } else {
      const remaining = this.getRemainingDosesBeforeNewEntry(
        Number(this.selectedTreatmentRequestForChart.id),
        this.selectedTreatmentRequestForChart
      );
      this.treatmentChartForm.totalDosagesRemaining = remaining;
      this.treatmentChartForm.unitsUsed =
        this.currentTreatmentRequested?.totalUnits ??
        this.selectedTreatmentRequestForChart?.totalUnits ??
        remaining;
      this.treatmentChartForm.status = 'Dispensed';
    }

    const payload = this.buildTreatmentChartSavePayload(data);

    if (this.treatmentChartId) {
      this.api.updateTreatmentChart(this.treatmentChartId, payload).subscribe({
        next: (res: any) => {
          this.isLoadingTreatmentChart = false;
          this.treatmentChartResponseMessage =
            res?.message || 'Treatment chart updated successfully';
          this.treatmentChartResponseColor = 'rgb(11, 155, 112)';
          this.afterTreatmentChartSaved();
          setTimeout(() => {
            this.treatmentChartResponseMessage = '';
          }, 3000);
        },
        error: () => {
          this.isLoadingTreatmentChart = false;
          this.treatmentChartResponseMessage = 'Error updating treatment chart';
          this.treatmentChartResponseColor = 'rgb(238, 16, 16)';
          setTimeout(() => {
            this.treatmentChartResponseMessage = '';
          }, 3000);
        },
      });
    } else {
      this.api
        .createTreatmentChart(this.selectedTreatmentRequestForChart.id, payload)
        .subscribe({
          next: (res: any) => {
            this.isLoadingTreatmentChart = false;
            this.treatmentChartResponseMessage =
              res?.message || 'Treatment chart created successfully';
            this.treatmentChartResponseColor = 'rgb(11, 155, 112)';
            this.afterTreatmentChartSaved();
            setTimeout(() => {
              this.treatmentChartResponseMessage = '';
            }, 3000);
          },
          error: () => {
            this.isLoadingTreatmentChart = false;
            this.treatmentChartResponseMessage = 'Error creating treatment chart';
            this.treatmentChartResponseColor = 'rgb(238, 16, 16)';
            setTimeout(() => {
              this.treatmentChartResponseMessage = '';
            }, 3000);
          },
        });
    }
  }

  get treatmentChartScheduleFromCharts(): any[] {
    // Facility doses only — takeaway (home / peripheral clinic) has its own table.
    const allCharts = this.facilityTreatmentChartsHistory;
    if (allCharts.length === 0) return [];

    const chartsByRequest = new Map<number, any[]>();
    for (const chart of allCharts) {
      const reqId = Number(chart.treatmentRequestedId);
      if (!Number.isFinite(reqId) || reqId <= 0) continue;
      const bucket = chartsByRequest.get(reqId) || [];
      bucket.push(chart);
      chartsByRequest.set(reqId, bucket);
    }

    const allSlots: any[] = [];
    chartsByRequest.forEach((charts) => {
      const sorted = this.sortTreatmentCharts(charts);
      const treatment = this.resolveTreatmentRequestForChart(sorted[sorted.length - 1]);
      for (const chart of sorted) {
        const slot = this.chartEntryToGivenSlot(chart, treatment);
        if (slot) allSlots.push(slot);
      }
      const nextSlot = this.buildNextDoseSlot(sorted[sorted.length - 1], treatment);
      if (nextSlot) allSlots.push(nextSlot);
    });

    allSlots.sort((a, b) => {
      if (a.dateValue !== b.dateValue) return a.dateValue - b.dateValue;
      if (a.timeValue !== b.timeValue) return a.timeValue - b.timeValue;
      return String(a.treatment || '').localeCompare(String(b.treatment || ''));
    });

    return this.groupScheduleByDate(allSlots);
  }

  private resolveTreatmentRequestForChart(chart: any): any {
    const reqId = Number(chart?.treatmentRequestedId);
    if (!Number.isFinite(reqId) || reqId <= 0) {
      return {
        itemName: chart?.treatmentName || chart?.itemName || 'Treatment',
        routeOfAdministration: chart?.route || 'Oral',
      };
    }
    const fromDropdown = this.treatmentChartDropdownSource().find(
      (item: any) => Number(item.id) === reqId
    );
    if (fromDropdown) return fromDropdown;
    return {
      id: reqId,
      itemName: chart?.treatmentName || chart?.itemName || 'Treatment',
      routeOfAdministration: chart?.route || 'Oral',
      frequencyValue: chart?.frequencyValue,
      frequencyUnit: chart?.frequencyUnit,
      durationValue: chart?.durationValue,
      durationUnit: chart?.durationUnit,
    };
  }

  private chartEntryToGivenSlot(chart: any, treatment: any): any | null {
    const dateStr = this.formatTreatmentChartDate(chart.dateGiven);
    const timeStr = this.formatTreatmentChartTime(chart.timeGiven);
    if (dateStr === '–') return null;
    const effectiveTime = timeStr === '–' ? '08:00' : timeStr;
    const d = new Date(`${dateStr}T${effectiveTime}`);
    if (Number.isNaN(d.getTime())) return null;
    const dosage = `${chart.dosageValue ?? ''} ${chart.dosageUnit ?? ''}`.trim() || 'N/A';
    const treatmentName =
      chart.treatmentName || chart.itemName || treatment?.itemName || 'Treatment';
    const frequency =
      chart.frequency ||
      `${chart.frequencyValue ?? ''} ${chart.frequencyUnit ?? ''}`.trim() ||
      `${treatment?.frequencyValue ?? ''} ${this.getFrequencyLabel(treatment?.frequencyUnit)}`.trim() ||
      '–';
    return {
      date: dateStr,
      dayName: this.getDayName(d),
      month: this.getMonthName(d),
      dayNumber: d.getDate(),
      time: effectiveTime,
      treatment: treatmentName,
      dosage,
      routeOfAdministration: chart.route || treatment?.routeOfAdministration || 'Oral',
      givenBy: chart.givenBy || '–',
      frequency,
      status: 'Given',
      doseLabel: 'Given',
      totalDosagesGiven: chart.totalDosagesGiven,
      totalDosagesRemaining: chart.totalDosagesRemaining,
      dateValue: d.getTime(),
      timeValue: this.timeToMinutes(effectiveTime),
      chartId: chart.id,
    };
  }

  private buildNextDoseSlot(latestChart: any, treatment: any): any | null {
    if (!latestChart) return null;
    const remaining = Number(latestChart.totalDosagesRemaining);
    if (Number.isFinite(remaining) && remaining <= 0) return null;
    const overall = Number(latestChart.overallTotalDosages);
    const given = Number(latestChart.totalDosagesGiven);
    if (Number.isFinite(overall) && Number.isFinite(given) && given >= overall) return null;
    const d = this.resolveTreatmentChartNextDoseDateTime(latestChart);
    if (!d) return null;
    const nextDate = this.formatDate(d);
    const nextTime = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    const dosage =
      `${latestChart.dosageValue ?? ''} ${latestChart.dosageUnit ?? ''}`.trim() || 'N/A';
    const treatmentName =
      latestChart.treatmentName || latestChart.itemName || treatment?.itemName || 'Treatment';
    const frequency =
      latestChart.frequency ||
      `${latestChart.frequencyValue ?? ''} ${latestChart.frequencyUnit ?? ''}`.trim() ||
      '–';
    return {
      date: nextDate,
      dayName: this.getDayName(d),
      month: this.getMonthName(d),
      dayNumber: d.getDate(),
      time: nextTime,
      treatment: treatmentName,
      dosage,
      routeOfAdministration: latestChart.route || treatment?.routeOfAdministration || 'Oral',
      givenBy: '–',
      frequency,
      status: 'Next dose',
      doseLabel: 'Next dose',
      totalDosagesGiven: latestChart.totalDosagesGiven,
      totalDosagesRemaining: latestChart.totalDosagesRemaining,
      dateValue: d.getTime(),
      timeValue: this.timeToMinutes(nextTime),
      isNextDose: true,
    };
  }

  private resolveTreatmentChartNextDoseDateTime(chart: any): Date | null {
    const nextDate = this.formatTreatmentChartNextDate(chart);
    const nextTime = this.formatTreatmentChartNextTime(chart);
    if (nextDate !== '–' && nextTime !== '–') {
      const stored = new Date(`${nextDate}T${nextTime}`);
      if (!Number.isNaN(stored.getTime())) return stored;
    }
    const givenDate = this.formatTreatmentChartDate(chart?.dateGiven);
    const givenTime = this.formatTreatmentChartTime(chart?.timeGiven);
    const intervalHours = this.parseIntervalHoursFromLabel(chart?.timeBetweenGivenToNextDosage);
    if (givenDate !== '–' && givenTime !== '–' && intervalHours != null && intervalHours > 0) {
      const given = new Date(`${givenDate}T${givenTime}`);
      if (!Number.isNaN(given.getTime())) {
        return new Date(given.getTime() + intervalHours * 3600000);
      }
    }
    return null;
  }

  private getSlotCalendarFields(item: any): {
    date: string;
    dayName: string;
    month: string;
    dayNumber: number;
  } {
    if (item?.dateValue != null && Number.isFinite(Number(item.dateValue))) {
      const d = new Date(Number(item.dateValue));
      if (!Number.isNaN(d.getTime())) {
        return {
          date: this.formatDate(d),
          dayName: this.getDayName(d),
          month: this.getMonthName(d),
          dayNumber: d.getDate(),
        };
      }
    }
    return {
      date: item.date,
      dayName: item.dayName,
      month: item.month,
      dayNumber: item.dayNumber,
    };
  }

  groupScheduleByDate(schedule: any[]): any[] {
    const grouped: any = {};
    schedule.forEach((item: any) => {
      const calendar = this.getSlotCalendarFields(item);
      const dateKey = calendar.date;
      if (!grouped[dateKey]) {
        grouped[dateKey] = {
          date: calendar.date,
          dayName: calendar.dayName,
          month: calendar.month,
          dayNumber: calendar.dayNumber,
          treatments: [],
        };
      }
      grouped[dateKey].treatments.push({ ...item, ...calendar });
    });

    Object.values(grouped).forEach((day: any) => {
      day.treatments.sort((a: any, b: any) => {
        if (a.timeValue != null && b.timeValue != null && a.timeValue !== b.timeValue) {
          return a.timeValue - b.timeValue;
        }
        const byTime = String(a.time || '').localeCompare(String(b.time || ''));
        if (byTime !== 0) return byTime;
        return String(a.treatment || '').localeCompare(String(b.treatment || ''));
      });
    });

    return Object.values(grouped).sort(
      (a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }

  formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  getDayName(date: Date): string {
    return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][
      date.getDay()
    ];
  }

  getMonthName(date: Date): string {
    return [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ][date.getMonth()];
  }

  getFrequencyLabel(unit: any): string {
    const n = Number(unit);
    if (Number.isFinite(n) && Math.abs(n - 1 / 1440) < 0.000001) return 'Minute';
    if (Number.isFinite(n) && Math.abs(n - 1 / 24) < 0.000001) return 'Hour';
    if (n === 1) return 'Day';
    if (n === 7) return 'Week';
    if (n === 30) return 'Month';
    const unitStr = (unit || '').toString().toLowerCase();
    if (unitStr.includes('minute')) return 'Minute';
    if (unitStr.includes('hour')) return 'Hour';
    return 'Day';
  }

  timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  printTreatmentChart(): void {
    document.body.classList.add('pv-printing-treatment-chart');
    setTimeout(() => {
      window.print();
      document.body.classList.remove('pv-printing-treatment-chart');
    }, 150);
  }

  updateEstimatedUnits(): void {
    const totalUnits = Number(this.currentTreatmentRequested?.totalUnits);
    this.currentTreatmentRequested.estimatedUnits = this.roundEstimatedUnits(totalUnits);
  }

  private roundEstimatedUnits(value: any): number {
    const units = Number(value);
    return Number.isFinite(units) && units > 0 ? Math.round(units) : 0;
  }

  private normalizeStockBatchesResponse(res: any): any[] {
    if (Array.isArray(res)) return res;
    if (res && Array.isArray(res.data)) return res.data;
    return [];
  }
}
