import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { ApiService } from '../../../services/api.service';
import { ApiConfigService } from '../../../services/api-config.service';
import {
  DepartmentRequestRealtimeService,
  DepartmentRequestRefreshEvent,
} from '../../../services/department-request-realtime.service';
import { PatientDisplayService } from '../../../services/patient-display.service';
import { userHasAnyRole } from '../../../utils/user-roles.util';
import { formatPulsePressureDisplay } from '../../../utils/vitals-calculations.util';

declare const Quill: any;
declare const window: any;

type ScanV2Tab = 'patient' | 'vitals' | 'consultation' | 'report' | 'analytics' | 'dept';

type ScanV2AnalyticsDateFilter =
  | 'all'
  | 'today'
  | 'this_week'
  | 'this_month'
  | 'this_year'
  | 'custom';

type ScanV2AnalyticsStatusFilter = 'all' | 'done' | 'pending';

type ScanV2DateFilter =
  | 'all'
  | 'today'
  | 'last_week'
  | 'this_week'
  | 'last_month'
  | 'this_month'
  | 'this_year';

type ScanV2DeptStaffMember = {
  name: string;
  role: string;
  title: string;
  profilePic: string;
  details: string;
  lastSeen: number;
  status: 'active' | 'inactive';
};

@Component({
  selector: 'app-scan-v2',
  templateUrl: './scan-v2.component.html',
  styleUrls: ['./scan-v2.component.css']
})
export class ScanV2Component implements OnInit, AfterViewInit, OnDestroy {
  private readonly defaultAvatarDataUrl =
    'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22120%22 height=%22120%22 viewBox=%220 0 120 120%22%3E%3Crect width=%22120%22 height=%22120%22 fill=%22%23e5e7eb%22/%3E%3Ccircle cx=%2260%22 cy=%2245%22 r=%2222%22 fill=%22%239ca3af%22/%3E%3Crect x=%2230%22 y=%2274%22 width=%2260%22 height=%2234%22 rx=%2217%22 fill=%22%239ca3af%22/%3E%3C/svg%3E';

  private statusTimer: any = null;
  private quillInitTimer: any = null;
  private departmentRealtimeSub?: Subscription;
  private scanRequestsLoadInFlight = false;

  @ViewChild('findingsEditor') findingsEditor?: ElementRef<HTMLElement>;
  @ViewChild('impressionEditor') impressionEditor?: ElementRef<HTMLElement>;
  @ViewChild('recommendationEditor') recommendationEditor?: ElementRef<HTMLElement>;

  quillEditor: any = null;
  quillImpressionEditor: any = null;
  quillRecommendationEditor: any = null;
  quillEditorLoaded = false;
  quillImpressionLoaded = false;
  quillRecommendationLoaded = false;

  mdUser = false;
  canViewAnalyticsMoney = false;

  analyticsDateFilter: ScanV2AnalyticsDateFilter = 'this_month';
  analyticsDateFrom = '';
  analyticsDateTo = '';
  analyticsStatusFilter: ScanV2AnalyticsStatusFilter = 'all';
  analyticsTotalMoneyPaid = 0;
  isLoadingAnalyticsMoney = false;

  readonly dateFilters: { id: ScanV2DateFilter; label: string }[] = [
    { id: 'today', label: 'Today' },
    { id: 'last_week', label: 'Last Week' },
    { id: 'this_week', label: 'This Week' },
    { id: 'last_month', label: 'Last Month' },
    { id: 'this_month', label: 'This Month' },
    { id: 'this_year', label: 'This Year' },
  ];

  activeTab: ScanV2Tab = 'report';

  userName: any;

  // Scan requests (left pane)
  scanRequestsList: any[] = [];
  selectedScanRequest: any = null;
  isLoadingRequests = false;
  searchText = '';
  scanRequestDateFilter: ScanV2DateFilter = 'all';
  listDateFrom = '';
  listDateTo = '';
  showRequestFilters = false;
  private readonly requestFiltersStorageKey = 'sv2-show-request-filters';

  // Patient demographics
  patientId: any = null;
  patientFirstName = '';
  patientSecondName = '';
  patientFileNo = '';
  patientProfilePic: any = this.defaultAvatarDataUrl;
  isLoadingProfilePic = false;
  patientGender = '';
  patientAge = '';
  patientDateOfBirth = '';
  patientContact = '';
  patientAddress = '';
  patientOccupation = '';
  patientGroupName = '';
  nextOfKinName = '';
  nextOfKinContact = '';
  nextOfKinAddress = '';
  relationship = '';
  diagnosis = '';

  // Visit / clinical data
  visit: any = null;
  visitId: any = null;

  productListInitialVitals: any[] = [];
  isLoadingVitals = false;

  consultationListByVisit: any[] = [];
  consultation: any = {};
  isLoadingConsultation = false;

  // Ultrasound report
  generalUs: any = {};
  scanReport: any = {};
  scanReportId: any = null;
  scanRequestId: any = null;
  isLoadingReport = false;
  isSavingReport = false;
  isExportingReport = false;

  // Dept. Info
  deptOpenServices = true;
  deptOpenStaff = false;
  deptServices: string[] = [];
  deptStaff: ScanV2DeptStaffMember[] = [];
  isLoadingDeptServices = false;
  isLoadingDeptStaff = false;

  private readonly scanDeptServiceFallback = [
    'General Ultrasound',
    'Obstetric Scan',
    'Abdominal Scan',
  ];

  private readonly scanDeptRoleKeywords = ['sono', 'scan', 'ultrasound', 'radiolog'];

  // Toast
  statusMessage = '';
  statusTone: 'success' | 'error' | 'info' = 'info';
  showStatus = false;

  constructor(
    private api: ApiService,
    private router: Router,
    private patientDisplay: PatientDisplayService,
    private cdr: ChangeDetectorRef,
    private apiConfig: ApiConfigService,
    private departmentRealtime: DepartmentRequestRealtimeService
  ) {}

