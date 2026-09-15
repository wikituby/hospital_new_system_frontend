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
import {
  getCbcFieldsForPatient,
  getCbcReferenceLabel,
  CbcResultField,
} from '../../../utils/cbc-reference-ranges.util';

declare const Quill: any;
declare const window: any;

type LabV2Tab = 'patient' | 'vitals' | 'consultation' | 'report' | 'analytics' | 'dept';

type LabV2DateFilter =
  | 'all'
  | 'today'
  | 'last_week'
  | 'this_week'
  | 'last_month'
  | 'this_month'
  | 'this_year';

type LabV2FormType = 'malaria' | 'urinalysis' | 'cbc' | 'parasitology' | 'general';

type LabV2DeptStaffMember = {
  name: string;
  role: string;
  title: string;
  profilePic: string;
  details: string;
  lastSeen: number;
  status: 'active' | 'inactive';
};

type LabV2AnalyticsDateFilter =
  | 'all'
  | 'today'
  | 'this_week'
  | 'this_month'
  | 'this_year'
  | 'custom';

@Component({
  selector: 'app-lab-v2',
  templateUrl: './lab-v2.component.html',
  styleUrls: ['./lab-v2.component.css'],
})
export class LabV2Component implements OnInit, AfterViewInit, OnDestroy {
  private readonly defaultAvatarDataUrl =
    'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22120%22 height=%22120%22 viewBox=%220 0 120 120%22%3E%3Crect width=%22120%22 height=%22120%22 fill=%22%23e5e7eb%22/%3E%3Ccircle cx=%2260%22 cy=%2245%22 r=%2222%22 fill=%22%239ca3af%22/%3E%3Crect x=%2230%22 y=%2274%22 width=%2260%22 height=%2234%22 rx=%2217%22 fill=%22%239ca3af%22/%3E%3C/svg%3E';

  private statusTimer: any = null;
  private departmentRealtimeSub?: Subscription;
  private labRequestsLoadInFlight = false;
  private quillInitTimer: any = null;

  @ViewChild('resultEditor') resultEditor?: ElementRef<HTMLElement>;
  @ViewChild('recommendationEditor') recommendationEditor?: ElementRef<HTMLElement>;

  quillResultEditor: any = null;
  quillRecommendationEditor: any = null;
  quillResultLoaded = false;
  quillRecommendationLoaded = false;

  readonly dateFilters: { id: LabV2DateFilter; label: string }[] = [
    { id: 'today', label: 'Today' },
    { id: 'last_week', label: 'Last Week' },
    { id: 'this_week', label: 'This Week' },
    { id: 'last_month', label: 'Last Month' },
    { id: 'this_month', label: 'This Month' },
    { id: 'this_year', label: 'This Year' },
  ];

  readonly analyticsDateFilters: { id: LabV2AnalyticsDateFilter; label: string }[] = [
    { id: 'today', label: 'Today' },
    { id: 'this_week', label: 'This Week' },
    { id: 'this_month', label: 'This Month' },
    { id: 'this_year', label: 'This Year' },
  ];

  activeTab: LabV2Tab = 'report';
  mdUser = false;
  canViewAnalyticsMoney = false;
  userName: any;

  labRequestsList: any[] = [];
  selectedLabRequest: any = null;
  isLoadingRequests = false;
  searchText = '';
  labRequestDateFilter: LabV2DateFilter = 'all';
  listDateFrom = '';
  listDateTo = '';
  showRequestFilters = false;
  private readonly requestFiltersStorageKey = 'lv2-show-request-filters';

  analyticsDateFilter: LabV2AnalyticsDateFilter = 'this_month';
  analyticsDateFrom = '';
  analyticsDateTo = '';
  analyticsStatusFilter: 'all' | 'done' | 'pending' = 'all';
  analyticsTotalMoneyPaid = 0;
  isLoadingAnalyticsMoney = false;

  activeFormType: LabV2FormType = 'general';

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

  visit: any = null;
  visitId: any = null;

  productListInitialVitals: any[] = [];
  isLoadingVitals = false;

  consultationListByVisit: any[] = [];
  consultation: any = {};
  isLoadingConsultation = false;

  generalLab: any = {
    mrdt: '',
    bs: '',
    test: '',
    labReportTitle: '',
    result: '',
    notes: '',
    recommendation: '',
  };

  urinalysis: any = {
    ph: '',
    sg: '',
    protein: '',
    glucose: '',
    ketones: '',
    blood: '',
    bilirubin: '',
    urobilinogen: '',
    nitrite: '',
    leukocyteE: '',
    epithelialCells: '',
    pusCells: '',
    casts: '',
    redCells: '',
    crystals: '',
    others: '',
    color: '',
    appearance: '',
    volume: '',
  };

  cbc: any = {
    wbc: '',
    lymph: '',
    mid: '',
    gran: '',
    lymphPercent: '',
    midPercent: '',
    granPercent: '',
    hgb: '',
    rbc: '',
    hct: '',
    mcv: '',
    mch: '',
    mchc: '',
    rdwCv: '',
    rdwSd: '',
    plt: '',
    mpv: '',
    pdw: '',
    pct: '',
  };

  cbcInterpretation: any = {};
  cbcFields: CbcResultField[] = getCbcFieldsForPatient(null, null, null);
  cbcRefCohortLabel = getCbcReferenceLabel(null, null, null);

  parasitologyStool: any = {
    ova: '',
    cysts: '',
    larvae: '',
    color: '',
    consistency: '',
    blood: '',
    mucus: '',
    visibleParasites: '',
    others: '',
  };

  labReport: any = {};
  labReportId: any = null;
  labRequestId: any = null;
  isLoadingReport = false;
  isSavingReport = false;

