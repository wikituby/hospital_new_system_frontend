import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
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
import {
  isMaternityProcedureRequest,
  usesAntenatalStructuredMchReport,
} from '../../../utils/lab-results-docx.util';
import { formatPulsePressureDisplay } from '../../../utils/vitals-calculations.util';

type MchV2Tab = 'patient' | 'vitals' | 'consultation' | 'report' | 'analytics' | 'dept';

type MchV2AnalyticsDateFilter =
  | 'all'
  | 'today'
  | 'this_week'
  | 'this_month'
  | 'this_year'
  | 'custom';

type MchV2AnalyticsStatusFilter = 'all' | 'done' | 'pending';

type MchV2DateFilter =
  | 'all'
  | 'today'
  | 'last_week'
  | 'this_week'
  | 'last_month'
  | 'this_month'
  | 'this_year';

type MchV2DeptStaffMember = {
  name: string;
  role: string;
  title: string;
  profilePic: string;
  details: string;
  lastSeen: number;
  status: 'active' | 'inactive';
};

@Component({
  selector: 'app-mch-v2',
  templateUrl: './mch-v2.component.html',
  styleUrls: ['./mch-v2.component.css']
})
export class MchV2Component implements OnInit, OnDestroy {
  private readonly defaultAvatarDataUrl =
    'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22120%22 height=%22120%22 viewBox=%220 0 120 120%22%3E%3Crect width=%22120%22 height=%22120%22 fill=%22%23e5e7eb%22/%3E%3Ccircle cx=%2260%22 cy=%2245%22 r=%2222%22 fill=%22%239ca3af%22/%3E%3Crect x=%2230%22 y=%2274%22 width=%2260%22 height=%2234%22 rx=%2217%22 fill=%22%239ca3af%22/%3E%3C/svg%3E';

  private statusTimer: any = null;
  private departmentRealtimeSub?: Subscription;
  private mchRequestsLoadInFlight = false;

  mdUser = false;
  canViewAnalyticsMoney = false;

  analyticsDateFilter: MchV2AnalyticsDateFilter = 'this_month';
  analyticsDateFrom = '';
  analyticsDateTo = '';
  analyticsStatusFilter: MchV2AnalyticsStatusFilter = 'all';
  analyticsTotalMoneyPaid = 0;
  isLoadingAnalyticsMoney = false;

  readonly dateFilters: { id: MchV2DateFilter; label: string }[] = [
    { id: 'today', label: 'Today' },
    { id: 'last_week', label: 'Last Week' },
    { id: 'this_week', label: 'This Week' },
    { id: 'last_month', label: 'Last Month' },
    { id: 'this_month', label: 'This Month' },
    { id: 'this_year', label: 'This Year' },
  ];

  activeTab: MchV2Tab = 'report';

  userName: any;

  // MCH requests (left pane)
  mchRequestsList: any[] = [];
  selectedMchRequest: any = null;
  isLoadingRequests = false;
  searchText = '';
  mchRequestDateFilter: MchV2DateFilter = 'all';
  listDateFrom = '';
  listDateTo = '';
  showRequestFilters = false;
  private readonly requestFiltersStorageKey = 'mv2-show-request-filters';

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

  // MCH report
  generalUs: any = {
    labReportTitle: '',
    notes: '',
    recommendation: ''
  };

  generalResult = {
    result: '',
    notes: '',
    recommendation: '',
  };

  /** Structured MCH fields; persisted inside general lab report `result` as JSON. */
  mchForm: Record<string, string> = {
    gravida: '',
    para: '',
    gestationalAge: '',
    bloodPressure: '',
    fundalHeight: '',
    fetalHeartRate: '',
    presentation: '',
    edema: '',
    hemoglobin: '',
    urinalysis: '',
    immunizationStatus: '',
    newbornWeight: '',
    feeding: '',
    complications: '',
    clinicalSummary: ''
  };

  mchReportId: any = null;
  isLoadingReport = false;
  isSavingReport = false;