  ngOnInit(): void {
    this.userName = sessionStorage.getItem('username');
    this.mdUser = userHasAnyRole(['md']);
    this.canViewAnalyticsMoney = userHasAnyRole(['md', 'admin']);
    this.restoreRequestFiltersVisibility();

    if (!this.userName) {
      this.router.navigate(['/login']);
      return;
    }

    if (this.canViewAnalyticsMoney) {
      this.applyAnalyticsPresetDates('this_month');
    }

    this.bindDepartmentRequestLiveUpdates();

    this.patientDisplay.refreshPatientDirectory().subscribe(() => {
      this.cdr.detectChanges();
    });
  }

  ngAfterViewInit(): void {
    if (this.activeTab === 'report') {
      this.scheduleQuillInit();
    }
  }

  ngOnDestroy(): void {
    this.departmentRealtimeSub?.unsubscribe();
    if (this.statusTimer) {
      clearTimeout(this.statusTimer);
    }
    if (this.quillInitTimer) {
      clearTimeout(this.quillInitTimer);
    }
    this.resetQuillEditors();
  }

  private bindDepartmentRequestLiveUpdates(): void {
    this.departmentRealtime.ensureStarted();
    if (this.apiConfig.isReady()) {
      this.loadScanRequests();
    }
    this.departmentRealtimeSub = this.departmentRealtime.refresh$.subscribe((event: DepartmentRequestRefreshEvent) => {
      if (!this.departmentRealtime.matchesKind(event, 'scan')) {
        return;
      }
      const preserveId = this.selectedScanRequest?.id;
      this.loadScanRequests(preserveId, event.type !== 'API_READY');
    });
  }

  // ---------------------------------------------------------------------
  // Tabs
  // ---------------------------------------------------------------------
  get visibleTabs(): { id: ScanV2Tab; label: string; icon: string }[] {
    const tabs: { id: ScanV2Tab; label: string; icon: string }[] = [
      { id: 'patient', label: 'Patient Data', icon: 'bi-person-vcard' },
      { id: 'vitals', label: 'Vitals', icon: 'bi-heart-pulse' },
      { id: 'consultation', label: 'Consultations', icon: 'bi-journal-medical' },
      { id: 'report', label: 'Ultrasound Report', icon: 'bi-file-earmark-medical' },
    ];
    if (this.canViewAnalyticsMoney) {
      tabs.push({ id: 'analytics', label: 'Analytics', icon: 'bi-bar-chart-line' });
    }
    tabs.push({ id: 'dept', label: 'Dept. Info', icon: 'bi-building' });
    return tabs;
  }

  setActiveTab(tab: ScanV2Tab): void {
    this.activeTab = tab;
    if (tab === 'report') {
      this.resetQuillEditors();
      this.scheduleQuillInit();
    } else {
      this.resetQuillEditors();
    }
    if (tab === 'analytics' && this.canViewAnalyticsMoney) {
      this.refreshAnalyticsMoneyPaid();
    }
    if (tab === 'dept') {
      this.loadDeptInfo();
    }
  }

  loadDeptInfo(): void {
    this.loadDeptServices();
    this.loadDeptStaff();
  }