  // Dept. Info
  deptOpenServices = true;
  deptOpenStaff = false;
  deptServices: string[] = [];
  deptStaff: LabV2DeptStaffMember[] = [];
  isLoadingDeptServices = false;
  isLoadingDeptStaff = false;

  private readonly labDeptServiceFallback = ['Hematology', 'Urinalysis', 'Biochemistry'];

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

    this.bindDepartmentRequestLiveUpdates();
    this.patientDisplay.refreshPatientDirectory().subscribe(() => {
      this.cdr.detectChanges();
    });

    if (this.canViewAnalyticsMoney) {
      this.setAnalyticsDateFilter('this_month');
    }
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
      this.loadLabRequests();
    }
    this.departmentRealtimeSub = this.departmentRealtime.refresh$.subscribe((event: DepartmentRequestRefreshEvent) => {
      if (!this.departmentRealtime.matchesKind(event, 'lab')) {
        return;
      }
      const preserveId = this.selectedLabRequest?.id;
      this.loadLabRequests(preserveId, event.type !== 'API_READY');
    });
  }

  get visibleTabs(): { id: LabV2Tab; label: string; icon: string }[] {
    const tabs: { id: LabV2Tab; label: string; icon: string }[] = [
      { id: 'patient', label: 'Patient Data', icon: 'bi-person-vcard' },
      { id: 'vitals', label: 'Vitals', icon: 'bi-heart-pulse' },
      { id: 'consultation', label: 'Consultations', icon: 'bi-journal-medical' },
      { id: 'report', label: 'Lab Report', icon: 'bi-file-earmark-medical' },
    ];
    if (this.canViewAnalyticsMoney) {
      tabs.push({ id: 'analytics', label: 'Analytics', icon: 'bi-bar-chart-line' });
    }
    tabs.push({ id: 'dept', label: 'Dept. Info', icon: 'bi-building' });
    return tabs;
  }

  setActiveTab(tab: LabV2Tab): void {
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

  get activeDeptStaff(): LabV2DeptStaffMember[] {
    return (this.deptStaff || [])
      .filter((emp) => emp.status === 'active')
      .sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0));
  }

  get inactiveDeptStaff(): LabV2DeptStaffMember[] {
    return (this.deptStaff || [])
      .filter((emp) => emp.status !== 'active')
      .sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0));
  }

  private loadDeptServices(): void {
    this.isLoadingDeptServices = true;

    this.api.getLabTestList().subscribe({
      next: (res: any) => {
        const list = Array.isArray(res) ? res : res?.data || [];
        this.deptServices = this.buildLabDeptServices(list);
        this.isLoadingDeptServices = false;
      },
      error: () => {
        this.deptServices = this.buildLabDeptServices([]);
        this.isLoadingDeptServices = false;
      },
    });
  }

  private loadDeptStaff(): void {
    this.isLoadingDeptStaff = true;

    this.api.getAllUsers().subscribe({
      next: (res: any) => {
        const users = Array.isArray(res) ? res : res?.data || [];
        this.deptStaff = this.buildLabDeptStaff(users);
        this.isLoadingDeptStaff = false;
      },
      error: () => {
        this.deptStaff = this.buildLabDeptStaff([]);
        this.isLoadingDeptStaff = false;
      },
    });
  }

  private buildLabDeptServices(catalog: any[]): string[] {
    const names = new Set<string>();

    for (const item of catalog || []) {
      const name = this.extractLabServiceName(item);
      if (name) {
        names.add(name);
      }
    }

    for (const req of this.labRequestsList || []) {
      for (const field of [req?.procedureRequestedName, req?.category]) {
        const name = (field || '').toString().trim();
        if (name) {
          names.add(name);
        }
      }
    }

    if (names.size === 0) {
      return [...this.labDeptServiceFallback];
    }

    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }

  private buildLabDeptStaff(users: any[]): LabV2DeptStaffMember[] {
    const byName = new Map<string, LabV2DeptStaffMember>();

    for (const user of users || []) {
      if (!this.matchesLabDeptKeyword(user?.role) && !this.matchesLabDeptKeyword(user?.department)) {
        continue;
      }

      const name = (user?.username || user?.name || '').toString().trim();
      if (!name) {
        continue;
      }

      byName.set(name, {
        name,
        role: (user?.role || 'Laboratory Staff').toString(),
        title: (user?.title || user?.role || 'Laboratory Staff').toString(),
        profilePic: this.normalizeImageSrc(user?.profilePic || this.defaultAvatarDataUrl),
        details: (user?.department || user?.email || user?.contact || 'Laboratory department staff').toString(),
        lastSeen: Date.now(),
        status: this.normalizeAccountStatus(user?.status),
      });
    }

    for (const staff of this.buildLabStaffFromRequests()) {
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
      name: 'Laboratory Team',
      role: 'Lab',
      title: 'Laboratory Staff',
      profilePic: this.defaultAvatarDataUrl,
      details: 'No laboratory role activity found yet',
      lastSeen: 0,
      status: 'active',
    }];
  }

  private buildLabStaffFromRequests(): LabV2DeptStaffMember[] {
    const byName = new Map<string, LabV2DeptStaffMember>();
    const nowFallback = Date.now();

    for (const req of this.labRequestsList || []) {
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
        if (!name || !role.toLowerCase().includes('lab')) {
          continue;
        }

        const row: LabV2DeptStaffMember = {
          name,
          role: role || 'Laboratory Staff',
          title: (staff.title || 'Laboratory Staff').toString(),
          profilePic: this.normalizeImageSrc(staff.profilePic || this.defaultAvatarDataUrl),
          details: `Handled ${req?.procedureRequestedName || req?.category || 'Lab'} request`,
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

  private extractLabServiceName(item: any): string {
    return (item?.procedureName || item?.title || item?.name || '').toString().trim();
  }

  private matchesLabDeptKeyword(value: any): boolean {
    const text = (value || '').toString().toLowerCase();
    return text.includes('lab');
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

  get patientFullName(): string {
    const composed = `${this.patientFirstName || ''} ${this.patientSecondName || ''}`.trim();
    if (composed) {
      return composed;
    }
    if (this.selectedLabRequest) {
      const fromDisplay = (this.patientDisplay.getDisplayName(this.selectedLabRequest) || '').trim();
      if (fromDisplay) {
        return fromDisplay;
      }
      const fromRequest = (
        this.selectedLabRequest.patientName ||
        this.selectedLabRequest.visit?.patientName ||
        this.selectedLabRequest.patient?.patientName ||
        ''
      ).toString().trim();
      if (fromRequest) {
        return fromRequest;
      }
    }
    return 'Unknown Patient';
  }

  get formTypeLabel(): string {
    switch (this.activeFormType) {
      case 'malaria':
        return 'Malaria Test';
      case 'urinalysis':
        return 'Urinalysis';
      case 'cbc':
        return 'CBC';
      case 'parasitology':
        return 'Parasitology Stool';
      default:
        return 'General Lab';
    }
  }

  get analyticsTotalRequests(): number {
    return this.analyticsScopedRequests().length;
  }

  get analyticsDoneCount(): number {
    return this.analyticsScopedRequests().filter((r: any) => this.isRequestDone(r)).length;
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

  private isRequestDone(request: any): boolean {
    const status = (request?.status || '').toString().toLowerCase();
    return status === 'done' || status === 'approved' || status === 'completed';
  }

  setAnalyticsDateFilter(id: LabV2AnalyticsDateFilter): void {
    this.analyticsDateFilter = id;
    if (id === 'all') {
      this.analyticsDateFrom = '';
      this.analyticsDateTo = '';
    } else if (id !== 'custom') {
      const range = this.computeAnalyticsDateRange(id);
      this.analyticsDateFrom = range.from;
      this.analyticsDateTo = range.to;
    }
    this.refreshAnalyticsMoneyPaid();
  }

  onAnalyticsCustomDateChange(): void {
    this.analyticsDateFilter = 'custom';
    this.refreshAnalyticsMoneyPaid();
  }

  setAnalyticsStatusFilter(status: 'all' | 'done' | 'pending'): void {
    this.analyticsStatusFilter = status;
    this.refreshAnalyticsMoneyPaid();
  }

  analyticsScopedRequests(): any[] {
    let list = this.labRequestsList || [];

    if (this.analyticsStatusFilter === 'done') {
      list = list.filter((r: any) => this.isRequestDone(r));
    } else if (this.analyticsStatusFilter === 'pending') {
      list = list.filter((r: any) => !this.isRequestDone(r));
    }

    if (this.analyticsDateFrom && this.analyticsDateTo) {
      const from = this.toDateOnly(this.analyticsDateFrom);
      const to = this.toDateOnly(this.analyticsDateTo);
      if (from && to) {
        list = list.filter((r: any) => {
          const d = this.toDateOnly(r?.dateOfProcedure || r?.visitDate || r?.dateCreated);
          return !!d && d >= from && d <= to;
        });
      }
    }

    return list;
  }

  requestAmount(req: any): number {
    return Number(req?.totalAmount ?? req?.unitSellingPrice ?? 0) || 0;
  }

  refreshAnalyticsMoneyPaid(): void {
    if (!this.canViewAnalyticsMoney) {
      this.analyticsTotalMoneyPaid = 0;
      this.isLoadingAnalyticsMoney = false;
      return;
    }
    // Sum only this department's procedure request amounts (visit payments mix all departments).
    const scoped = this.analyticsScopedRequests();
    this.analyticsTotalMoneyPaid = scoped.reduce((sum, req) => sum + this.requestAmount(req), 0);
    this.isLoadingAnalyticsMoney = false;
  }

  formatMoney(n: number): string {
    const num = Number(n) || 0;
    const hasDecimals = num % 1 !== 0;
    return num.toLocaleString('en-UG', {
      minimumFractionDigits: hasDecimals ? 2 : 0,
      maximumFractionDigits: hasDecimals ? 2 : 0,
    });
  }

  private computeAnalyticsDateRange(
    filter: Exclude<LabV2AnalyticsDateFilter, 'all' | 'custom'>
  ): { from: string; to: string } {
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

    switch (filter) {
      case 'today':
        return {
          from: this.formatYyyyMmDd(todayDate),
          to: this.formatYyyyMmDd(todayDate),
        };
      case 'this_week':
        return {
          from: this.formatYyyyMmDd(startOfThisWeek),
          to: this.formatYyyyMmDd(endOfThisWeek),
        };
      case 'this_month':
        return {
          from: this.formatYyyyMmDd(startOfThisMonth),
          to: this.formatYyyyMmDd(endOfThisMonth),
        };
      case 'this_year':
        return {
          from: this.formatYyyyMmDd(startOfThisYear),
          to: this.formatYyyyMmDd(endOfThisYear),
        };
      default:
        return { from: '', to: '' };
    }
  }

  private formatYyyyMmDd(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  loadLabRequests(preserveSelectedId?: any, silent = false): void {
    if (!this.apiConfig.isReady()) {
      return;
    }
    if (this.labRequestsLoadInFlight) {
      return;
    }
    this.labRequestsLoadInFlight = true;
    if (!silent || !this.labRequestsList?.length) {
      this.isLoadingRequests = true;
    }

    this.api.getAllLabProceduresRequested().subscribe({
      next: (res: any) => {
        this.labRequestsList = res || [];
        this.isLoadingRequests = false;
        this.labRequestsLoadInFlight = false;

        this.patientDisplay.refreshPatientDirectory().subscribe(() => {
          this.patientDisplay.hydrateFromRequests(this.labRequestsList).subscribe(() => {
            if (this.selectedLabRequest) {
              this.applyPatientIdentityFromRequest(this.selectedLabRequest);
            }
            this.cdr.detectChanges();
          });
        });

        if (preserveSelectedId) {
          const found = this.labRequestsList.find((req: any) => req.id === preserveSelectedId);
          if (found) {
            this.selectedLabRequest = found;
            this.applyPatientIdentityFromRequest(found);
          }
        }
      },
      error: (error: any) => {
        this.isLoadingRequests = false;
        this.labRequestsLoadInFlight = false;
        if (!silent) {
          const msg = error?.error?.message || 'Could not load lab requests.';
          this.showStatusMessage(msg, 'error');
        }
      },
    });
  }

  getRequestPatientName(request: any): string {
    return this.patientDisplay.getDisplayName(request);
  }

  filteredLabRequestsList(): any[] {
    let filteredList = this.labRequestsList || [];

    if (this.searchText) {
      const searchLower = this.searchText.toLowerCase();
      filteredList = filteredList.filter(
        (labRequest) =>
          this.getRequestPatientName(labRequest)?.toLowerCase().includes(searchLower) ||
          (labRequest.report?.toLowerCase().includes(searchLower)) ||
          (labRequest.procedureRequestedName?.toLowerCase().includes(searchLower)) ||
          (labRequest.category?.toLowerCase().includes(searchLower)) ||
          (labRequest.dateOfProcedure?.toLowerCase().includes(searchLower))
      );
    }

    if (this.listDateFrom || this.listDateTo) {
      filteredList = filteredList.filter((labRequest) => this.matchesListDateRange(labRequest));
    } else if (this.labRequestDateFilter !== 'all') {
      filteredList = filteredList.filter((labRequest) => this.matchesLabRequestDateFilter(labRequest));
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

  setLabRequestDateFilter(filter: LabV2DateFilter): void {
    this.labRequestDateFilter = filter;
    this.listDateFrom = '';
    this.listDateTo = '';
  }

  onListDateRangeChange(): void {
    if (this.listDateFrom || this.listDateTo) {
      this.labRequestDateFilter = 'all';
    }
  }

  private matchesListDateRange(labRequest: any): boolean {
    const rawDate = labRequest?.dateOfProcedure || labRequest?.visitDate || labRequest?.dateCreated;
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

  private matchesLabRequestDateFilter(labRequest: any): boolean {
    const rawDate = labRequest?.dateOfProcedure || labRequest?.visitDate || labRequest?.dateCreated;
    const d = this.toDateOnly(rawDate);
    if (!d) {
      return false;
    }

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

    switch (this.labRequestDateFilter) {
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
    if (!value) {
      return null;
    }
    const parsed = new Date(value);
    if (isNaN(parsed.getTime())) {
      return null;
    }
    return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  }

  detectFormType(request: any): LabV2FormType {
    if (request?.category === 'malaria test') {
      return 'malaria';
    }

    const requestName = (request?.procedureRequestedName || '').toString().toLowerCase();
    if (requestName === 'urinalysis') {
      return 'urinalysis';
    }
    if (requestName === 'cbc' || requestName.includes('cbc')) {
      return 'cbc';
    }
    if (
      requestName === 'parasitology stool' ||
      requestName === 'parasitologystool' ||
      requestName.includes('parasitology stool')
    ) {
      return 'parasitology';
    }
    return 'general';
  }

  selectLabRequest(labRequest: any): void {
    this.selectedLabRequest = labRequest;
    this.activeFormType = this.detectFormType(labRequest);

    if (labRequest) {
      this.applyPatientIdentityFromRequest(labRequest);
      this.refreshSelectedPatientFromEntity(labRequest);
    }

    this.loadLabReportForRequest(labRequest);
    this.loadVisitClinicalDataFromLabRequest(labRequest);
  }

  private applyPatientIdentityFromRequest(labRequest: any): void {
    if (!labRequest) {
      return;
    }

    const patient = labRequest.visit?.patient || labRequest.patient || {};
    const patientId = this.patientDisplay.extractPatientId(labRequest);
    const cached = patientId ? this.patientDisplay.getCachedPatient(patientId) : null;

    const first =
      cached?.patientFirstName ||
      labRequest.patientFirstName ||
      patient.patientFirstName ||
      '';
    const second =
      cached?.patientSecondName ||
      labRequest.patientSecondName ||
      patient.patientSecondName ||
      '';

    if (first || second) {
      this.patientFirstName = first || '';
      this.patientSecondName = second || '';
    } else {
      const full =
        (this.patientDisplay.getDisplayName(labRequest) || '').trim() ||
        (labRequest.patientName || patient.patientName || labRequest.visit?.patientName || '').toString().trim();
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
      // applyPatientProfileFromEntity already refreshes CBC refs
      return;
    }

    const newProfilePic = this.normalizeImageSrc(
      patient.patientProfilePic || labRequest.patientProfilePic || this.defaultAvatarDataUrl
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

    this.patientFileNo =
      patient.patientFileNo ||
      patient.patientFileNumber ||
      labRequest.patientFileNo ||
      labRequest.patientFileNumber ||
      '';

    this.patientId = patientId || patient.id || patient.patientId || labRequest.patientId || null;
    this.patientAge = labRequest.patientAge || patient.patientAge || '';
    this.patientDateOfBirth = labRequest.patientDateOfBirth || patient.patientDateOfBirth || '';
    this.patientContact =
      patient.patientContact ||
      labRequest.patientContact ||
      patient.phone ||
      labRequest.patientPhone ||
      '';
    this.patientGroupName =
      patient.patientGroupName ||
      patient.patientGroup?.groupNameShortForm ||
      patient.patientGroup?.groupName ||
      labRequest.patientGroupName ||
      '';
    this.patientAddress = labRequest.patientAddress || patient.patientAddress || '';
    this.patientGender =
      labRequest.patientGender || patient.patientGender || labRequest.gender || '';
    this.patientOccupation = labRequest.patientOccupation || patient.patientOccupation || '';
    this.nextOfKinName = labRequest.nextOfKinName || patient.nextOfKinName || '';
    this.nextOfKinContact = labRequest.nextOfKinContact || patient.nextOfKinContact || '';
    this.nextOfKinAddress = labRequest.nextOfKinAddress || patient.nextOfKinAddress || '';
    this.relationship = labRequest.relationship || patient.relationship || '';
    this.diagnosis = labRequest.diagnosis || patient.diagnosis || '';
    this.refreshCbcReferenceRanges();
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
    this.refreshCbcReferenceRanges();

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

  private refreshSelectedPatientFromEntity(labRequest: any): void {
    const patientId = this.patientDisplay.extractPatientId(labRequest);
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
    if (!raw) {
      return this.defaultAvatarDataUrl;
    }
    const lower = raw.toLowerCase();
    const isAllowed =
      lower.startsWith('http://') ||
      lower.startsWith('https://') ||
      lower.startsWith('data:image/') ||
      lower.startsWith('assets/');
    if (!isAllowed || raw.startsWith('<')) {
      return this.defaultAvatarDataUrl;
    }
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

  private loadVisitClinicalDataFromLabRequest(labRequest: any): void {
    const visitObj = labRequest?.visit;
    const visitId = visitObj?.id ?? labRequest?.visitId ?? labRequest?.visit?.visitId;

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
      },
    });

    this.loadConsultation(visitId);
  }

  private loadConsultation(visitId: any): void {
    this.isLoadingConsultation = true;
    this.api.getConsultationsByVisit(visitId).subscribe({
      next: (res: any) => {
        const consultations = Array.isArray(res) ? res : res ? [res] : [];
        this.consultationListByVisit = consultations;
        this.consultation = this.toPlainTextConsultation(consultations[0] || {});
        this.isLoadingConsultation = false;
      },
      error: () => {
        this.isLoadingConsultation = false;
      },
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
    if (!ds && !ts) {
      return '—';
    }
    if (ds && ts) {
      return `${ds} · ${ts}`;
    }
    return ds || ts;
  }

  formatPulsePressureForVital(vital: any): string {
    return formatPulsePressureDisplay(vital);
  }

  updateAllCbcInterpretations(): void {
    const nextInterp: any = {};
    for (const field of this.cbcFields) {
      nextInterp[field.key] = this.buildCbcInterpretation(this.cbc[field.key], field.ref);
    }
    this.cbcInterpretation = nextInterp;
  }

  /** Refresh CBC ref ranges from the selected patient's age + gender. */
  private refreshCbcReferenceRanges(): void {
    this.cbcFields = getCbcFieldsForPatient(
      this.patientAge,
      this.patientDateOfBirth,
      this.patientGender
    );
    this.cbcRefCohortLabel = getCbcReferenceLabel(
      this.patientAge,
      this.patientDateOfBirth,
      this.patientGender
    );
    this.updateAllCbcInterpretations();
  }

  private parseCbcRange(ref: string): { low: number; high: number } | null {
    const match = String(ref).match(/(-?\d+(?:\.\d+)?)\s*-\s*(-?\d+(?:\.\d+)?)/);
    if (!match) {
      return null;
    }
    const low = Number(match[1]);
    const high = Number(match[2]);
    if (Number.isNaN(low) || Number.isNaN(high)) {
      return null;
    }
    return { low, high };
  }

  private parseCbcResultValue(value: any): number | null {
    if (value == null || value === '') {
      return null;
    }
    const numeric = Number(String(value).replace(/,/g, '').trim());
    return Number.isNaN(numeric) ? null : numeric;
  }

  private buildCbcInterpretation(resultValue: any, refRange: string): string {
    const parsedValue = this.parseCbcResultValue(resultValue);
    const parsedRange = this.parseCbcRange(refRange);
    if (parsedValue == null || !parsedRange) {
      return '';
    }
    if (parsedValue < parsedRange.low) {
      return 'Low';
    }
    if (parsedValue > parsedRange.high) {
      return 'High';
    }
    return 'Normal';
  }

  loadLabReportForRequest(labRequest: any): void {
    if (!labRequest?.id) {
      return;
    }

    this.isLoadingReport = true;
    this.labRequestId = labRequest.id;
    this.resetQuillEditors();

    switch (this.activeFormType) {
      case 'malaria':
        this.loadMalariaReport(labRequest);
        break;
      case 'urinalysis':
        this.loadUrinalysisReport(labRequest);
        break;
      case 'cbc':
        this.loadCbcReport(labRequest);
        break;
      case 'parasitology':
        this.loadParasitologyReport(labRequest);
        break;
      default:
        this.loadGeneralLabReport(labRequest);
        break;
    }
  }

  private finishReportLoad(): void {
    this.isLoadingReport = false;
    this.cdr.detectChanges();
    if (this.activeTab === 'report') {
      this.scheduleQuillInit();
    }
  }

  private loadMalariaReport(labRequest: any): void {
    this.api.getLabReportByRequestId(labRequest.id).subscribe({
      next: (res: any) => {
        const report = res?.data ?? res ?? {};
        this.applyMalariaReport(report);
        this.labReportId = report.id || null;
        this.finishReportLoad();
      },
      error: (error: any) => {
        this.isLoadingReport = false;
        const msg = error?.error?.message || error?.error?.error || 'Could not load the malaria lab report.';
        this.showStatusMessage(msg, 'error');
      },
    });
  }

  private applyMalariaReport(report: any): void {
    this.labReport = report || {};
    this.generalLab.mrdt = report.mrdt || '';
    this.generalLab.bs = report.bs || '';
    this.generalLab.notes = report.notes || '';
    this.generalLab.test = report.test || '';
    this.generalLab.labReportTitle = report.labReportTitle || '';
    this.generalLab.recommendation = report.recommendation || '';
    this.generalLab.result = report.result || report.report || report.findings || '';
  }

  private loadUrinalysisReport(labRequest: any): void {
    this.api.getUrinalysisReportByRequestId(labRequest.id).subscribe({
      next: (res: any) => {
        const report = res?.data ?? res ?? {};
        if (!report?.id || (typeof report?.message === 'string' && report.message.toLowerCase().includes('not found'))) {
          this.createUrinalysisReport(labRequest);
          return;
        }
        this.applyUrinalysisReport(report, res);
        this.labReportId = report.id || null;
        this.finishReportLoad();
      },
      error: () => {
        this.createUrinalysisReport(labRequest);
      },
    });
  }

  private applyUrinalysisReport(report: any, res?: any): void {
    this.labReport = report || {};
    this.urinalysis = {
      ph: report.ph || '',
      sg: report.sg || '',
      protein: report.protein || '',
      glucose: report.glucose || '',
      ketones: report.ketones || '',
      blood: report.blood || '',
      bilirubin: report.bilirubin || '',
      urobilinogen: report.urobilinogen || '',
      nitrite: report.nitrite || '',
      leukocyteE: report.leukocyteE || report.leukocyte || '',
      epithelialCells: report.epithelialCells || '',
      pusCells: report.pusCellsWbcs || res?.data?.pusCellsWbcs || res?.pusCellsWbcs || report.pusCells || '',
      casts: report.casts || '',
      redCells: report.redCells || '',
      crystals: report.crystals || '',
      others: report.others || report.microscopicOthers || '',
      color: report.color || '',
      appearance: report.appearance || '',
      volume: report.volume || '',
    };
    this.generalLab.labReportTitle = report.labReportTitle || '';
  }

  private createUrinalysisReport(labRequest: any): void {
    const fallbackPayload = {
      doneBy: this.userName || '',
      ph: '',
      sg: '',
      protein: '',
      glucose: '',
      ketones: '',
      blood: '',
      bilirubin: '',
      urobilinogen: '',
      nitrite: '',
      leukocyteE: '',
      epithelialCells: '',
      pusCells: '',
      casts: '',
      redCells: '',
      crystals: '',
      others: '',
      color: '',
      appearance: '',
      volume: '',
    };

    const reloadCreated = () => {
      this.api.getUrinalysisReportByRequestId(labRequest.id).subscribe({
        next: (res: any) => {
          const report = res?.data ?? res ?? {};
          this.applyUrinalysisReport(report, res);
          this.labReportId = report.id || null;
          this.finishReportLoad();
        },
        error: () => {
          this.isLoadingReport = false;
          this.showStatusMessage('Could not create urinalysis report.', 'error');
        },
      });
    };

    this.api.createUrinalysisReportByRequest(labRequest).subscribe({
      next: () => reloadCreated(),
      error: () => {
        this.api.createUrinalysisReportByRequestId(labRequest.id, fallbackPayload).subscribe({
          next: () => reloadCreated(),
          error: () => {
            this.isLoadingReport = false;
            this.showStatusMessage('Could not create urinalysis report.', 'error');
          },
        });
      },
    });
  }

  private loadCbcReport(labRequest: any): void {
    this.api.getCbcReportByRequestId(labRequest.id).subscribe({
      next: (res: any) => {
        const report = res?.data ?? res ?? {};
        this.applyCbcReport(report);
        this.labReportId = report.id || null;
        this.finishReportLoad();
      },
      error: (error: any) => {
        this.isLoadingReport = false;
        const msg = error?.error?.message || error?.error?.error || 'Could not load the CBC report.';
        this.showStatusMessage(msg, 'error');
      },
    });
  }

  private applyCbcReport(report: any): void {
    this.labReport = report || {};
    this.cbc = {
      wbc: report.wbc || '',
      lymph: report.lymph || '',
      mid: report.mid || '',
      gran: report.gran || '',
      lymphPercent: report.lymphPercent || report.lymphPct || '',
      midPercent: report.midPercent || report.midPct || '',
      granPercent: report.granPercent || report.granPct || '',
      hgb: report.hgb || '',
      rbc: report.rbc || '',
      hct: report.hct || '',
      mcv: report.mcv || '',
      mch: report.mch || '',
      mchc: report.mchc || '',
      rdwCv: report.rdwCv || report.rdwCV || '',
      rdwSd: report.rdwSd || report.rdwSD || '',
      plt: report.plt || '',
      mpv: report.mpv || '',
      pdw: report.pdw || '',
      pct: report.pct || '',
    };
    this.generalLab.labReportTitle = report.labReportTitle || '';
    this.refreshCbcReferenceRanges();
  }

  private loadParasitologyReport(labRequest: any): void {
    this.api.getParasitologyStoolReportByRequestId(labRequest.id).subscribe({
      next: (res: any) => {
        const report = res?.data ?? res ?? {};
        this.applyParasitologyReport(report);
        this.labReportId = report.id || null;
        this.finishReportLoad();
      },
      error: (error: any) => {
        this.isLoadingReport = false;
        const msg = error?.error?.message || error?.error?.error || 'Could not load the parasitology report.';
        this.showStatusMessage(msg, 'error');
      },
    });
  }

  private applyParasitologyReport(report: any): void {
    this.labReport = report || {};
    this.parasitologyStool = {
      ova: report.ova || '',
      cysts: report.cysts || '',
      larvae: report.larvae || '',
      color: report.color || '',
      consistency: report.consistency || '',
      blood: report.blood || '',
      mucus: report.mucus || '',
      visibleParasites: report.visibleParasites || '',
      others: report.others || '',
    };
    this.generalLab.labReportTitle = report.labReportTitle || '';
  }

  private loadGeneralLabReport(labRequest: any): void {
    this.api.getGeneralLabReportByRequestId(labRequest.id).subscribe({
      next: (res: any) => {
        const report = res?.data ?? res ?? {};
        if (!report?.id || (typeof report?.message === 'string' && report.message.toLowerCase().includes('not found'))) {
          this.createGeneralLabReport(labRequest);
          return;
        }
        this.applyGeneralLabReport(report);
        this.labReportId = report.id || null;
        this.finishReportLoad();
      },
      error: () => {
        this.createGeneralLabReport(labRequest);
      },
    });
  }

  private applyGeneralLabReport(report: any): void {
    this.labReport = report || {};
    this.generalLab.result = report.result || report.report || report.findings || '';
    this.generalLab.notes = report.notes || '';
    this.generalLab.recommendation = report.recommendation || '';
    this.generalLab.labReportTitle = report.labReportTitle || '';
    this.generalLab.test = report.test || '';
  }

  private createGeneralLabReport(labRequest: any): void {
    const fallbackPayload = {
      doneBy: this.userName || '',
      recommendation: '',
      result: '',
      notes: '',
      labReportTitle: '',
      test: '',
    };

    this.api.createGeneralLabReportByRequestId(labRequest.id, fallbackPayload).subscribe({
      next: (res: any) => {
        const report = res?.data ?? res ?? {};
        this.applyGeneralLabReport(report);
        this.labReportId = report.id || null;
        this.finishReportLoad();
      },
      error: () => {
        this.isLoadingReport = false;
        this.showStatusMessage('Could not create general lab report.', 'error');
      },
    });
  }

  saveLabReport(): void {
    if (!this.userName) {
      this.showStatusMessage("Missing lab technician's initials.", 'error');
      return;
    }

    this.syncModelFromQuill();

    if (!this.labReportId) {
      if (this.activeFormType === 'general') {
        this.createGeneralLabReportThenSave();
        return;
      }
      if (this.activeFormType === 'urinalysis') {
        this.createUrinalysisReportThenSave();
        return;
      }
      this.showStatusMessage('Missing lab report Id.', 'error');
      return;
    }

    this.performLabReportUpdate();
  }

  private createGeneralLabReportThenSave(): void {
    if (!this.selectedLabRequest?.id) {
      return;
    }
    this.isSavingReport = true;
    const fallbackPayload = {
      doneBy: this.userName || '',
      recommendation: this.generalLab.recommendation || '',
      result: this.generalLab.result || '',
      notes: this.generalLab.notes || '',
      labReportTitle: this.generalLab.labReportTitle || '',
      test: this.generalLab.test || '',
    };

    this.api.createGeneralLabReportByRequestId(this.selectedLabRequest.id, fallbackPayload).subscribe({
      next: (res: any) => {
        const report = res?.data ?? res ?? {};
        this.labReportId = report.id || null;
        if (this.labReportId) {
          this.performLabReportUpdate();
        } else {
          this.isSavingReport = false;
          this.showStatusMessage('Could not create general lab report.', 'error');
        }
      },
      error: (error: any) => {
        this.isSavingReport = false;
        const msg = error?.error?.message || error?.error?.error || 'Could not create general lab report.';
        this.showStatusMessage(msg, 'error');
      },
    });
  }

  private createUrinalysisReportThenSave(): void {
    if (!this.selectedLabRequest?.id) {
      return;
    }
    this.isSavingReport = true;
    this.api.createUrinalysisReportByRequestId(this.selectedLabRequest.id, {
      doneBy: this.userName || '',
      ...this.buildUrinalysisPayload(),
    }).subscribe({
      next: (res: any) => {
        const report = res?.data ?? res ?? {};
        this.labReportId = report.id || null;
        if (this.labReportId) {
          this.performLabReportUpdate();
        } else {
          this.isSavingReport = false;
          this.showStatusMessage('Could not create urinalysis report.', 'error');
        }
      },
      error: (error: any) => {
        this.isSavingReport = false;
        const msg = error?.error?.message || error?.error?.error || 'Could not create urinalysis report.';
        this.showStatusMessage(msg, 'error');
      },
    });
  }

  private buildUrinalysisPayload(): any {
    return {
      ph: this.urinalysis.ph,
      sg: this.urinalysis.sg,
      protein: this.urinalysis.protein,
      glucose: this.urinalysis.glucose,
      ketones: this.urinalysis.ketones,
      blood: this.urinalysis.blood,
      bilirubin: this.urinalysis.bilirubin,
      urobilinogen: this.urinalysis.urobilinogen,
      nitrite: this.urinalysis.nitrite,
      leukocyteE: this.urinalysis.leukocyteE,
      epithelialCells: this.urinalysis.epithelialCells,
      pusCellsWbcs: this.urinalysis.pusCells,
      casts: this.urinalysis.casts,
      redCells: this.urinalysis.redCells,
      crystals: this.urinalysis.crystals,
      others: this.urinalysis.others,
      color: this.urinalysis.color,
      appearance: this.urinalysis.appearance,
      volume: this.urinalysis.volume,
      labReportTitle: this.generalLab.labReportTitle,
      doneBy: this.userName,
    };
  }

  private buildCbcPayload(): any {
    this.updateAllCbcInterpretations();
    const interpretations: Record<string, string> = {};
    for (const field of this.cbcFields) {
      const value = this.cbcInterpretation[field.key];
      interpretations[field.key] = value != null && value !== '' ? String(value) : '';
    }

    return {
      wbc: this.cbc.wbc,
      lymph: this.cbc.lymph,
      mid: this.cbc.mid,
      gran: this.cbc.gran,
      lymphPercent: this.cbc.lymphPercent,
      midPercent: this.cbc.midPercent,
      granPercent: this.cbc.granPercent,
      hgb: this.cbc.hgb,
      rbc: this.cbc.rbc,
      hct: this.cbc.hct,
      mcv: this.cbc.mcv,
      mch: this.cbc.mch,
      mchc: this.cbc.mchc,
      rdwCv: this.cbc.rdwCv,
      rdwSd: this.cbc.rdwSd,
      plt: this.cbc.plt,
      mpv: this.cbc.mpv,
      pdw: this.cbc.pdw,
      pct: this.cbc.pct,
      labReportTitle: this.generalLab.labReportTitle,
      interpretations,
      doneBy: this.userName,
    };
  }

  private buildParasitologyPayload(): any {
    return {
      ova: this.parasitologyStool.ova,
      cysts: this.parasitologyStool.cysts,
      larvae: this.parasitologyStool.larvae,
      color: this.parasitologyStool.color,
      consistency: this.parasitologyStool.consistency,
      blood: this.parasitologyStool.blood,
      mucus: this.parasitologyStool.mucus,
      visibleParasites: this.parasitologyStool.visibleParasites,
      others: this.parasitologyStool.others,
      labReportTitle: this.generalLab.labReportTitle,
      doneBy: this.userName,
    };
  }

  private buildMalariaPayload(): any {
    return {
      mrdt: this.generalLab.mrdt,
      bs: this.generalLab.bs,
      test: this.generalLab.test,
      labReportTitle: this.generalLab.labReportTitle,
      result: this.generalLab.result,
      notes: this.generalLab.notes,
      recommendation: this.generalLab.recommendation,
      doneBy: this.userName,
    };
  }

  private buildGeneralPayload(): any {
    return {
      test: this.generalLab.test,
      labReportTitle: this.generalLab.labReportTitle,
      result: this.generalLab.result,
      notes: this.generalLab.notes,
      recommendation: this.generalLab.recommendation,
      doneBy: this.userName,
    };
  }

  private performLabReportUpdate(): void {
    let updateRequest;

    switch (this.activeFormType) {
      case 'malaria':
        updateRequest = this.api.updateLabReport(this.labReportId, this.buildMalariaPayload());
        break;
      case 'urinalysis':
        updateRequest = this.api.updateUrinalysisReport(this.labReportId, this.buildUrinalysisPayload());
        break;
      case 'cbc':
        updateRequest = this.api.updateCbcReport(this.labReportId, this.buildCbcPayload());
        break;
      case 'parasitology':
        updateRequest = this.api.updateParasitologyStoolReport(this.labReportId, this.buildParasitologyPayload());
        break;
      default:
        updateRequest = this.api.updateGeneralLabReport(this.labReportId, this.buildGeneralPayload());
        break;
    }

    this.isSavingReport = true;
    updateRequest.subscribe({
      next: (response: any) => {
        this.isSavingReport = false;
        this.showStatusMessage(response?.message || 'Lab report saved successfully.', 'success');
        const preservedId = this.selectedLabRequest?.id;
        this.loadLabReportForRequest(this.selectedLabRequest);
        this.loadLabRequests(preservedId);
      },
      error: (error: any) => {
        this.isSavingReport = false;
        const msg = error?.error?.message || error?.error?.error || 'An unexpected error occurred. Please try again.';
        this.showStatusMessage(msg, 'error');
      },
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
      if (this.activeFormType !== 'general' && this.activeFormType !== 'malaria') {
        return;
      }
      const QuillConstructor =
        typeof Quill !== 'undefined' ? Quill : typeof window !== 'undefined' ? (window as any).Quill : null;
      if (!QuillConstructor || !this.resultEditor?.nativeElement) {
        if (retryCount < 12) {
          this.scheduleQuillInit(retryCount + 1);
        }
        return;
      }
      this.initializeQuillEditors(QuillConstructor);
    }, retryCount === 0 ? 0 : 80);
  }

  private resetQuillEditors(): void {
    this.quillResultEditor = null;
    this.quillRecommendationEditor = null;
    this.quillResultLoaded = false;
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
    if (this.quillResultLoaded || !this.resultEditor?.nativeElement) {
      return;
    }

    try {
      this.quillResultEditor = new QuillConstructor(this.resultEditor.nativeElement, {
        theme: 'snow',
        modules: { toolbar: this.quillToolbar() },
        placeholder: 'Enter result...',
      });
      if (this.generalLab.result) {
        this.quillResultEditor.root.innerHTML = this.generalLab.result;
      }
      this.quillResultEditor.on('text-change', () => {
        this.generalLab.result = this.quillResultEditor.root.innerHTML;
      });
      this.quillResultLoaded = true;

      if (this.recommendationEditor?.nativeElement) {
        this.quillRecommendationEditor = new QuillConstructor(this.recommendationEditor.nativeElement, {
          theme: 'snow',
          modules: { toolbar: this.quillToolbar() },
          placeholder: 'Enter recommendations...',
        });
        if (this.generalLab.recommendation) {
          this.quillRecommendationEditor.root.innerHTML = this.generalLab.recommendation;
        }
        this.quillRecommendationEditor.on('text-change', () => {
          this.generalLab.recommendation = this.quillRecommendationEditor.root.innerHTML;
        });
        this.quillRecommendationLoaded = true;
      }

      this.cdr.detectChanges();
    } catch (error) {
      console.error('Lab V2 Quill init failed', error);
      this.resetQuillEditors();
    }
  }

  private syncModelFromQuill(): void {
    if (this.quillResultEditor && this.quillResultLoaded) {
      this.generalLab.result = this.quillResultEditor.root.innerHTML;
    }
    if (this.quillRecommendationEditor && this.quillRecommendationLoaded) {
      this.generalLab.recommendation = this.quillRecommendationEditor.root.innerHTML;
    }
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