  deptOpenServices = true;
  deptOpenStaff = false;
  deptServices: string[] = [];
  deptStaff: MchV2DeptStaffMember[] = [];
  isLoadingDeptServices = false;
  isLoadingDeptStaff = false;
  private deptInfoLoaded = false;

  private readonly mchDeptServiceFallback = [
    'Antenatal Care',
    'Postnatal Care',
    'Family Planning',
  ];

  private readonly mchDeptServiceKeywords = [
    'maternity',
    'mch',
    'antenatal',
    'postnatal',
    'obstetric',
  ];

  private readonly mchDeptRoleKeywords = [
    'maternity',
    'mch',
    'midwife',
    'obstetric',
    'nurse',
  ];

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

  ngOnDestroy(): void {
    this.departmentRealtimeSub?.unsubscribe();
    if (this.statusTimer) {
      clearTimeout(this.statusTimer);
    }
  }

  private bindDepartmentRequestLiveUpdates(): void {
    this.departmentRealtime.ensureStarted();
    if (this.apiConfig.isReady()) {
      this.loadMchRequests();
    }
    this.departmentRealtimeSub = this.departmentRealtime.refresh$.subscribe((event: DepartmentRequestRefreshEvent) => {
      if (!this.departmentRealtime.matchesKind(event, 'mch')) {
        return;
      }
      const preserveId = this.selectedMchRequest?.id;
      this.loadMchRequests(preserveId, event.type !== 'API_READY');
    });
  }

  get visibleTabs(): { id: MchV2Tab; label: string; icon: string }[] {
    const tabs: { id: MchV2Tab; label: string; icon: string }[] = [
      { id: 'patient', label: 'Patient Data', icon: 'bi-person-vcard' },
      { id: 'vitals', label: 'Vitals', icon: 'bi-heart-pulse' },
      { id: 'consultation', label: 'Consultations', icon: 'bi-journal-medical' },
      { id: 'report', label: 'MCH Clinical Report', icon: 'bi-file-earmark-medical' },
    ];
    if (this.canViewAnalyticsMoney) {
      tabs.push({ id: 'analytics', label: 'Analytics', icon: 'bi-bar-chart-line' });
    }
    tabs.push({ id: 'dept', label: 'Dept. Info', icon: 'bi-building' });
    return tabs;
  }

  setActiveTab(tab: MchV2Tab): void {
    this.activeTab = tab;
    if (tab === 'analytics' && this.canViewAnalyticsMoney) {
      this.refreshAnalyticsMoneyPaid();
    }
    if (tab === 'dept') {
      this.loadDeptInfo();
    }
  }

  loadDeptInfo(): void {
    if (this.deptInfoLoaded) {
      return;
    }
    this.deptInfoLoaded = true;
    this.loadDeptServices();
    this.loadDeptStaff();
  }