  get activeDeptStaff(): ScanV2DeptStaffMember[] {
    return (this.deptStaff || [])
      .filter((emp) => emp.status === 'active')
      .sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0));
  }

  get inactiveDeptStaff(): ScanV2DeptStaffMember[] {
    return (this.deptStaff || [])
      .filter((emp) => emp.status !== 'active')
      .sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0));
  }

  private loadDeptServices(): void {
    this.isLoadingDeptServices = true;

    this.api.getScanList().subscribe({
      next: (res: any) => {
        const list = Array.isArray(res) ? res : res?.data || [];
        this.deptServices = this.buildScanDeptServices(list);
        this.isLoadingDeptServices = false;
      },
      error: () => {
        this.deptServices = this.buildScanDeptServices([]);
        this.isLoadingDeptServices = false;
      },
    });
  }

  private loadDeptStaff(): void {
    this.isLoadingDeptStaff = true;

    this.api.getAllUsers().subscribe({
      next: (res: any) => {
        const users = Array.isArray(res) ? res : res?.data || [];
        this.deptStaff = this.buildScanDeptStaff(users);
        this.isLoadingDeptStaff = false;
      },
      error: () => {
        this.deptStaff = this.buildScanDeptStaff([]);
        this.isLoadingDeptStaff = false;
      },
    });
  }

  private buildScanDeptServices(catalog: any[]): string[] {
    const names = new Set<string>();

    for (const item of catalog || []) {
      const name = this.extractProcedureServiceName(item);
      if (name) {
        names.add(name);
      }
    }

    for (const req of this.scanRequestsList || []) {
      for (const field of [req?.procedureRequestedName, req?.exam]) {
        const name = (field || '').toString().trim();
        if (name) {
          names.add(name);
        }
      }
    }

    if (names.size === 0) {
      return [...this.scanDeptServiceFallback];
    }

    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }

  private buildScanDeptStaff(users: any[]): ScanV2DeptStaffMember[] {
    const byName = new Map<string, ScanV2DeptStaffMember>();

    for (const user of users || []) {
      if (!this.matchesScanDeptKeyword(user?.role) && !this.matchesScanDeptKeyword(user?.department)) {
        continue;
      }

      const name = (user?.username || user?.name || '').toString().trim();
      if (!name) {
        continue;
      }

      byName.set(name, {
        name,
        role: (user?.role || 'Sonography Staff').toString(),
        title: (user?.title || user?.role || 'Sonography Staff').toString(),
        profilePic: this.normalizeImageSrc(user?.profilePic || this.defaultAvatarDataUrl),
        details: (user?.department || user?.email || user?.contact || 'Ultrasound department staff').toString(),
        lastSeen: Date.now(),
        status: this.normalizeAccountStatus(user?.status),
      });
    }

    for (const staff of this.buildScanStaffFromRequests()) {
      const prev = byName.get(staff.name);
      if (!prev) {
        byName.set(staff.name, staff);
      } else if (staff.lastSeen > prev.lastSeen) {
        byName.set(staff.name, { ...staff, status: prev.status });
      }
    }

    const rows = Array.from(byName.values()).sort((a, b) => b.lastSeen - a.lastSeen);
    if (rows.length > 0) {
      return rows;
    }

    return [{
      name: 'Sonography Team',
      role: 'Sono',
      title: 'Sonography Staff',
      profilePic: this.defaultAvatarDataUrl,
      details: 'No sonography role activity found yet',
      lastSeen: 0,
      status: 'active',
    }];
  }

  private buildScanStaffFromRequests(): ScanV2DeptStaffMember[] {
    const byName = new Map<string, ScanV2DeptStaffMember>();
    const nowFallback = Date.now();

    for (const req of this.scanRequestsList || []) {
      const lastSeen = this.toDateOnly(req?.dateOfProcedure || req?.visitDate || req?.dateCreated)?.getTime() || nowFallback;
      const staffCandidates = [
        { name: req?.doneBy, role: req?.doneByRole || req?.role, title: req?.doneByTitle, profilePic: req?.doneByProfilePic || req?.staffProfilePic || req?.profilePic },
        { name: req?.orderedBy, role: req?.orderedByRole || req?.role, title: req?.orderedByTitle, profilePic: req?.orderedByProfilePic || req?.staffProfilePic || req?.profilePic },
        { name: req?.requestedBy, role: req?.requestedByRole || req?.role, title: req?.requestedByTitle, profilePic: req?.requestedByProfilePic || req?.staffProfilePic || req?.profilePic },
        { name: req?.createdBy, role: req?.createdByRole || req?.role, title: req?.createdByTitle, profilePic: req?.createdByProfilePic || req?.staffProfilePic || req?.profilePic },
      ];

      for (const staff of staffCandidates) {
        const name = (staff.name || '').toString().trim();
        const role = (staff.role || '').toString().trim();
        if (!name || !role.toLowerCase().includes('sono')) {
          continue;
        }

        const row: ScanV2DeptStaffMember = {
          name,
          role: role || 'Sonographer',
          title: (staff.title || 'Sonography Staff').toString(),
          profilePic: this.normalizeImageSrc(staff.profilePic || this.defaultAvatarDataUrl),
          details: `Handled ${req?.procedureRequestedName || req?.exam || 'Ultrasound'} request`,
          lastSeen,
          status: 'active',
        };
        const prev = byName.get(name);
        if (!prev || row.lastSeen > prev.lastSeen) {
          byName.set(name, row);
        }
      }
    }

    return Array.from(byName.values());
  }

  private extractProcedureServiceName(item: any): string {
    return (item?.procedureName || item?.title || item?.name || '').toString().trim();
  }

  private matchesScanDeptKeyword(value: any): boolean {
    const text = (value || '').toString().toLowerCase();
    if (!text) {
      return false;
    }
    return this.scanDeptRoleKeywords.some((keyword) => text.includes(keyword));
  }

  private normalizeAccountStatus(value: any): 'active' | 'inactive' {
    const status = (value || '').toString().toLowerCase().trim();
    if (status === 'inactive' || status === 'disabled' || status === 'false' || status === '0') {
      return 'inactive';
    }
    return 'active';
  }

  onStaffImageError(event: any): void {
    const img = event?.target;
    if (img?.dataset?.['fallbackApplied']) {
      return;
    }
    if (img) {
      img.dataset['fallbackApplied'] = '1';
      img.src = this.defaultAvatarDataUrl;
    }
  }

  analyticsScopedRequests(): any[] {
    let list = this.scanRequestsList || [];

    if (this.analyticsDateFilter !== 'all') {
      list = list.filter((req) => this.matchesAnalyticsDateFilter(req));
    }

    if (this.analyticsStatusFilter === 'done') {
      list = list.filter((req) => this.isAnalyticsRequestDone(req));
    } else if (this.analyticsStatusFilter === 'pending') {
      list = list.filter((req) => !this.isAnalyticsRequestDone(req));
    }

    return list;
  }

  setAnalyticsDateFilter(filter: ScanV2AnalyticsDateFilter): void {
    this.analyticsDateFilter = filter;
    if (filter !== 'custom') {
      this.applyAnalyticsPresetDates(filter);
    }
    if (this.activeTab === 'analytics') {
      this.refreshAnalyticsMoneyPaid();
    }
  }

  onAnalyticsCustomDateChange(): void {
    this.analyticsDateFilter = 'custom';
    if (this.activeTab === 'analytics') {
      this.refreshAnalyticsMoneyPaid();
    }
  }

  setAnalyticsStatusFilter(filter: ScanV2AnalyticsStatusFilter): void {
    this.analyticsStatusFilter = filter;
    if (this.activeTab === 'analytics') {
      this.refreshAnalyticsMoneyPaid();
    }
  }

  refreshAnalyticsMoneyPaid(): void {
    if (!this.canViewAnalyticsMoney) {
      this.analyticsTotalMoneyPaid = 0;
      this.isLoadingAnalyticsMoney = false;
      return;
    }
    // Sum only this department's procedure request amounts (visit payments mix all departments).
    this.analyticsTotalMoneyPaid = this.sumRequestAmountFallback(this.analyticsScopedRequests());
    this.isLoadingAnalyticsMoney = false;
  }

  formatMoney(value: number): string {
    return (value || 0).toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  }

  get analyticsTotalRequests(): number {
    return this.analyticsScopedRequests().length;
  }

  get analyticsDoneCount(): number {
    return this.analyticsScopedRequests().filter((req) => this.isAnalyticsRequestDone(req)).length;
  }

  get analyticsPendingCount(): number {
    return Math.max(this.analyticsTotalRequests - this.analyticsDoneCount, 0);
  }

  get analyticsDonePercent(): number {
    if (this.analyticsTotalRequests === 0) {
      return 0;
    }
    return Math.round((this.analyticsDoneCount / this.analyticsTotalRequests) * 100);
  }

  get analyticsPendingPercent(): number {
    if (this.analyticsTotalRequests === 0) {
      return 0;
    }
    return 100 - this.analyticsDonePercent;
  }

  private isAnalyticsRequestDone(request: any): boolean {
    const status = (request?.status || '').toString().toLowerCase();
    return status === 'done' || status === 'approved' || status === 'completed';
  }

  private sumRequestAmountFallback(requests: any[]): number {
    return requests.reduce(
      (sum, req) => sum + (Number(req?.totalAmount) || Number(req?.unitSellingPrice) || 0),
      0
    );
  }

  private applyAnalyticsPresetDates(filter: ScanV2AnalyticsDateFilter): void {
    const today = new Date();
    const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    if (filter === 'all') {
      this.analyticsDateFrom = '';
      this.analyticsDateTo = '';
      return;
    }

    if (filter === 'today') {
      const ds = this.formatDateInput(todayDate);
      this.analyticsDateFrom = ds;
      this.analyticsDateTo = ds;
      return;
    }

    if (filter === 'this_week') {
      const start = new Date(todayDate);
      const day = start.getDay();
      const diffToMonday = day === 0 ? -6 : 1 - day;
      start.setDate(start.getDate() + diffToMonday);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      this.analyticsDateFrom = this.formatDateInput(start);
      this.analyticsDateTo = this.formatDateInput(end);
      return;
    }

    if (filter === 'this_month') {
      const start = new Date(todayDate.getFullYear(), todayDate.getMonth(), 1);
      const end = new Date(todayDate.getFullYear(), todayDate.getMonth() + 1, 0);
      this.analyticsDateFrom = this.formatDateInput(start);
      this.analyticsDateTo = this.formatDateInput(end);
      return;
    }

    if (filter === 'this_year') {
      const start = new Date(todayDate.getFullYear(), 0, 1);
      const end = new Date(todayDate.getFullYear(), 11, 31);
      this.analyticsDateFrom = this.formatDateInput(start);
      this.analyticsDateTo = this.formatDateInput(end);
    }
  }

  private matchesAnalyticsDateFilter(request: any): boolean {
    const rawDate = request?.dateOfProcedure || request?.visitDate || request?.dateCreated;
    const d = this.toDateOnly(rawDate);
    if (!d) {
      return false;
    }

    if (this.analyticsDateFilter === 'custom') {
      const from = this.analyticsDateFrom ? this.toDateOnly(this.analyticsDateFrom) : null;
      const to = this.analyticsDateTo ? this.toDateOnly(this.analyticsDateTo) : null;
      if (from && d < from) {
        return false;
      }
      if (to && d > to) {
        return false;
      }
      return true;
    }

    const today = new Date();
    const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const startOfThisWeek = new Date(todayDate);
    const day = startOfThisWeek.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    startOfThisWeek.setDate(startOfThisWeek.getDate() + diffToMonday);
    const endOfThisWeek = new Date(startOfThisWeek);
    endOfThisWeek.setDate(startOfThisWeek.getDate() + 6);
    const startOfThisMonth = new Date(todayDate.getFullYear(), todayDate.getMonth(), 1);
    const endOfThisMonth = new Date(todayDate.getFullYear(), todayDate.getMonth() + 1, 0);
    const startOfThisYear = new Date(todayDate.getFullYear(), 0, 1);
    const endOfThisYear = new Date(todayDate.getFullYear(), 11, 31);

    switch (this.analyticsDateFilter) {
      case 'today':
        return d.getTime() === todayDate.getTime();
      case 'this_week':
        return d >= startOfThisWeek && d <= endOfThisWeek;
      case 'this_month':
        return d >= startOfThisMonth && d <= endOfThisMonth;
      case 'this_year':
        return d >= startOfThisYear && d <= endOfThisYear;
      default:
        return true;
    }
  }

  private formatDateInput(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  get patientFullName(): string {
    const composed = `${this.patientFirstName || ''} ${this.patientSecondName || ''}`.trim();
    if (composed) {
      return composed;
    }
    if (this.selectedScanRequest) {
      const fromDisplay = (this.patientDisplay.getDisplayName(this.selectedScanRequest) || '').trim();
      if (fromDisplay) {
        return fromDisplay;
      }
      const fromRequest = (
        this.selectedScanRequest.patientName ||
        this.selectedScanRequest.visit?.patientName ||
        this.selectedScanRequest.patient?.patientName ||
        ''
      ).toString().trim();
      if (fromRequest) {
        return fromRequest;
      }
    }
    return 'Unknown Patient';
  }

  // ---------------------------------------------------------------------
  // Scan requests list
  // ---------------------------------------------------------------------
  loadScanRequests(preserveSelectedId?: any, silent = false): void {
    if (!this.apiConfig.isReady()) {
      return;
    }
    if (this.scanRequestsLoadInFlight) {
      return;
    }
    this.scanRequestsLoadInFlight = true;
    if (!silent || !this.scanRequestsList?.length) {
      this.isLoadingRequests = true;
    }

    this.api.getAllScanProceduresRequested().subscribe({
      next: (res: any) => {
        this.scanRequestsList = res || [];
        this.isLoadingRequests = false;
        this.scanRequestsLoadInFlight = false;

        this.patientDisplay.refreshPatientDirectory().subscribe(() => {
          this.patientDisplay.hydrateFromRequests(this.scanRequestsList).subscribe(() => {
            if (this.selectedScanRequest) {
              this.applyPatientIdentityFromRequest(this.selectedScanRequest);
            }
            this.cdr.detectChanges();
          });
        });

        if (preserveSelectedId) {
          const found = this.scanRequestsList.find((req: any) => req.id === preserveSelectedId);
          if (found) {
            this.selectedScanRequest = found;
            this.applyPatientIdentityFromRequest(found);
          }
        }
      },
      error: (error: any) => {
        this.isLoadingRequests = false;
        this.scanRequestsLoadInFlight = false;
        if (!silent) {
          const msg = error?.error?.message || 'Could not load scan requests.';
          this.showStatusMessage(msg, 'error');
        }
      }
    });
  }

  getRequestPatientName(request: any): string {
    return this.patientDisplay.getDisplayName(request);
  }

  filteredScanRequestsList(): any[] {
    let filteredList = this.scanRequestsList || [];

    if (this.searchText) {
      const searchLower = this.searchText.toLowerCase();
      filteredList = filteredList.filter((scanRequest) =>
        (this.getRequestPatientName(scanRequest)?.toLowerCase().includes(searchLower)) ||
        (scanRequest.report?.toLowerCase().includes(searchLower)) ||
        (scanRequest.procedureRequestedName?.toLowerCase().includes(searchLower)) ||
        (scanRequest.exam?.toLowerCase().includes(searchLower)) ||
        (scanRequest.dateOfProcedure?.toLowerCase().includes(searchLower))
      );
    }

    if (this.listDateFrom || this.listDateTo) {
      filteredList = filteredList.filter((scanRequest) => this.matchesListDateRange(scanRequest));
    } else if (this.scanRequestDateFilter !== 'all') {
      filteredList = filteredList.filter((scanRequest) => this.matchesScanRequestDateFilter(scanRequest));
    }

    return [...filteredList].sort((a, b) => (b.id ?? 0) - (a.id ?? 0));
  }

  toggleRequestFilters(): void {
    this.showRequestFilters = !this.showRequestFilters;
    try {
      localStorage.setItem(this.requestFiltersStorageKey, String(this.showRequestFilters));
    } catch {
      /* ignore */
    }
    this.cdr.detectChanges();
  }

  private restoreRequestFiltersVisibility(): void {
    try {
      const saved = localStorage.getItem(this.requestFiltersStorageKey);
      if (saved !== null) {
        this.showRequestFilters = saved === 'true';
      }
    } catch {
      /* ignore */
    }
  }

  setScanRequestDateFilter(filter: ScanV2DateFilter): void {
    this.scanRequestDateFilter = filter;
    this.listDateFrom = '';
    this.listDateTo = '';
  }

  onListDateRangeChange(): void {
    if (this.listDateFrom || this.listDateTo) {
      this.scanRequestDateFilter = 'all';
    }
  }

  private matchesListDateRange(scanRequest: any): boolean {
    const rawDate = scanRequest?.dateOfProcedure || scanRequest?.visitDate || scanRequest?.dateCreated;
    const d = this.toDateOnly(rawDate);
    if (!d) return false;

    if (this.listDateFrom) {
      const from = this.toDateOnly(this.listDateFrom);
      if (from && d < from) return false;
    }
    if (this.listDateTo) {
      const to = this.toDateOnly(this.listDateTo);
      if (to && d > to) return false;
    }
    return true;
  }

  private matchesScanRequestDateFilter(scanRequest: any): boolean {
    const rawDate = scanRequest?.dateOfProcedure || scanRequest?.visitDate || scanRequest?.dateCreated;
    const d = this.toDateOnly(rawDate);
    if (!d) return false;

    const today = new Date();
    const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const startOfThisWeek = new Date(todayDate);
    const day = startOfThisWeek.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    startOfThisWeek.setDate(startOfThisWeek.getDate() + diffToMonday);
    const endOfThisWeek = new Date(startOfThisWeek);
    endOfThisWeek.setDate(startOfThisWeek.getDate() + 6);
    const startOfLastWeek = new Date(startOfThisWeek);
    startOfLastWeek.setDate(startOfThisWeek.getDate() - 7);
    const endOfLastWeek = new Date(startOfThisWeek);
    endOfLastWeek.setDate(startOfThisWeek.getDate() - 1);
    const startOfThisMonth = new Date(todayDate.getFullYear(), todayDate.getMonth(), 1);
    const endOfThisMonth = new Date(todayDate.getFullYear(), todayDate.getMonth() + 1, 0);
    const startOfLastMonth = new Date(todayDate.getFullYear(), todayDate.getMonth() - 1, 1);
    const endOfLastMonth = new Date(todayDate.getFullYear(), todayDate.getMonth(), 0);
    const startOfThisYear = new Date(todayDate.getFullYear(), 0, 1);
    const endOfThisYear = new Date(todayDate.getFullYear(), 11, 31);

    switch (this.scanRequestDateFilter) {
      case 'today':
        return d.getTime() === todayDate.getTime();
      case 'this_week':
        return d >= startOfThisWeek && d <= endOfThisWeek;
      case 'last_week':
        return d >= startOfLastWeek && d <= endOfLastWeek;
      case 'this_month':
        return d >= startOfThisMonth && d <= endOfThisMonth;
      case 'last_month':
        return d >= startOfLastMonth && d <= endOfLastMonth;
      case 'this_year':
        return d >= startOfThisYear && d <= endOfThisYear;
      default:
        return true;
    }
  }

  private toDateOnly(value: any): Date | null {
    if (!value) return null;
    const parsed = new Date(value);
    if (isNaN(parsed.getTime())) return null;
    return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  }

  // ---------------------------------------------------------------------
  // Selecting a scan request
  // ---------------------------------------------------------------------
  selectScanRequest(scanRequest: any): void {
    this.selectedScanRequest = scanRequest;
    this.generalUs.indication = this.stripHtmlTags(this.resolveScanRequestIndication(scanRequest));

    if (scanRequest) {
      this.applyPatientIdentityFromRequest(scanRequest);
      this.refreshSelectedPatientFromEntity(scanRequest);
    }

    this.loadScanReportForThatRequest(scanRequest);
    this.loadVisitClinicalDataFromScanRequest(scanRequest);
  }

  private applyPatientIdentityFromRequest(scanRequest: any): void {
    if (!scanRequest) {
      return;
    }

    const patient = scanRequest.visit?.patient || scanRequest.patient || {};
    const patientId = this.patientDisplay.extractPatientId(scanRequest);
    const cached = patientId ? this.patientDisplay.getCachedPatient(patientId) : null;

    const first =
      cached?.patientFirstName ||
      scanRequest.patientFirstName ||
      patient.patientFirstName ||
      '';
    const second =
      cached?.patientSecondName ||
      scanRequest.patientSecondName ||
      patient.patientSecondName ||
      '';

    if (first || second) {
      this.patientFirstName = first || '';
      this.patientSecondName = second || '';
    } else {
      const full =
        (this.patientDisplay.getDisplayName(scanRequest) || '').trim() ||
        (scanRequest.patientName || patient.patientName || scanRequest.visit?.patientName || '').toString().trim();
      if (full) {
        const parts = full.split(/\s+/).filter(Boolean);
        this.patientFirstName = parts[0] || '';
        this.patientSecondName = parts.slice(1).join(' ');
      } else {
        this.patientFirstName = '';
        this.patientSecondName = '';
      }
    }

    if (cached) {
      this.applyPatientProfileFromEntity(cached);
      return;
    }

    const newProfilePic = this.normalizeImageSrc(
      cached?.patientProfilePic ||
      patient.patientProfilePic ||
      scanRequest.patientProfilePic ||
      this.defaultAvatarDataUrl
    );
    if (this.patientProfilePic !== newProfilePic) {
      this.isLoadingProfilePic = true;
      this.patientProfilePic = '';
      setTimeout(() => {
        this.patientProfilePic = newProfilePic;
      }, 0);
    } else {
      this.patientProfilePic = newProfilePic;
      this.isLoadingProfilePic = false;
    }

    this.patientFileNo = cached?.patientFileNo ||
      patient.patientFileNo ||
      patient.patientFileNumber ||
      scanRequest.patientFileNo ||
      scanRequest.patientFileNumber ||
      scanRequest.patientFileNumber ||
      '';

    this.patientId = patientId ||
      patient.id ||
      patient.patientId ||
      scanRequest.patientId ||
      null;

    this.patientAge = cached?.patientAge || scanRequest.patientAge || patient.patientAge || '';
    this.patientDateOfBirth = cached?.patientDateOfBirth || scanRequest.patientDateOfBirth || patient.patientDateOfBirth || '';

    this.patientContact = cached?.patientContact ||
      patient.patientContact ||
      scanRequest.patientContact ||
      patient.phone ||
      scanRequest.patientPhone ||
      '';

    this.patientGroupName = patient.patientGroupName ||
      patient.patientGroup?.groupNameShortForm ||
      patient.patientGroup?.groupName ||
      scanRequest.patientGroupName ||
      '';

    this.patientAddress = cached?.patientAddress || scanRequest.patientAddress || patient.patientAddress || '';
    this.patientGender = cached?.patientGender || scanRequest.patientGender || patient.patientGender || scanRequest.gender || '';
    this.patientOccupation = cached?.patientOccupation || scanRequest.patientOccupation || patient.patientOccupation || '';

    this.nextOfKinName = cached?.nextOfKinName || scanRequest.nextOfKinName || patient.nextOfKinName || '';
    this.nextOfKinContact = cached?.nextOfKinContact || scanRequest.nextOfKinContact || patient.nextOfKinContact || '';
    this.nextOfKinAddress = cached?.nextOfKinAddress || scanRequest.nextOfKinAddress || patient.nextOfKinAddress || '';
    this.relationship = cached?.relationship || scanRequest.relationship || patient.relationship || '';

    this.diagnosis = cached?.diagnosis || scanRequest.diagnosis || patient.diagnosis || '';
  }

  private applyPatientProfileFromEntity(patient: any): void {
    if (!patient) {
      return;
    }

    this.patientFirstName = patient.patientFirstName || this.patientFirstName || '';
    this.patientSecondName = patient.patientSecondName || this.patientSecondName || '';
    this.patientFileNo = patient.patientFileNo || this.patientFileNo || '';
    this.patientContact = patient.patientContact || this.patientContact || '';
    this.patientAge = patient.patientAge || this.patientAge || '';
    this.patientDateOfBirth = patient.patientDateOfBirth || this.patientDateOfBirth || '';
    this.patientGender = patient.patientGender || this.patientGender || '';
    this.patientAddress = patient.patientAddress || this.patientAddress || '';
    this.patientOccupation = patient.patientOccupation || this.patientOccupation || '';
    this.nextOfKinName = patient.nextOfKinName || this.nextOfKinName || '';
    this.nextOfKinContact = patient.nextOfKinContact || this.nextOfKinContact || '';
    this.nextOfKinAddress = patient.nextOfKinAddress || this.nextOfKinAddress || '';
    this.relationship = patient.relationship || this.relationship || '';
    this.diagnosis = patient.diagnosis || this.diagnosis || '';

    const profilePic = patient.patientProfilePic;
    if (profilePic) {
      const normalizedPic = this.normalizeImageSrc(profilePic);
      if (this.patientProfilePic !== normalizedPic) {
        this.isLoadingProfilePic = true;
        this.patientProfilePic = '';
        setTimeout(() => {
          this.patientProfilePic = normalizedPic;
        }, 0);
      } else {
        this.patientProfilePic = normalizedPic;
      }
    }
  }

  private refreshSelectedPatientFromEntity(scanRequest: any): void {
    const patientId = this.patientDisplay.extractPatientId(scanRequest);
    if (!patientId) {
      return;
    }

    this.patientId = patientId;
    const cached = this.patientDisplay.getCachedPatient(patientId);
    if (cached) {
      this.applyPatientProfileFromEntity(cached);
    }

    this.patientDisplay.refreshPatient(patientId).subscribe((patient) => {
      if (patient) {
        this.applyPatientProfileFromEntity(patient);
        this.cdr.detectChanges();
      }
    });
  }

  private resolveScanRequestIndication(scanRequest: any): string {
    return (
      scanRequest?.indication ||
      scanRequest?.reason ||
      scanRequest?.scanIndication ||
      scanRequest?.requestIndication ||
      scanRequest?.visit?.reason ||
      scanRequest?.visit?.visitReason ||
      ''
    ).toString().trim();
  }

  private normalizeImageSrc(value: any): string {
    const raw = (value || '').toString().trim();
    if (!raw) return this.defaultAvatarDataUrl;
    const lower = raw.toLowerCase();
    const isAllowed =
      lower.startsWith('http://') ||
      lower.startsWith('https://') ||
      lower.startsWith('data:image/') ||
      lower.startsWith('assets/');
    if (!isAllowed || raw.startsWith('<')) return this.defaultAvatarDataUrl;
    return raw;
  }

  onProfileImageError(event: any): void {
    const img = event?.target;
    if (img?.dataset?.['fallbackApplied']) {
      this.isLoadingProfilePic = false;
      return;
    }
    if (img) {
      img.dataset['fallbackApplied'] = '1';
      img.src = this.defaultAvatarDataUrl;
    }
    this.patientProfilePic = this.defaultAvatarDataUrl;
    this.isLoadingProfilePic = false;
  }

  onProfileImageLoad(): void {
    this.isLoadingProfilePic = false;
  }

  // ---------------------------------------------------------------------
  // Vitals + consultation (from the visit linked to the scan request)
  // ---------------------------------------------------------------------
  private loadVisitClinicalDataFromScanRequest(scanRequest: any): void {
    const visitObj = scanRequest?.visit;
    const visitId = visitObj?.id ?? scanRequest?.visitId ?? scanRequest?.visit?.visitId;

    this.visit = visitObj || null;
    this.visitId = visitId || null;

    if (!visitId) {
      this.productListInitialVitals = [];
      this.consultationListByVisit = [];
      this.consultation = {};
      return;
    }

    this.isLoadingVitals = true;
    this.api.getInitialVitalsByVisit(visitId).subscribe({
      next: (res: any) => {
        this.productListInitialVitals = res || [];
        this.isLoadingVitals = false;
      },
      error: () => {
        this.isLoadingVitals = false;
      }
    });

    this.loadConsultation(visitId);
  }

  private loadConsultation(visitId: any): void {
    this.isLoadingConsultation = true;
    this.api.getConsultationsByVisit(visitId).subscribe({
      next: (res: any) => {
        const consultations = Array.isArray(res) ? res : (res ? [res] : []);
        this.consultationListByVisit = consultations;
        this.consultation = this.toPlainTextConsultation(consultations[0] || {});
        this.isLoadingConsultation = false;
      },
      error: () => {
        this.isLoadingConsultation = false;
      }
    });
  }

  /** Strip HTML tags so Quill/HTML content shows as readable text. */
  stripHtmlTags(html: any): string {
    if (html == null) {
      return '';
    }
    const raw = String(html);
    if (!raw.trim()) {
      return '';
    }
    if (!/[<>]/.test(raw)) {
      return raw;
    }
    const tmp = document.createElement('div');
    tmp.innerHTML = raw
      .replace(/<\s*br\s*\/?>/gi, '\n')
      .replace(/<\/\s*p\s*>/gi, '\n')
      .replace(/<\/\s*div\s*>/gi, '\n')
      .replace(/<\/\s*li\s*>/gi, '\n');
    const text = (tmp.textContent || tmp.innerText || '')
      .replace(/\u00a0/g, ' ')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    return text;
  }

  plainText(value: any): string {
    const text = this.stripHtmlTags(value);
    return text || '—';
  }

  private toPlainTextConsultation(source: any): any {
    if (!source || typeof source !== 'object') {
      return {};
    }
    const fields = [
      'chiefComplaint',
      'historyOfPresentingComplaint',
      'reviewOfOtherSystems',
      'medicalHistory',
      'medicationHistory',
      'allergies',
      'familyHistory',
      'socialHistory',
      'clinicalExamination',
      'diagnosis',
      'differentialDiagnosis',
      'followUpInstructions',
      'notes',
    ];
    const out: any = { ...source };
    for (const key of fields) {
      if (out[key] != null) {
        out[key] = this.stripHtmlTags(out[key]);
      }
    }
    return out;
  }

  formatVitalDateTimeDisplay(item: any): string {
    const d = item?.dateTaken;
    const t = item?.timeTaken;
    const ds = d != null && String(d).trim() !== '' ? String(d).trim() : '';
    const ts = t != null && String(t).trim() !== '' ? String(t).trim() : '';
    if (!ds && !ts) return '—';
    if (ds && ts) return `${ds} · ${ts}`;
    return ds || ts;
  }

  formatPulsePressureForVital(vital: any): string {
    return formatPulsePressureDisplay(vital);
  }

  // ---------------------------------------------------------------------
  // Ultrasound report tab
  // ---------------------------------------------------------------------
  loadScanReportForThatRequest(scanRequest: any): void {
    if (!scanRequest?.id) {
      return;
    }

    this.isLoadingReport = true;
    this.scanRequestId = scanRequest.id;
    this.resetQuillEditors();

    this.api.getScanReportByRequestId(scanRequest.id).subscribe({
      next: (res: any) => {
        this.isLoadingReport = false;
        this.scanReport = res?.data || {};

        // Keep HTML for Quill / PDF print layout (do not strip tags here).
        this.generalUs.findings = this.scanReport.findings || '';
        this.generalUs.indication = this.stripHtmlTags(
          this.scanReport.indication || this.resolveScanRequestIndication(scanRequest)
        );
        this.generalUs.exam = this.stripHtmlTags(this.scanReport.exam);
        this.generalUs.impression = this.scanReport.impression || '';
        this.generalUs.recommendation = this.scanReport.recommendation || '';
        this.generalUs.scanReportTitle = this.stripHtmlTags(
          this.scanReport.scanReportTitle || this.scanReport.title
        );

        this.scanReportId = this.scanReport.id || null;
        this.cdr.detectChanges();
        if (this.activeTab === 'report') {
          this.scheduleQuillInit();
        }
      },
      error: (error: any) => {
        this.isLoadingReport = false;
        const msg = error?.error?.message || error?.error?.error || 'Could not load the scan report.';
        this.showStatusMessage(msg, 'error');
      }
    });
  }

  saveScanReport(): void {
    if (!this.scanReportId) {
      this.showStatusMessage('Missing scan report Id.', 'error');
      return;
    }

    if (!this.userName) {
      this.showStatusMessage('Missing sonographer initials.', 'error');
      return;
    }

    this.syncModelFromQuill();

    const indicationToSave = (
      this.generalUs.indication ||
      this.resolveScanRequestIndication(this.selectedScanRequest) ||
      ''
    ).toString().trim();
    this.generalUs.indication = indicationToSave;

    const payload = {
      indication: indicationToSave,
      exam: this.generalUs.exam || '',
      scanReportTitle: (this.generalUs.scanReportTitle || '').toString().trim(),
      findings: this.generalUs.findings || '',
      impression: this.generalUs.impression || '',
      recommendation: this.generalUs.recommendation || '',
      doneBy: this.userName
    };

    this.isSavingReport = true;

    this.api.updateScanReport(this.scanReportId, payload).subscribe({
      next: (response: any) => {
        this.isSavingReport = false;
        this.showStatusMessage(response?.message || 'Scan report saved successfully.', 'success');

        const preservedId = this.selectedScanRequest?.id;
        this.loadScanReportForThatRequest(this.selectedScanRequest);
        this.loadScanRequests(preservedId);
      },
      error: (error: any) => {
        this.isSavingReport = false;
        const msg = error?.error?.message || error?.error?.error || 'An unexpected error occurred. Please try again.';
        this.showStatusMessage(msg, 'error');
      }
    });
  }

  private scheduleQuillInit(retryCount = 0): void {
    if (this.quillInitTimer) {
      clearTimeout(this.quillInitTimer);
    }
    this.quillInitTimer = setTimeout(() => {
      if (this.activeTab !== 'report') {
        return;
      }
      const QuillConstructor =
        typeof Quill !== 'undefined' ? Quill : typeof window !== 'undefined' ? window.Quill : null;
      if (!QuillConstructor || !this.findingsEditor?.nativeElement) {
        if (retryCount < 12) {
          this.scheduleQuillInit(retryCount + 1);
        }
        return;
      }
      this.initializeQuillEditors(QuillConstructor);
    }, retryCount === 0 ? 0 : 80);
  }

  private resetQuillEditors(): void {
    this.quillEditor = null;
    this.quillImpressionEditor = null;
    this.quillRecommendationEditor = null;
    this.quillEditorLoaded = false;
    this.quillImpressionLoaded = false;
    this.quillRecommendationLoaded = false;
  }

  private quillToolbar(): any[] {
    return [
      [{ header: [1, 2, 3, 4, 5, 6, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ color: [] }, { background: [] }],
      [{ list: 'ordered' }, { list: 'bullet' }],
      [{ indent: '-1' }, { indent: '+1' }],
      [{ align: [] }],
      ['link', 'image'],
      ['clean'],
    ];
  }

  private initializeQuillEditors(QuillConstructor: any): void {
    if (this.quillEditorLoaded || !this.findingsEditor?.nativeElement) {
      return;
    }

    try {
      this.quillEditor = new QuillConstructor(this.findingsEditor.nativeElement, {
        theme: 'snow',
        modules: { toolbar: this.quillToolbar() },
        placeholder: 'Enter findings...',
      });
      if (this.generalUs.findings) {
        this.quillEditor.root.innerHTML = this.generalUs.findings;
      }
      this.quillEditor.on('text-change', () => {
        this.generalUs.findings = this.quillEditor.root.innerHTML;
      });
      this.quillEditorLoaded = true;

      if (this.impressionEditor?.nativeElement) {
        this.quillImpressionEditor = new QuillConstructor(this.impressionEditor.nativeElement, {
          theme: 'snow',
          modules: { toolbar: this.quillToolbar() },
          placeholder: 'Enter scan impression/conclusion...',
        });
        if (this.generalUs.impression) {
          this.quillImpressionEditor.root.innerHTML = this.generalUs.impression;
        }
        this.quillImpressionEditor.on('text-change', () => {
          this.generalUs.impression = this.quillImpressionEditor.root.innerHTML;
        });
        this.quillImpressionLoaded = true;
      }

      if (this.recommendationEditor?.nativeElement) {
        this.quillRecommendationEditor = new QuillConstructor(this.recommendationEditor.nativeElement, {
          theme: 'snow',
          modules: { toolbar: this.quillToolbar() },
          placeholder: 'Enter scan recommendations...',
        });
        if (this.generalUs.recommendation) {
          this.quillRecommendationEditor.root.innerHTML = this.generalUs.recommendation;
        }
        this.quillRecommendationEditor.on('text-change', () => {
          this.generalUs.recommendation = this.quillRecommendationEditor.root.innerHTML;
        });
        this.quillRecommendationLoaded = true;
      }

      this.cdr.detectChanges();
    } catch (error) {
      console.error('Scan V2 Quill init failed', error);
      this.resetQuillEditors();
    }
  }

  private syncQuillFromModel(): void {
    if (this.quillEditor && this.quillEditorLoaded) {
      this.quillEditor.root.innerHTML = this.generalUs.findings || '';
    }
    if (this.quillImpressionEditor && this.quillImpressionLoaded) {
      this.quillImpressionEditor.root.innerHTML = this.generalUs.impression || '';
    }
    if (this.quillRecommendationEditor && this.quillRecommendationLoaded) {
      this.quillRecommendationEditor.root.innerHTML = this.generalUs.recommendation || '';
    }
  }

  private syncModelFromQuill(): void {
    if (this.quillEditor && this.quillEditorLoaded) {
      this.generalUs.findings = this.quillEditor.root.innerHTML;
    }
    if (this.quillImpressionEditor && this.quillImpressionLoaded) {
      this.generalUs.impression = this.quillImpressionEditor.root.innerHTML;
    }
    if (this.quillRecommendationEditor && this.quillRecommendationLoaded) {
      this.generalUs.recommendation = this.quillRecommendationEditor.root.innerHTML;
    }
  }

  previewAndPrintScanReport(): void {
    if (!this.selectedScanRequest?.id) {
      this.showStatusMessage('Select a scan request first.', 'error');
      return;
    }

    this.isExportingReport = true;

    this.api.exportScanResults(this.selectedScanRequest.id).subscribe({
      next: (res: Blob) => {
        this.isExportingReport = false;

        const blob = new Blob([res], { type: 'application/pdf' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `scan-report-${this.selectedScanRequest.id}.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
      },
      error: (error: any) => {
        this.isExportingReport = false;
        const msg = error?.error?.message || error?.error?.error || 'Could not generate the scan report PDF.';
        this.showStatusMessage(msg, 'error');
      }
    });
  }

  // ---------------------------------------------------------------------
  // Toast
  // ---------------------------------------------------------------------
  private showStatusMessage(message: string, tone: 'success' | 'error' | 'info'): void {
    this.statusMessage = message;
    this.statusTone = tone;
    this.showStatus = true;
    if (this.statusTimer) {
      clearTimeout(this.statusTimer);
    }
    this.statusTimer = setTimeout(() => {
      this.showStatus = false;
    }, 4000);
  }
}
