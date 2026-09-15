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

/**
 * Dental V2 — general lab report only (V1).
 * Classic dental branches urinalysis/CBC/MRDT/parasitology by procedure name;
 * this page always uses getGeneralLabReportByRequestId / updateGeneralLabReport.
 */
type DentalV2Tab = 'patient' | 'vitals' | 'consultation' | 'report' | 'analytics' | 'dept';

type DentalV2DateFilter =
  | 'all'
  | 'today'
  | 'last_week'
  | 'this_week'
  | 'last_month'
  | 'this_month'
  | 'this_year';

type DentalV2AnalyticsDateFilter =
  | 'all'
  | 'today'
  | 'this_week'
  | 'this_month'
  | 'this_year'
  | 'custom';

type DentalV2DeptStaffMember = {
  name: string;
  role: string;
  title: string;
  profilePic: string;
  details: string;
  lastSeen: number;
  status: 'active' | 'inactive';
};

@Component({
  selector: 'app-dental-v2',
  templateUrl: './dental-v2.component.html',
  styleUrls: ['./dental-v2.component.css']
})
export class DentalV2Component implements OnInit, AfterViewInit, OnDestroy {
  private readonly defaultAvatarDataUrl =
    'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22120%22 height=%22120%22 viewBox=%220 0 120 120%22%3E%3Crect width=%22120%22 height=%22120%22 fill=%22%23e5e7eb%22/%3E%3Ccircle cx=%2260%22 cy=%2245%22 r=%2222%22 fill=%22%239ca3af%22/%3E%3Crect x=%2230%22 y=%2274%22 width=%2260%22 height=%2234%22 rx=%2217%22 fill=%22%239ca3af%22/%3E%3C/svg%3E';

  private statusTimer: any = null;
  private departmentRealtimeSub?: Subscription;
  private dentalRequestsLoadInFlight = false;
  private quillInitTimer: any = null;

  @ViewChild('resultEditor') resultEditor?: ElementRef<HTMLElement>;
  @ViewChild('recommendationEditor') recommendationEditor?: ElementRef<HTMLElement>;

  quillResultEditor: any = null;
  quillRecommendationEditor: any = null;
  quillResultLoaded = false;
  quillRecommendationLoaded = false;

  private readonly allTabs: { id: DentalV2Tab; label: string; icon: string }[] = [
    { id: 'patient', label: 'Patient Data', icon: 'bi-person-vcard' },
    { id: 'vitals', label: 'Vitals', icon: 'bi-heart-pulse' },
    { id: 'consultation', label: 'Consultations', icon: 'bi-journal-medical' },
    { id: 'report', label: 'Dental Report', icon: 'bi-file-earmark-medical' },
    { id: 'analytics', label: 'Analytics', icon: 'bi-bar-chart-line' },
    { id: 'dept', label: 'Dept. Info', icon: 'bi-building' },
  ];

  readonly dateFilters: { id: DentalV2DateFilter; label: string }[] = [
    { id: 'today', label: 'Today' },
    { id: 'last_week', label: 'Last Week' },
    { id: 'this_week', label: 'This Week' },
    { id: 'last_month', label: 'Last Month' },
    { id: 'this_month', label: 'This Month' },
    { id: 'this_year', label: 'This Year' },
  ];

  readonly analyticsDateFilters: { id: DentalV2AnalyticsDateFilter; label: string }[] = [
    { id: 'today', label: 'Today' },
    { id: 'this_week', label: 'This Week' },
    { id: 'this_month', label: 'This Month' },
    { id: 'this_year', label: 'This Year' },
  ];

  activeTab: DentalV2Tab = 'report';

  userName: any;
  mdUser = false;
  canViewAnalyticsMoney = false;

  dentalRequestsList: any[] = [];
  selectedDentalRequest: any = null;
  isLoadingRequests = false;
  searchText = '';
  dentalRequestDateFilter: DentalV2DateFilter = 'all';
  listDateFrom = '';
  listDateTo = '';
  showRequestFilters = false;
  private readonly requestFiltersStorageKey = 'dv2-show-request-filters';

  analyticsDateFilter: DentalV2AnalyticsDateFilter = 'this_month';
  analyticsDateFrom = '';
  analyticsDateTo = '';
  analyticsStatusFilter: 'all' | 'done' | 'pending' = 'all';
  analyticsTotalMoneyPaid = 0;
  isLoadingAnalyticsMoney = false;

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