  get activeDeptStaff(): MchV2DeptStaffMember[] {
    return (this.deptStaff || [])
      .filter((emp) => emp.status === 'active')
      .sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0));
  }

  get inactiveDeptStaff(): MchV2DeptStaffMember[] {
    return (this.deptStaff || [])
      .filter((emp) => emp.status !== 'active')
      .sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0));
  }

  private loadDeptServices(): void {
    this.isLoadingDeptServices = true;

    this.api.getAllProcedureList().subscribe({
      next: (procRes: any) => {
        const procedures = Array.isArray(procRes) ? procRes : procRes?.data || [];
        this.api.getLabTestList().subscribe({
          next: (labRes: any) => {
            const labTests = Array.isArray(labRes) ? labRes : labRes?.data || [];
            this.deptServices = this.buildMchDeptServices([...procedures, ...labTests]);
            this.isLoadingDeptServices = false;
          },
          error: () => {
            this.deptServices = this.buildMchDeptServices(procedures);
            this.isLoadingDeptServices = false;
          },
        });
      },
      error: () => {
        this.api.getLabTestList().subscribe({
          next: (labRes: any) => {
            const labTests = Array.isArray(labRes) ? labRes : labRes?.data || [];
            this.deptServices = this.buildMchDeptServices(labTests);
            this.isLoadingDeptServices = false;
          },
          error: () => {
            this.deptServices = this.buildMchDeptServices([]);
            this.isLoadingDeptServices = false;
          },
        });
      },
    });
  }

  private loadDeptStaff(): void {
    this.isLoadingDeptStaff = true;

    this.api.getAllUsers().subscribe({
      next: (res: any) => {
        const users = Array.isArray(res) ? res : res?.data || [];
        this.deptStaff = this.buildMchDeptStaff(users);
        this.isLoadingDeptStaff = false;
      },
      error: () => {
        this.deptStaff = this.buildMchDeptStaff([]);
        this.isLoadingDeptStaff = false;
      },
    });
  }

  private buildMchDeptServices(catalog: any[]): string[] {
    const names = new Set<string>();

    for (const item of catalog || []) {
      if (!this.isMchCatalogItem(item)) {
        continue;
      }
      const name = this.extractProcedureServiceName(item);
      if (name) {
        names.add(name);
      }
    }

    for (const req of (this.mchRequestsList || []).filter(isMaternityProcedureRequest)) {
      for (const field of [req?.procedureRequestedName, req?.exam]) {
        const name = (field || '').toString().trim();
        if (name) {
          names.add(name);
        }
      }
    }

    if (names.size === 0) {
      return [...this.mchDeptServiceFallback];
    }

    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }

  private buildMchDeptStaff(users: any[]): MchV2DeptStaffMember[] {
    const byName = new Map<string, MchV2DeptStaffMember>();

    for (const user of users || []) {
      if (!this.matchesMchDeptKeyword(user?.role) && !this.matchesMchDeptKeyword(user?.department)) {
        continue;
      }

      const name = (user?.username || user?.name || '').toString().trim();
      if (!name) {
        continue;
      }

      byName.set(name, {
        name,
        role: (user?.role || 'MCH Staff').toString(),
        title: (user?.title || user?.role || 'MCH Staff').toString(),
        profilePic: this.normalizeImageSrc(user?.profilePic || this.defaultAvatarDataUrl),
        details: (user?.department || user?.email || user?.contact || 'MCH department staff').toString(),
        lastSeen: Date.now(),
        status: this.normalizeAccountStatus(user?.status),
      });
    }

    for (const staff of this.buildMchStaffFromRequests()) {
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
      name: 'MCH Team',
      role: 'MCH',
      title: 'MCH Staff',
      profilePic: this.defaultAvatarDataUrl,
      details: 'No maternity role activity found yet',
      lastSeen: 0,
      status: 'active',
    }];
  }

  private buildMchStaffFromRequests(): MchV2DeptStaffMember[] {
    const byName = new Map<string, MchV2DeptStaffMember>();
    const nowFallback = Date.now();

    for (const req of (this.mchRequestsList || []).filter(isMaternityProcedureRequest)) {
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
        if (!name || !this.matchesMchDeptKeyword(role)) {
          continue;
        }

        const row: MchV2DeptStaffMember = {
          name,
          role: role || 'MCH Staff',
          title: (staff.title || 'MCH Staff').toString(),
          profilePic: this.normalizeImageSrc(staff.profilePic || this.defaultAvatarDataUrl),
          details: `Handled ${req?.procedureRequestedName || req?.exam || 'Maternity'} request`,
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

  private isMchCatalogItem(item: any): boolean {
    const fields = [
      item?.categoryParent,
      item?.parentCategory,
      item?.parentCategoryName,
      item?.category,
      item?.categoryName,
      item?.parentPage,
      item?.procedureCategory,
      item?.parentProcedureCategory,
      item?.procedureName,
      item?.title,
      item?.name,
    ];
    return fields.some((field) => this.matchesMchServiceKeyword(field));
  }

  private extractProcedureServiceName(item: any): string {
    return (item?.procedureName || item?.title || item?.name || '').toString().trim();
  }

  private matchesMchServiceKeyword(value: any): boolean {
    const text = (value || '').toString().toLowerCase();
    if (!text) {
      return false;
    }
    return this.mchDeptServiceKeywords.some((keyword) => text.includes(keyword));
  }

  private matchesMchDeptKeyword(value: any): boolean {
    const text = (value || '').toString().toLowerCase();
    if (!text) {
      return false;
    }
    return this.mchDeptRoleKeywords.some((keyword) => text.includes(keyword));
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
    let list = (this.mchRequestsList || []).filter(isMaternityProcedureRequest);

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

  setAnalyticsDateFilter(filter: MchV2AnalyticsDateFilter): void {
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

  setAnalyticsStatusFilter(filter: MchV2AnalyticsStatusFilter): void {
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

  private applyAnalyticsPresetDates(filter: MchV2AnalyticsDateFilter): void {
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
    if (this.selectedMchRequest) {
      const fromDisplay = (this.patientDisplay.getDisplayName(this.selectedMchRequest) || '').trim();
      if (fromDisplay) {
        return fromDisplay;
      }
      const fromRequest = (
        this.selectedMchRequest.patientName ||
        this.selectedMchRequest.visit?.patientName ||
        this.selectedMchRequest.patient?.patientName ||
        ''
      ).toString().trim();
      if (fromRequest) {
        return fromRequest;
      }
    }
    return 'Unknown Patient';
  }

  get maternityRequestsCount(): number {
    return (this.mchRequestsList || []).length;
  }

  get selectedUsesAntenatalMchForm(): boolean {
    return usesAntenatalStructuredMchReport(this.selectedMchRequest);
  }

  loadMchRequests(preserveSelectedId?: any, silent = false): void {
    if (!this.apiConfig.isReady()) {
      return;
    }
    if (this.mchRequestsLoadInFlight) {
      return;
    }
    this.mchRequestsLoadInFlight = true;
    if (!silent || !this.mchRequestsList?.length) {
      this.isLoadingRequests = true;
    }

    this.api.getAllMaternityProceduresRequested().subscribe({
      next: (res: any) => {
        this.mchRequestsList = Array.isArray(res) ? res : [];
        this.isLoadingRequests = false;
        this.mchRequestsLoadInFlight = false;

        this.patientDisplay.refreshPatientDirectory().subscribe(() => {
          this.patientDisplay.hydrateFromRequests(this.mchRequestsList).subscribe(() => {
            if (this.selectedMchRequest) {
              this.applyPatientIdentityFromRequest(this.selectedMchRequest);
            }
            this.cdr.detectChanges();
          });
        });

        if (preserveSelectedId) {
          const found = this.mchRequestsList.find((req: any) => req.id === preserveSelectedId);
          if (found) {
            this.selectedMchRequest = found;
            this.applyPatientIdentityFromRequest(found);
          }
        }
      },
      error: (error: any) => {
        this.isLoadingRequests = false;
        this.mchRequestsLoadInFlight = false;
        if (!silent) {
          const msg = error?.error?.message || 'Could not load MCH requests.';
          this.showStatusMessage(msg, 'error');
        }
      }
    });
  }

  getRequestPatientName(request: any): string {
    return this.patientDisplay.getDisplayName(request);
  }

  filteredMchRequestsList(): any[] {
    let filteredList = [...(this.mchRequestsList || [])];

    if (this.searchText) {
      const searchLower = this.searchText.toLowerCase();
      filteredList = filteredList.filter((mchRequest) =>
        (this.getRequestPatientName(mchRequest)?.toLowerCase().includes(searchLower)) ||
        (mchRequest.report?.toLowerCase().includes(searchLower)) ||
        (mchRequest.procedureRequestedName?.toLowerCase().includes(searchLower)) ||
        (mchRequest.exam?.toLowerCase().includes(searchLower)) ||
        (String(mchRequest.dateOfProcedure || '').toLowerCase().includes(searchLower))
      );
    }

    if (this.listDateFrom || this.listDateTo) {
      filteredList = filteredList.filter((mchRequest) => this.matchesListDateRange(mchRequest));
    } else if (this.mchRequestDateFilter !== 'all') {
      filteredList = filteredList.filter((mchRequest) => this.matchesMchRequestDateFilter(mchRequest));
    }

    return [...filteredList].sort((a, b) => (b.visitNumber ?? b.id ?? 0) - (a.visitNumber ?? a.id ?? 0));
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

  setMchRequestDateFilter(filter: MchV2DateFilter): void {
    this.mchRequestDateFilter = filter;
    this.listDateFrom = '';
    this.listDateTo = '';
  }

  onListDateRangeChange(): void {
    if (this.listDateFrom || this.listDateTo) {
      this.mchRequestDateFilter = 'all';
    }
  }

  private matchesListDateRange(mchRequest: any): boolean {
    const rawDate = mchRequest?.dateOfProcedure || mchRequest?.visitDate || mchRequest?.dateCreated;
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

  private matchesMchRequestDateFilter(mchRequest: any): boolean {
    const rawDate = mchRequest?.dateOfProcedure || mchRequest?.visitDate || mchRequest?.dateCreated;
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

    switch (this.mchRequestDateFilter) {
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

  selectMchRequest(mchRequest: any): void {
    this.selectedMchRequest = mchRequest;

    if (mchRequest) {
      this.applyPatientIdentityFromRequest(mchRequest);
      this.refreshSelectedPatientFromEntity(mchRequest);
    }

    this.loadGeneralReportForRequest(mchRequest);
    this.loadVisitClinicalDataFromRequest(mchRequest);
  }

  private applyPatientIdentityFromRequest(mchRequest: any): void {
    if (!mchRequest) {
      return;
    }

    const patient = mchRequest.visit?.patient || mchRequest.patient || {};
    const patientId = this.patientDisplay.extractPatientId(mchRequest);
    const cached = patientId ? this.patientDisplay.getCachedPatient(patientId) : null;

    const first =
      cached?.patientFirstName ||
      mchRequest.patientFirstName ||
      patient.patientFirstName ||
      '';
    const second =
      cached?.patientSecondName ||
      mchRequest.patientSecondName ||
      patient.patientSecondName ||
      '';

    if (first || second) {
      this.patientFirstName = first || '';
      this.patientSecondName = second || '';
    } else {
      const full =
        (this.patientDisplay.getDisplayName(mchRequest) || '').trim() ||
        (mchRequest.patientName || patient.patientName || mchRequest.visit?.patientName || '').toString().trim();
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
      patient.patientProfilePic ||
      mchRequest.patientProfilePic ||
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

    this.patientFileNo = patient.patientFileNo ||
      patient.patientFileNumber ||
      mchRequest.patientFileNo ||
      mchRequest.patientFileNumber ||
      '';

    this.patientId = patientId ||
      patient.id ||
      patient.patientId ||
      mchRequest.patientId ||
      null;

    this.patientAge = mchRequest.patientAge || patient.patientAge || '';
    this.patientDateOfBirth = mchRequest.patientDateOfBirth || patient.patientDateOfBirth || '';

    this.patientContact = patient.patientContact ||
      mchRequest.patientContact ||
      patient.phone ||
      mchRequest.patientPhone ||
      '';

    this.patientGroupName = patient.patientGroupName ||
      patient.patientGroup?.groupNameShortForm ||
      patient.patientGroup?.groupName ||
      mchRequest.patientGroupName ||
      '';

    this.patientAddress = mchRequest.patientAddress || patient.patientAddress || '';
    this.patientGender = mchRequest.patientGender || patient.patientGender || mchRequest.gender || '';
    this.patientOccupation = mchRequest.patientOccupation || patient.patientOccupation || '';

    this.nextOfKinName = mchRequest.nextOfKinName || patient.nextOfKinName || '';
    this.nextOfKinContact = mchRequest.nextOfKinContact || patient.nextOfKinContact || '';
    this.nextOfKinAddress = mchRequest.nextOfKinAddress || patient.nextOfKinAddress || '';
    this.relationship = mchRequest.relationship || patient.relationship || '';

    this.diagnosis = mchRequest.diagnosis || patient.diagnosis || '';
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

  private refreshSelectedPatientFromEntity(mchRequest: any): void {
    const patientId = this.patientDisplay.extractPatientId(mchRequest);
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

  private loadVisitClinicalDataFromRequest(mchRequest: any): void {
    const visitObj = mchRequest?.visit;
    const visitId = visitObj?.id ?? mchRequest?.visitId ?? mchRequest?.visit?.visitId;

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

  private resetMchForm(): void {
    Object.keys(this.mchForm).forEach(k => (this.mchForm[k] = ''));
    this.generalUs.labReportTitle = '';
    this.generalUs.notes = '';
    this.generalUs.recommendation = '';
    this.generalResult = { result: '', notes: '', recommendation: '' };
    this.mchReportId = null;
  }

  loadGeneralReportForRequest(mchRequest: any): void {
    if (!mchRequest?.id) {
      return;
    }

    this.isLoadingReport = true;

    this.api.getGeneralLabReportByRequestId(mchRequest.id).subscribe({
      next: (raw: any) => {
        this.isLoadingReport = false;
        const report = raw?.data ?? raw ?? {};
        if (
          !report?.id ||
          (typeof report?.message === 'string' &&
            report.message.toLowerCase().includes('not found'))
        ) {
          this.resetMchForm();
          return;
        }
        this.mchReportId = report.id;
        this.generalUs.labReportTitle = report.labReportTitle || '';
        this.generalUs.notes = report.notes || '';
        this.generalUs.recommendation = report.recommendation || '';
        const text = report.result || report.report || report.findings || '';

        if (usesAntenatalStructuredMchReport(mchRequest)) {
          if (text && String(text).trim().startsWith('{')) {
            try {
              const parsed = JSON.parse(text);
              if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                Object.keys(this.mchForm).forEach(k => {
                  if (parsed[k] != null) this.mchForm[k] = String(parsed[k]);
                });
                return;
              }
            } catch {
              /* fall through */
            }
          }
          this.mchForm['clinicalSummary'] = text;
          return;
        }

        this.generalResult = {
          result: text || '',
          notes: report.notes || '',
          recommendation: report.recommendation || '',
        };
      },
      error: () => {
        this.isLoadingReport = false;
        this.resetMchForm();
      }
    });
  }

  saveMchReport(): void {
    if (!this.selectedMchRequest?.id) {
      this.showStatusMessage('Select an MCH request first.', 'error');
      return;
    }

    if (!this.userName) {
      this.showStatusMessage('Missing clinician initials.', 'error');
      return;
    }

    const body = this.selectedUsesAntenatalMchForm
      ? {
          doneBy: this.userName,
          result: JSON.stringify(this.mchForm),
          notes: this.generalUs.notes,
          recommendation: this.generalUs.recommendation,
          labReportTitle: this.generalUs.labReportTitle,
        }
      : {
          doneBy: this.userName,
          result: this.generalResult.result,
          notes: this.generalResult.notes,
          recommendation: this.generalResult.recommendation,
          labReportTitle: this.generalUs.labReportTitle,
        };

    const req = this.mchReportId
      ? this.api.updateGeneralLabReport(this.mchReportId, body)
      : this.api.createGeneralLabReportByRequestId(this.selectedMchRequest.id, body);

    this.isSavingReport = true;

    req.subscribe({
      next: (res: any) => {
        this.isSavingReport = false;
        const data = res?.data ?? res;
        if (data?.id) {
          this.mchReportId = data.id;
        }
        this.showStatusMessage(res?.message || 'MCH report saved successfully.', 'success');
        const preservedId = this.selectedMchRequest?.id;
        this.loadGeneralReportForRequest(this.selectedMchRequest);
        this.loadMchRequests(preservedId);
      },
      error: (error: any) => {
        this.isSavingReport = false;
        const msg = error?.error?.message || error?.error?.error || error?.message || 'Save failed.';
        this.showStatusMessage(msg, 'error');
      }
    });
  }

  printMchReport(): void {
    window.print();
  }

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