  dentalReportForm: any = {
    labReportTitle: '',
    result: '',
    notes: '',
    recommendation: '',
  };
  dentalReport: any = {};
  dentalReportId: any = null;
  dentalRequestId: any = null;
  isLoadingReport = false;
  isSavingReport = false;
  isExportingReport = false;

  deptOpenServices = true;
  deptOpenStaff = false;
  deptServices: string[] = [];
  deptStaff: DentalV2DeptStaffMember[] = [];
  isLoadingDeptServices = false;
  isLoadingDeptStaff = false;
  private deptInfoLoaded = false;

  private readonly dentalDeptServiceFallback = [
    'Dental Consultation',
    'Tooth Extraction',
    'Scaling & Polishing',
  ];

  private readonly dentalDeptRoleKeywords = ['dental', 'dentist', 'oral'];

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
      this.loadDentalRequests();
    }
    this.departmentRealtimeSub = this.departmentRealtime.refresh$.subscribe((event: DepartmentRequestRefreshEvent) => {
      if (!this.departmentRealtime.matchesKind(event, 'dental')) {
        return;
      }
      const preserveId = this.selectedDentalRequest?.id;
      this.loadDentalRequests(preserveId, event.type !== 'API_READY');
    });
  }

  get visibleTabs(): { id: DentalV2Tab; label: string; icon: string }[] {
    return this.allTabs.filter((tab) => tab.id !== 'analytics' || this.canViewAnalyticsMoney);
  }

  setActiveTab(tab: DentalV2Tab): void {
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
    if (this.deptInfoLoaded) {
      return;
    }
    this.deptInfoLoaded = true;
    this.loadDeptServices();
    this.loadDeptStaff();
  }

  get activeDeptStaff(): DentalV2DeptStaffMember[] {
    return (this.deptStaff || [])
      .filter((emp) => emp.status === 'active')
      .sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0));
  }

  get inactiveDeptStaff(): DentalV2DeptStaffMember[] {
    return (this.deptStaff || [])
      .filter((emp) => emp.status !== 'active')
      .sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0));
  }

  private loadDeptServices(): void {
    this.isLoadingDeptServices = true;

    this.api.getAllProcedureList().subscribe({
      next: (res: any) => {
        const list = Array.isArray(res) ? res : res?.data || [];
        this.deptServices = this.buildDentalDeptServices(list);
        this.isLoadingDeptServices = false;
      },
      error: () => {
        this.deptServices = this.buildDentalDeptServices([]);
        this.isLoadingDeptServices = false;
      },
    });
  }

  private loadDeptStaff(): void {
    this.isLoadingDeptStaff = true;

    this.api.getAllUsers().subscribe({
      next: (res: any) => {
        const users = Array.isArray(res) ? res : res?.data || [];
        this.deptStaff = this.buildDentalDeptStaff(users);
        this.isLoadingDeptStaff = false;
      },
      error: () => {
        this.deptStaff = this.buildDentalDeptStaff([]);
        this.isLoadingDeptStaff = false;
      },
    });
  }

  private buildDentalDeptServices(catalog: any[]): string[] {
    const names = new Set<string>();

    for (const item of catalog || []) {
      if (!this.isDentalCatalogItem(item)) {
        continue;
      }
      const name = this.extractProcedureServiceName(item);
      if (name) {
        names.add(name);
      }
    }

    for (const req of this.dentalRequestsList || []) {
      for (const field of [req?.procedureRequestedName, req?.exam]) {
        const name = (field || '').toString().trim();
        if (name) {
          names.add(name);
        }
      }
    }

    if (names.size === 0) {
      return [...this.dentalDeptServiceFallback];
    }

    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }

  private buildDentalDeptStaff(users: any[]): DentalV2DeptStaffMember[] {
    const byName = new Map<string, DentalV2DeptStaffMember>();

    for (const user of users || []) {
      if (!this.matchesDentalDeptKeyword(user?.role) && !this.matchesDentalDeptKeyword(user?.department)) {
        continue;
      }

      const name = (user?.username || user?.name || '').toString().trim();
      if (!name) {
        continue;
      }

      byName.set(name, {
        name,
        role: (user?.role || 'Dental Staff').toString(),
        title: (user?.title || user?.role || 'Dental Staff').toString(),
        profilePic: this.normalizeImageSrc(user?.profilePic || this.defaultAvatarDataUrl),
        details: (user?.department || user?.email || user?.contact || 'Dental department staff').toString(),
        lastSeen: Date.now(),
        status: this.normalizeAccountStatus(user?.status),
      });
    }

    for (const staff of this.buildDentalStaffFromRequests()) {
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
      name: 'Dental Team',
      role: 'Dental',
      title: 'Dental Staff',
      profilePic: this.defaultAvatarDataUrl,
      details: 'No dental role activity found yet',
      lastSeen: 0,
      status: 'active',
    }];
  }

  private buildDentalStaffFromRequests(): DentalV2DeptStaffMember[] {
    const byName = new Map<string, DentalV2DeptStaffMember>();
    const nowFallback = Date.now();

    for (const req of this.dentalRequestsList || []) {
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
        if (!name || !this.matchesDentalDeptKeyword(role)) {
          continue;
        }

        const row: DentalV2DeptStaffMember = {
          name,
          role: role || 'Dental Staff',
          title: (staff.title || 'Dental Staff').toString(),
          profilePic: this.normalizeImageSrc(staff.profilePic || this.defaultAvatarDataUrl),
          details: `Handled ${req?.procedureRequestedName || req?.exam || 'Dental'} request`,
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

  private isDentalCatalogItem(item: any): boolean {
    const fields = [
      item?.parentCategory,
      item?.parentCategoryName,
      item?.category,
      item?.categoryName,
      item?.parentPage,
      item?.procedureCategory,
      item?.parentProcedureCategory,
    ];
    return fields.some((field) => this.matchesDentalDeptKeyword(field));
  }

  private extractProcedureServiceName(item: any): string {
    return (item?.procedureName || item?.title || item?.name || '').toString().trim();
  }

  private matchesDentalDeptKeyword(value: any): boolean {
    const text = (value || '').toString().toLowerCase();
    if (!text) {
      return false;
    }
    return this.dentalDeptRoleKeywords.some((keyword) => text.includes(keyword));
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
    if (this.selectedDentalRequest) {
      const fromDisplay = (this.patientDisplay.getDisplayName(this.selectedDentalRequest) || '').trim();
      if (fromDisplay) {
        return fromDisplay;
      }
      const fromRequest = (
        this.selectedDentalRequest.patientName ||
        this.selectedDentalRequest.visit?.patientName ||
        this.selectedDentalRequest.patient?.patientName ||
        ''
      ).toString().trim();
      if (fromRequest) {
        return fromRequest;
      }
    }
    return 'Unknown Patient';
  }

  loadDentalRequests(preserveSelectedId?: any, silent = false): void {
    if (!this.apiConfig.isReady()) {
      return;
    }
    if (this.dentalRequestsLoadInFlight) {
      return;
    }
    this.dentalRequestsLoadInFlight = true;
    if (!silent || !this.dentalRequestsList?.length) {
      this.isLoadingRequests = true;
    }

    this.api.getAllDentalProceduresRequested().subscribe({
      next: (res: any) => {
        this.dentalRequestsList = res || [];
        this.isLoadingRequests = false;
        this.dentalRequestsLoadInFlight = false;

        this.patientDisplay.refreshPatientDirectory().subscribe(() => {
          this.patientDisplay.hydrateFromRequests(this.dentalRequestsList).subscribe(() => {
            if (this.selectedDentalRequest) {
              this.applyPatientIdentityFromRequest(this.selectedDentalRequest);
            }
            this.cdr.detectChanges();
          });
        });

        if (preserveSelectedId) {
          const found = this.dentalRequestsList.find((req: any) => req.id === preserveSelectedId);
          if (found) {
            this.selectedDentalRequest = found;
            this.applyPatientIdentityFromRequest(found);
          }
        }
      },
      error: (error: any) => {
        this.isLoadingRequests = false;
        this.dentalRequestsLoadInFlight = false;
        if (!silent) {
          const msg = error?.error?.message || 'Could not load dental requests.';
          this.showStatusMessage(msg, 'error');
        }
      }
    });
  }

  getRequestPatientName(request: any): string {
    return this.patientDisplay.getDisplayName(request);
  }

  filteredDentalRequestsList(): any[] {
    let filteredList = this.dentalRequestsList || [];

    if (this.searchText) {
      const searchLower = this.searchText.toLowerCase();
      filteredList = filteredList.filter((dentalRequest) =>
        (this.getRequestPatientName(dentalRequest)?.toLowerCase().includes(searchLower)) ||
        (dentalRequest.report?.toLowerCase().includes(searchLower)) ||
        (dentalRequest.procedureRequestedName?.toLowerCase().includes(searchLower)) ||
        (dentalRequest.exam?.toLowerCase().includes(searchLower)) ||
        (dentalRequest.dateOfProcedure?.toLowerCase().includes(searchLower))
      );
    }

    if (this.listDateFrom || this.listDateTo) {
      filteredList = filteredList.filter((dentalRequest) => this.matchesListDateRange(dentalRequest));
    } else if (this.dentalRequestDateFilter !== 'all') {
      filteredList = filteredList.filter((dentalRequest) => this.matchesDentalRequestDateFilter(dentalRequest));
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

  setDentalRequestDateFilter(filter: DentalV2DateFilter): void {
    this.dentalRequestDateFilter = filter;
    this.listDateFrom = '';
    this.listDateTo = '';
  }

  onListDateRangeChange(): void {
    if (this.listDateFrom || this.listDateTo) {
      this.dentalRequestDateFilter = 'all';
    }
  }

  private matchesListDateRange(dentalRequest: any): boolean {
    const rawDate = dentalRequest?.dateOfProcedure || dentalRequest?.visitDate || dentalRequest?.dateCreated;
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

  private matchesDentalRequestDateFilter(dentalRequest: any): boolean {
    const rawDate = dentalRequest?.dateOfProcedure || dentalRequest?.visitDate || dentalRequest?.dateCreated;
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

    switch (this.dentalRequestDateFilter) {
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

  selectDentalRequest(dentalRequest: any): void {
    this.selectedDentalRequest = dentalRequest;

    if (dentalRequest) {
      this.applyPatientIdentityFromRequest(dentalRequest);
      this.refreshSelectedPatientFromEntity(dentalRequest);
    }

    this.loadDentalReportForRequest(dentalRequest);
    this.loadVisitClinicalDataFromDentalRequest(dentalRequest);
  }

  private applyPatientIdentityFromRequest(dentalRequest: any): void {
    if (!dentalRequest) {
      return;
    }

    const patient = dentalRequest.visit?.patient || dentalRequest.patient || {};
    const patientId = this.patientDisplay.extractPatientId(dentalRequest);
    const cached = patientId ? this.patientDisplay.getCachedPatient(patientId) : null;

    const first =
      cached?.patientFirstName ||
      dentalRequest.patientFirstName ||
      patient.patientFirstName ||
      '';
    const second =
      cached?.patientSecondName ||
      dentalRequest.patientSecondName ||
      patient.patientSecondName ||
      '';

    if (first || second) {
      this.patientFirstName = first || '';
      this.patientSecondName = second || '';
    } else {
      const full =
        (this.patientDisplay.getDisplayName(dentalRequest) || '').trim() ||
        (dentalRequest.patientName || patient.patientName || dentalRequest.visit?.patientName || '').toString().trim();
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
      dentalRequest.patientProfilePic ||
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
      dentalRequest.patientFileNo ||
      dentalRequest.patientFileNumber ||
      dentalRequest.patientFileNumber ||
      '';

    this.patientId = patientId ||
      patient.id ||
      patient.patientId ||
      dentalRequest.patientId ||
      null;

    this.patientAge = cached?.patientAge || dentalRequest.patientAge || patient.patientAge || '';
    this.patientDateOfBirth = cached?.patientDateOfBirth || dentalRequest.patientDateOfBirth || patient.patientDateOfBirth || '';

    this.patientContact = cached?.patientContact ||
      patient.patientContact ||
      dentalRequest.patientContact ||
      patient.phone ||
      dentalRequest.patientPhone ||
      '';

    this.patientGroupName = patient.patientGroupName ||
      patient.patientGroup?.groupNameShortForm ||
      patient.patientGroup?.groupName ||
      dentalRequest.patientGroupName ||
      '';

    this.patientAddress = cached?.patientAddress || dentalRequest.patientAddress || patient.patientAddress || '';
    this.patientGender = cached?.patientGender || dentalRequest.patientGender || patient.patientGender || dentalRequest.gender || '';
    this.patientOccupation = cached?.patientOccupation || dentalRequest.patientOccupation || patient.patientOccupation || '';

    this.nextOfKinName = cached?.nextOfKinName || dentalRequest.nextOfKinName || patient.nextOfKinName || '';
    this.nextOfKinContact = cached?.nextOfKinContact || dentalRequest.nextOfKinContact || patient.nextOfKinContact || '';
    this.nextOfKinAddress = cached?.nextOfKinAddress || dentalRequest.nextOfKinAddress || patient.nextOfKinAddress || '';
    this.relationship = cached?.relationship || dentalRequest.relationship || patient.relationship || '';

    this.diagnosis = cached?.diagnosis || dentalRequest.diagnosis || patient.diagnosis || '';
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

  private refreshSelectedPatientFromEntity(dentalRequest: any): void {
    const patientId = this.patientDisplay.extractPatientId(dentalRequest);
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

  private loadVisitClinicalDataFromDentalRequest(dentalRequest: any): void {
    const visitObj = dentalRequest?.visit;
    const visitId = visitObj?.id ?? dentalRequest?.visitId ?? dentalRequest?.visit?.visitId;

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

  private applyReportToForm(report: any): void {
    this.dentalReportForm.labReportTitle = this.stripHtmlTags(
      report.labReportTitle || report.dentalReportTitle || report.title || ''
    );
    this.dentalReportForm.result = report.result || report.report || report.findings || '';
    this.dentalReportForm.notes = report.notes || '';
    this.dentalReportForm.recommendation = report.recommendation || '';
    this.dentalReportId = report.id || null;
  }

  loadDentalReportForRequest(dentalRequest: any): void {
    if (!dentalRequest?.id) {
      return;
    }

    this.isLoadingReport = true;
    this.dentalRequestId = dentalRequest.id;
    this.resetQuillEditors();

    this.api.getGeneralLabReportByRequestId(dentalRequest.id).subscribe({
      next: (res: any) => {
        this.isLoadingReport = false;
        const report = res?.data ?? res ?? {};

        if (!report?.id || (typeof report?.message === 'string' && report.message.toLowerCase().includes('not found'))) {
          this.createDentalReportForRequest(dentalRequest);
          return;
        }

        this.dentalReport = report;
        this.applyReportToForm(report);
        this.cdr.detectChanges();
        if (this.activeTab === 'report') {
          this.scheduleQuillInit();
        }
      },
      error: () => {
        this.createDentalReportForRequest(dentalRequest);
      }
    });
  }

  private createDentalReportForRequest(dentalRequest: any): void {
    const fallbackPayload = {
      doneBy: this.userName || '',
      recommendation: '',
      result: '',
      notes: '',
      labReportTitle: '',
    };

    this.api.createGeneralLabReportByRequestId(dentalRequest.id, fallbackPayload).subscribe({
      next: (res: any) => {
        this.isLoadingReport = false;
        const report = res?.data ?? res ?? {};
        this.dentalReport = report;
        this.applyReportToForm(report);
        this.cdr.detectChanges();
        if (this.activeTab === 'report') {
          this.scheduleQuillInit();
        }
      },
      error: (error: any) => {
        this.isLoadingReport = false;
        const msg = error?.error?.message || error?.error?.error || 'Could not create the dental report.';
        this.showStatusMessage(msg, 'error');
      }
    });
  }

  saveDentalReport(): void {
    if (!this.dentalReportId) {
      this.showStatusMessage('Missing dental report Id.', 'error');
      return;
    }

    if (!this.userName) {
      this.showStatusMessage('Missing technician initials.', 'error');
      return;
    }

    this.syncModelFromQuill();

    const payload = {
      labReportTitle: (this.dentalReportForm.labReportTitle || '').toString().trim(),
      result: this.dentalReportForm.result || '',
      notes: this.dentalReportForm.notes || '',
      recommendation: this.dentalReportForm.recommendation || '',
      doneBy: this.userName,
    };

    this.isSavingReport = true;

    this.api.updateGeneralLabReport(this.dentalReportId, payload).subscribe({
      next: (response: any) => {
        this.isSavingReport = false;
        this.showStatusMessage(response?.message || 'Dental report saved successfully.', 'success');

        const preservedId = this.selectedDentalRequest?.id;
        this.loadDentalReportForRequest(this.selectedDentalRequest);
        this.loadDentalRequests(preservedId);
      },
      error: (error: any) => {
        this.isSavingReport = false;
        const msg = error?.error?.message || error?.error?.error || 'An unexpected error occurred. Please try again.';
        this.showStatusMessage(msg, 'error');
      }
    });
  }

  previewAndPrintDentalReport(): void {
    if (!this.selectedDentalRequest?.id) {
      this.showStatusMessage('Select a dental request first.', 'error');
      return;
    }

    this.isExportingReport = true;

    this.api.exportScanResults(this.selectedDentalRequest.id).subscribe({
      next: (res: Blob) => {
        this.isExportingReport = false;

        const blob = new Blob([res], { type: 'application/pdf' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `dental-report-${this.selectedDentalRequest.id}.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
      },
      error: (error: any) => {
        this.isExportingReport = false;
        const msg = error?.error?.message || error?.error?.error || 'Could not generate the dental report PDF.';
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
        placeholder: 'Enter findings / results...',
      });
      if (this.dentalReportForm.result) {
        this.quillResultEditor.root.innerHTML = this.dentalReportForm.result;
      }
      this.quillResultEditor.on('text-change', () => {
        this.dentalReportForm.result = this.quillResultEditor.root.innerHTML;
      });
      this.quillResultLoaded = true;

      if (this.recommendationEditor?.nativeElement) {
        this.quillRecommendationEditor = new QuillConstructor(this.recommendationEditor.nativeElement, {
          theme: 'snow',
          modules: { toolbar: this.quillToolbar() },
          placeholder: 'Enter recommendations...',
        });
        if (this.dentalReportForm.recommendation) {
          this.quillRecommendationEditor.root.innerHTML = this.dentalReportForm.recommendation;
        }
        this.quillRecommendationEditor.on('text-change', () => {
          this.dentalReportForm.recommendation = this.quillRecommendationEditor.root.innerHTML;
        });
        this.quillRecommendationLoaded = true;
      }

      this.cdr.detectChanges();
    } catch (error) {
      console.error('Dental V2 Quill init failed', error);
      this.resetQuillEditors();
    }
  }

  private syncModelFromQuill(): void {
    if (this.quillResultEditor && this.quillResultLoaded) {
      this.dentalReportForm.result = this.quillResultEditor.root.innerHTML;
    }
    if (this.quillRecommendationEditor && this.quillRecommendationLoaded) {
      this.dentalReportForm.recommendation = this.quillRecommendationEditor.root.innerHTML;
    }
  }

  private dentalRequestDate(dentalRequest: any): Date | null {
    const raw = dentalRequest?.dateOfProcedure || dentalRequest?.visitDate || dentalRequest?.dateCreated;
    if (!raw) return null;
    const d = new Date(raw);
    if (isNaN(d.getTime())) return null;
    return d;
  }

  private isRequestDone(request: any): boolean {
    const status = (request?.status || '').toString().toLowerCase();
    return status === 'done' || status === 'approved' || status === 'completed';
  }

  setAnalyticsDateFilter(id: DentalV2AnalyticsDateFilter): void {
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
    let list = this.dentalRequestsList || [];

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
    filter: Exclude<DentalV2AnalyticsDateFilter, 'all' | 'custom'>
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
    if (this.analyticsTotalRequests === 0) return 0;
    return Math.round((this.analyticsDoneCount / this.analyticsTotalRequests) * 100);
  }

  get analyticsPendingPercent(): number {
    if (this.analyticsTotalRequests === 0) return 0;
    return 100 - this.analyticsDonePercent;
  }

  get analyticsMonthlyTrend(): Array<{ label: string; count: number; pct: number }> {
    const now = new Date();
    const months: Array<{ key: string; label: string; count: number }> = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const label = d.toLocaleString('en-US', { month: 'short' });
      months.push({ key, label, count: 0 });
    }

    for (const req of this.analyticsScopedRequests()) {
      const d = this.dentalRequestDate(req);
      if (!d) continue;
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const target = months.find((m) => m.key === key);
      if (target) target.count += 1;
    }

    const max = Math.max(...months.map((m) => m.count), 1);
    return months.map((m) => ({
      label: m.label,
      count: m.count,
      pct: Math.max(Math.round((m.count / max) * 100), m.count > 0 ? 8 : 0),
    }));
  }

  get analyticsServiceBreakdown(): Array<{ name: string; count: number; pct: number }> {
    const map = new Map<string, number>();
    for (const req of this.analyticsScopedRequests()) {
      const name = (req?.procedureRequestedName || req?.exam || 'Unspecified').toString().trim();
      if (!name) continue;
      map.set(name, (map.get(name) || 0) + 1);
    }
    const rows = Array.from(map.entries()).map(([name, count]) => ({ name, count }));
    rows.sort((a, b) => b.count - a.count);
    const total = Math.max(rows.reduce((acc, r) => acc + r.count, 0), 1);
    return rows.slice(0, 6).map((r) => ({ ...r, pct: Math.round((r.count / total) * 100) }));
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
