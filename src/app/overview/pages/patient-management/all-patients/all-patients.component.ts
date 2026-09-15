import { Component, OnInit, OnDestroy, ElementRef, ViewChild, HostListener, ChangeDetectorRef } from '@angular/core';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import {
  ensureFromModuleInList,
  normalizeHospitalModules,
  pickDefaultFromModuleId,
  isQueueDischargeDestination,
  QUEUE_DISCHARGE_DESTINATION_ID,
  queueDestinationOptions,
} from '../../../../utils/queue-module.util';
import { ApiService } from '../../../../services/api.service';
import { ApiConfigService } from '../../../../services/api-config.service';
import { ThemeService } from '../../../../services/theme.service';
import { Router } from '@angular/router';
import { NgForm } from '@angular/forms';
import { GlobalFeedbackService } from '../../../../services/global-feedback.service';
import { AccessControlService } from '../../../../services/access-control.service';
import { FacilityBrandingService } from '../../../../services/facility-branding.service';
import { defaultContactValue } from '../../../../utils/phone-contact.util';
import { BLOOD_GROUP_OPTIONS } from '../../../../utils/blood-group.util';
import { NgbDateStruct } from '@ng-bootstrap/ng-bootstrap';
import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

@Component({
  selector: 'app-all-patients',
  templateUrl: './all-patients.component.html',
  styleUrls: ['./all-patients.component.css']
})
export class AllPatientsComponent implements OnInit, OnDestroy {

  readonly bloodGroupOptions = BLOOD_GROUP_OPTIONS;

  // Table data properties
  patientList: any[] = [];
  data: any[] = [];
  page: number = 1;
  itemsPerPage: number = 8;
  readonly pageSizeOptions = [8, 15, 25, 50, 100];
  /** Locked default from DB; null = no saved default. */
  lockedRegistryItemsPerPage: number | null = null;
  pageSizeMenuOpen = false;
  pageSizeSaving = false;
  searchQuery: string = '';
  selectedColumn: string = 'all';
  createdDateFrom = '';
  createdDateTo = '';
  selectedPatientGroupFilter = 'all';
  selectedDebtFilter: 'all' | 'with-debt' | 'without-debt' = 'all';
  pendingCreatedDateFromStruct: NgbDateStruct | null = null;
  pendingCreatedDateToStruct: NgbDateStruct | null = null;
  pendingPatientGroupFilter = 'all';
  pendingDebtFilter: 'all' | 'with-debt' | 'without-debt' = 'all';
  filterGroupDropdownOpen = false;
  filterDebtDropdownOpen = false;
  readonly debtFilterOptions: { value: 'all' | 'with-debt' | 'without-debt'; label: string }[] = [
    { value: 'all', label: 'All patients' },
    { value: 'with-debt', label: 'With debt' },
    { value: 'without-debt', label: 'Without debt' },
  ];
  
  private apiReadySub?: Subscription;
  private lastLoadedApiBase = '';

  // Loading and response properties
  isLoadingService: boolean = false;
  patientLoadError = '';
  responseColor = "";
  responseMessage = "";
  showDivUpdatedOut: boolean = false;
  
  // User permissions
  mdUser: boolean = false;
  userRole: string | null = null;
  
  // UI state properties
  isCollapsed = true;
  iconChange: string = "bi bi-chevron-down";
  eyeIcon: string = "bi bi-funnel";
  eyeIconDrop: string = "bi bi-chevron-down";
  isText: boolean = true;
  isDarkMode: boolean = false;
  
  // Form properties
  currentPatient: any = {};
  saveButtonStatus: string = "Add New Patient";
  isButtonDisabled: boolean = false;
  showDivAddToDataBaseNewPatient: boolean = false;
  showDivUpdatedLoaderNewPatient: boolean = false;
  isCollapsedNewPatient: boolean = true;
  
  // Editing properties
  isEditingPatient: boolean = false;
  editingPatientId: number | null = null;
  
  // Patient Groups for dropdown
  patientGroupList: any[] = [];
  filteredPatientGroupList: any[] = [];
  isPatientGroupDropdownOpen: boolean = false;
  patientGroupSearchQuery: string = '';
  
  // Add New Group Modal
  isCollapsedNewGroup: boolean = true;
  currentPatientGroup: any = {};
  saveButtonStatusGroup: string = "Add New Patient Group";
  isEditingGroup: boolean = false;
  
  // Action Dropdown (fixed overlay — not clipped by table overflow)
  openActionDropdownId: number | null = null;
  actionDropdownPatient: any = null;
  actionMenuStyle: { top: string; left: string } = { top: '0px', left: '0px' };
  dropdownDirection: 'up' | 'down' = 'down';
  private readonly actionMenuWidth = 200;
  private readonly actionMenuEstimatedHeight = 188;

  /** While fetching latest visit before navigating to patient-visit */
  consultationLoadingPatientId: number | null = null;

  /** Read-only patient details sheet from the actions menu */
  showPatientDetailsModal = false;
  patientDetailsRecord: any = null;

  /** Bulk import from Excel/CSV */
  showImportModal = false;
  importPreviewRows: {
    rowNumber: number;
    data: any;
    errors: string[];
    warnings: string[];
    isValid: boolean;
  }[] = [];
  importFileName = '';
  importUploading = false;
  importParseError = '';

  // Queue patient modal (from registry)
  showQueuePatientModal = false;
  queueSelectedPatient: any = null;
  queueModules: any[] = [];
  queueClinics: any[] = [];
  queueError = '';
  queueSaving = false;
  queueForm = {
    fromModuleId: null as number | null,
    toModuleId: null as number | null,
    clinicId: null as number | null,
    note: '',
    visitDefaultScheme: '',
    patientGroupId: null as number | null,
    emergency: false,
    revisit: false,
    printQueueTicket: false,
  };
  readonly QUEUE_DISCHARGE_DESTINATION_ID = QUEUE_DISCHARGE_DESTINATION_ID;
  readonly isQueueDischargeDestination = isQueueDischargeDestination;

  /** Pay all patient debt modal (opened from balance badge) */
  showPayAllDebtModal = false;
  exportDropdownOpen = false;
  payAllDebtPatient: any = null;
  payAllDebtPatientTotalDue: number | null = null;
  payAllDebtForm: { amountToPay: number | null; paymentForm: string; notes: string } = {
    amountToPay: null,
    paymentForm: 'Cash At Hand',
    notes: 'Pay all patient debt',
  };
  payAllDebtVisits: any[] = [];
  payAllDebtAllocation: {
    visitId: number;
    visitNumber: number | null;
    visitDate: string;
    balanceDue: number;
    amountToApply: number;
  }[] = [];
  payAllDebtSaving = false;
  payAllDebtLoading = false;
  payAllDebtMessage = '';
  payAllDebtMessageOk = false;
  payAllDebtResult: any = null;

  get queueDestinationModules(): any[] {
    return queueDestinationOptions(this.queueModules);
  }
  
  // ViewChild references
  @ViewChild('htmlData') htmlData!: ElementRef;

  constructor(
    private router: Router,
    private api: ApiService,
    private apiConfig: ApiConfigService,
    private themeService: ThemeService,
    private globalFeedbackService: GlobalFeedbackService,
    private accessControl: AccessControlService,
    private facilityBranding: FacilityBrandingService,
    private cdr: ChangeDetectorRef
  ) {}

  private showGlobalSuccess(message: string): void {
    this.globalFeedbackService.show(message, 'success');
  }

  private showGlobalError(message: string): void {
    this.globalFeedbackService.show(message, 'error');
  }

  private showGlobalInfo(message: string): void {
    this.globalFeedbackService.show(message, 'info');
  }

  ngOnInit(): void {
    this.userRole = sessionStorage.getItem('userrole');
    const username = sessionStorage.getItem('username');

    // Subscribe to theme changes for real-time updates
    this.themeService.isDarkMode$.subscribe(isDark => {
      this.isDarkMode = isDark;
    });
    this.facilityBranding.load().subscribe({ next: () => {}, error: () => {} });

    if (this.userRole === "md") {
      this.mdUser = true;
    }

    if (username === null) {
      this.router.navigate(['/login']);
    } else {
      if (this.userRole === "CUSTOMER") {
        this.router.navigate(['/products']);
      }
    }
    
    this.loadPatientGroups();
    this.initializeTableData();
    this.loadQueueModules();
    this.applyLockedRegistryPageSize();

    this.apiReadySub = this.apiConfig.state$
      .pipe(filter((state) => state === 'ready'))
      .subscribe(() => {
        const base = this.apiConfig.getBaseUrl();
        if (base && base !== this.lastLoadedApiBase) {
          this.loadPatientGroups();
          this.initializeTableData();
        }
      });
  }

  private applyLockedRegistryPageSize(): void {
    const locked = this.readLockedRegistryPageSizeFromSession();
    this.lockedRegistryItemsPerPage = locked;
    if (locked != null) {
      this.itemsPerPage = locked;
      this.page = 1;
    }
  }

  private readLockedRegistryPageSizeFromSession(): number | null {
    try {
      const raw = sessionStorage.getItem('userDetails');
      if (!raw) return null;
      const user = JSON.parse(raw);
      const value = Number(user?.registryItemsPerPage);
      if (this.pageSizeOptions.includes(value)) return value;
    } catch {
      /* ignore */
    }
    return null;
  }

  private currentUserId(): number | null {
    const fromKey = Number(sessionStorage.getItem('userid'));
    if (Number.isFinite(fromKey) && fromKey > 0) return fromKey;
    try {
      const raw = sessionStorage.getItem('userDetails');
      if (!raw) return null;
      const id = Number(JSON.parse(raw)?.id);
      if (Number.isFinite(id) && id > 0) return id;
    } catch {
      /* ignore */
    }
    return null;
  }

  private syncLockedPageSizeToSession(size: number | null): void {
    try {
      const raw = sessionStorage.getItem('userDetails');
      const user = raw ? JSON.parse(raw) : {};
      user.registryItemsPerPage = size;
      sessionStorage.setItem('userDetails', JSON.stringify(user));
      if (user?.id != null) {
        sessionStorage.setItem('userid', String(user.id));
      }
    } catch {
      /* ignore */
    }
  }

  togglePageSizeMenu(event?: Event): void {
    event?.stopPropagation();
    this.pageSizeMenuOpen = !this.pageSizeMenuOpen;
  }

  closePageSizeMenu(): void {
    this.pageSizeMenuOpen = false;
  }

  onItemsPerPageChange(itemsPerPage: number) {
    const size = Number(itemsPerPage);
    if (!this.pageSizeOptions.includes(size)) return;
    this.itemsPerPage = size;
    this.page = 1;
    this.pageSizeMenuOpen = false;
  }

  lockRegistryPageSize(size: number, event?: Event): void {
    event?.stopPropagation();
    if (!this.pageSizeOptions.includes(size)) return;
    const userId = this.currentUserId();
    if (userId == null) {
      this.showGlobalError('Sign in again to save your page-size default.');
      return;
    }
    this.pageSizeSaving = true;
    this.api.updateUiPreferences(userId, { registryItemsPerPage: size }).subscribe({
      next: () => {
        this.lockedRegistryItemsPerPage = size;
        this.itemsPerPage = size;
        this.page = 1;
        this.syncLockedPageSizeToSession(size);
        this.pageSizeSaving = false;
        this.pageSizeMenuOpen = false;
        this.showGlobalInfo(`Registry default locked at ${size} per page.`);
      },
      error: () => {
        this.pageSizeSaving = false;
        this.showGlobalError('Could not save page-size default.');
      },
    });
  }

  unlockRegistryPageSize(event?: Event): void {
    event?.stopPropagation();
    const userId = this.currentUserId();
    if (userId == null) {
      this.showGlobalError('Sign in again to clear your page-size default.');
      return;
    }
    this.pageSizeSaving = true;
    this.api.updateUiPreferences(userId, { registryItemsPerPage: null }).subscribe({
      next: () => {
        this.lockedRegistryItemsPerPage = null;
        this.syncLockedPageSizeToSession(null);
        this.pageSizeSaving = false;
        this.showGlobalInfo('Registry page-size lock cleared.');
      },
      error: () => {
        this.pageSizeSaving = false;
        this.showGlobalError('Could not clear page-size default.');
      },
    });
  }

  ngOnDestroy(): void {
    this.apiReadySub?.unsubscribe();
  }

  private loadQueueModules(): void {
    this.api.getAllHospitalModules().subscribe({
      next: (res: any) => {
        this.queueModules = normalizeHospitalModules(res);
        this.queueForm.fromModuleId = ensureFromModuleInList(
          this.queueForm.fromModuleId,
          this.queueModules
        );
        if (!this.queueForm.fromModuleId) {
          this.queueForm.fromModuleId = pickDefaultFromModuleId(this.queueModules);
        }
      },
      error: () => {
        this.queueModules = [];
      },
    });
  }

  openQueuePatientModal(patient: any): void {
    this.closeActionDropdown();
    this.queueSelectedPatient = patient;
    this.queueError = '';
    this.queueClinics = [];
    this.queueForm = {
      fromModuleId: pickDefaultFromModuleId(this.queueModules),
      toModuleId: null,
      clinicId: null,
      note: '',
      visitDefaultScheme: '',
      patientGroupId: patient?.patientGroup?.id || null,
      emergency: false,
      revisit: false,
      printQueueTicket: false,
    };
    if (patient?.patientGroup?.groupName) {
      this.queueForm.visitDefaultScheme = patient.patientGroup.groupName;
    }
    this.showQueuePatientModal = true;
    document.body.style.overflow = 'hidden';
  }

  closeQueuePatientModal(): void {
    this.showQueuePatientModal = false;
    this.queueSelectedPatient = null;
    this.queueError = '';
    this.queueSaving = false;
    document.body.style.overflow = '';
  }

  onQueueToModuleChange(): void {
    this.queueForm.clinicId = null;
    if (isQueueDischargeDestination(this.queueForm.toModuleId)) {
      this.queueClinics = [];
      return;
    }
    if (!this.queueForm.toModuleId) {
      this.queueClinics = [];
      return;
    }
    this.api.getHospitalClinics(this.queueForm.toModuleId).subscribe({
      next: (res: any) => {
        const all = Array.isArray(res) ? res : [];
        this.queueClinics = all.filter((c: any) => c.active !== false);
      },
      error: () => {
        this.queueClinics = [];
      },
    });
  }

  onQueueSchemeChange(): void {
    const g = this.patientGroupList.find((x) => x.id === this.queueForm.patientGroupId);
    this.queueForm.visitDefaultScheme = g?.groupName || '';
  }

  submitQueueFromRegistry(): void {
    const isDischarge = isQueueDischargeDestination(this.queueForm.toModuleId);
    if (!this.queueSelectedPatient?.id) {
      this.queueError = 'Select a patient first.';
      return;
    }
    if (!isDischarge && !this.queueForm.fromModuleId) {
      this.queueError = 'Select patient and From department.';
      return;
    }
    if (!this.queueForm.toModuleId) {
      this.queueError = 'Select destination.';
      return;
    }
    this.queueSaving = true;
    this.queueError = '';
    const username = sessionStorage.getItem('username') || '';

    if (isQueueDischargeDestination(this.queueForm.toModuleId)) {
      this.api.dischargePatientFromQueue({
        patientId: this.queueSelectedPatient.id,
        note: this.queueForm.note,
        dischargedBy: username,
      }).subscribe({
        next: () => {
          this.queueSaving = false;
          this.showGlobalSuccess('Patient discharged from queue.');
          this.closeQueuePatientModal();
        },
        error: (err: any) => {
          this.queueSaving = false;
          this.queueError = err?.error?.message || 'Failed to discharge patient.';
        },
      });
      return;
    }

    const scheme =
      this.queueForm.visitDefaultScheme ||
      this.patientGroupList.find((g) => g.id === this.queueForm.patientGroupId)?.groupName ||
      '';
    const fromModuleId = this.queueForm.fromModuleId;
    const toModuleId = this.queueForm.toModuleId;
    if (fromModuleId == null || toModuleId == null) {
      this.queueSaving = false;
      this.queueError = 'Select From and To departments.';
      return;
    }

    this.api.queuePatient({
      patientId: this.queueSelectedPatient.id,
      fromModuleId,
      toModuleId,
      clinicId: this.queueForm.clinicId ?? undefined,
      note: this.queueForm.note,
      visitDefaultScheme: scheme,
      patientGroupId: this.queueForm.patientGroupId ?? undefined,
      emergency: this.queueForm.emergency,
      revisit: this.queueForm.revisit,
      queuedBy: sessionStorage.getItem('username') || '',
    }).subscribe({
      next: (entry: any) => {
        this.queueSaving = false;
        if (this.queueForm.printQueueTicket && entry?.queueNumber) {
          this.printQueueTicket(entry);
        }
        this.showGlobalSuccess('Patient queued successfully.');
        this.closeQueuePatientModal();
      },
      error: (err: any) => {
        this.queueSaving = false;
        this.queueError = err?.error?.message || 'Failed to queue patient.';
      },
    });
  }

  private printQueueTicket(entry: any): void {
    const w = window.open('', '_blank', 'width=420,height=340');
    if (!w) return;
    const p = this.queueSelectedPatient;
    w.document.write(`
      <html><head><title>Queue Ticket</title></head>
      <body style="font-family:sans-serif;padding:16px">
        <h2>Queue Ticket</h2>
        <p><strong>${entry.queueNumber || ''}</strong></p>
        <p>${p?.patientSecondName || ''} ${p?.patientFirstName || ''}</p>
        <p>OP: ${p?.patientFileNo || ''}</p>
        <p>To: ${entry.toModuleName || ''}</p>
      </body></html>
    `);
    w.document.close();
    w.print();
  }

  initializeTableData() {
    this.isLoadingService = true;
    this.patientLoadError = '';
    this.lastLoadedApiBase = this.apiConfig.getBaseUrl();
    this.api.getItems().subscribe({
      next: (res) => {
        this.isLoadingService = false;
        const patientList = Array.isArray(res) ? res : [];
        this.patientList = patientList;
        this.data = patientList;
        this.applyBalanceDueFromPatientRows();
        if (!patientList.length) {
          this.patientLoadError = 'No patients found on the connected server.';
        }
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.isLoadingService = false;
        console.error('Error loading patients:', err);
        this.patientList = [];
        this.data = [];
        this.patientLoadError = this.buildPatientLoadErrorMessage(err);
        this.showGlobalError(this.patientLoadError);
        this.cdr.detectChanges();
      }
    });
  }

  private buildPatientLoadErrorMessage(err: any): string {
    if (err?.status === 0) {
      return 'Cannot reach the clinic server. Check your connection or pick another server.';
    }
    return err?.error?.message || 'Unable to load patients. Please try again.';
  }

  /**
   * Balance for the table comes from the patient list payload (`totalAmountDue`, etc.),
   * so the UI does not wait on N extra `getTotalPatientBalanceDue` calls.
   */
  private applyBalanceDueFromPatientRows(): void {
    const list = this.patientList;
    if (!list?.length) {
      return;
    }
    this.patientList = list.map((p) => ({
      ...p,
      totalBalanceDue: this.balanceFromPatientRow(p)
    }));
    this.data = this.patientList;
  }

  /** Parse balance fields already present on each patient from `get-all-patients`. */
  private balanceFromPatientRow(p: any): number | null {
    const raw =
      p?.totalAmountDue ??
      p?.TotalAmountDue ??
      p?.totalBalanceDue ??
      p?.balanceDue ??
      p?.BalanceDue;
    if (raw === undefined || raw === null || raw === '') {
      return null;
    }
    const n = typeof raw === 'number' ? raw : parseFloat(String(raw));
    return Number.isFinite(n) ? n : null;
  }

  /** Balance column: loading, error, zero as 0.0000, otherwise whole-number amount. */
  formatPatientBalance(patient: any): string {
    if (patient?.totalBalanceDue === undefined) {
      return '…';
    }
    if (patient.totalBalanceDue === null) {
      return 'N/A';
    }
    const n = Number(patient.totalBalanceDue);
    if (!Number.isFinite(n)) {
      return 'N/A';
    }
    if (n === 0) {
      return '0.0000';
    }
    return Math.round(n).toLocaleString(undefined, { maximumFractionDigits: 0 });
  }

  /** True when balance is loaded and exactly zero (good standing). */
  hasZeroBalance(patient: any): boolean {
    if (patient?.totalBalanceDue === undefined || patient.totalBalanceDue === null) {
      return false;
    }
    const n = Number(patient.totalBalanceDue);
    return Number.isFinite(n) && n === 0;
  }

  /** Modifier classes for balance pill (same semantics as former balance-text colors). */
  getBalanceBadgeClasses(patient: any): Record<string, boolean> {
    if (patient?.totalBalanceDue === undefined) {
      return { 'balance-loading': true };
    }
    if (patient.totalBalanceDue === null) {
      return { 'balance-na': true };
    }
    const n = Number(patient.totalBalanceDue);
    if (!Number.isFinite(n)) {
      return { 'balance-na': true };
    }
    if (n === 0) {
      return { 'balance-zero': true };
    }
    if (n < 0) {
      return { 'balance-credit': true };
    }
    return { 'balance-due': true };
  }

  /** True when the patient has an outstanding balance (debt). */
  hasPatientDebt(patient: any): boolean {
    if (patient?.totalBalanceDue === undefined || patient.totalBalanceDue === null) {
      return false;
    }
    const n = Number(patient.totalBalanceDue);
    return Number.isFinite(n) && n > 0;
  }

  onBalanceBadgeClick(patient: any, event: MouseEvent): void {
    event.stopPropagation();
    if (!this.hasPatientDebt(patient)) {
      return;
    }
    this.openPayAllPatientDebtModal(patient);
  }

  openPayAllPatientDebtModal(patient: any): void {
    if (!patient?.id) {
      return;
    }
    this.closeActionDropdown();
    this.payAllDebtPatient = patient;
    this.payAllDebtPatientTotalDue = this.hasPatientDebt(patient)
      ? Number(patient.totalBalanceDue)
      : null;
    this.payAllDebtMessage = '';
    this.payAllDebtMessageOk = false;
    this.payAllDebtResult = null;
    this.payAllDebtForm = {
      amountToPay: this.getDefaultPayAllDebtAmount(),
      paymentForm: 'Cash At Hand',
      notes: 'Pay all patient debt',
    };
    this.payAllDebtAllocation = [];
    this.payAllDebtVisits = [];
    this.payAllDebtLoading = true;
    this.showPayAllDebtModal = true;
    document.body.style.overflow = 'hidden';

    this.api.getInitialTriageVitalsForVisitId(patient.id).subscribe({
      next: (visits) => {
        this.payAllDebtVisits = this.sortVisitsOldestFirst(Array.isArray(visits) ? visits : []);
        this.payAllDebtForm.amountToPay = this.getDefaultPayAllDebtAmount();
        this.payAllDebtLoading = false;
        this.rebuildPayAllDebtAllocation();
      },
      error: () => {
        this.payAllDebtLoading = false;
        this.payAllDebtMessage = 'Could not load patient visits.';
        this.payAllDebtMessageOk = false;
      },
    });
  }

  closePayAllPatientDebtModal(): void {
    this.showPayAllDebtModal = false;
    this.payAllDebtPatient = null;
    this.payAllDebtPatientTotalDue = null;
    this.payAllDebtVisits = [];
    this.payAllDebtAllocation = [];
    this.payAllDebtSaving = false;
    this.payAllDebtLoading = false;
    this.payAllDebtMessage = '';
    this.payAllDebtMessageOk = false;
    this.payAllDebtResult = null;
    if (!this.showQueuePatientModal && !this.showPatientDetailsModal && this.isCollapsedNewPatient) {
      document.body.style.overflow = '';
    }
  }

  onPayAllDebtAmountChange(): void {
    this.rebuildPayAllDebtAllocation();
  }

  payAllDebtTotalOutstanding(): number {
    return (this.payAllDebtVisits || []).reduce((sum, visit) => {
      const due = Number(visit?.balanceDue ?? 0);
      return sum + (Number.isFinite(due) && due > 0 ? due : 0);
    }, 0);
  }

  submitPayAllPatientDebt(): void {
    const patientId = this.payAllDebtPatient?.id;
    const amount = Number(this.payAllDebtForm.amountToPay);
    if (!patientId) {
      this.payAllDebtMessage = 'Select a patient first.';
      this.payAllDebtMessageOk = false;
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      this.payAllDebtMessage = 'Enter a valid payment amount.';
      this.payAllDebtMessageOk = false;
      return;
    }
    if (!this.payAllDebtAllocation.length) {
      this.payAllDebtMessage = 'No outstanding visit balances to pay.';
      this.payAllDebtMessageOk = false;
      return;
    }

    this.payAllDebtSaving = true;
    this.payAllDebtMessage = '';
    const payload = {
      amountToPay: amount,
      paymentForm: this.payAllDebtForm.paymentForm || 'Cash At Hand',
      status: 'Approved',
      notes: (this.payAllDebtForm.notes || 'Pay all patient debt').trim(),
      receivedBy: (sessionStorage.getItem('username') || '').trim(),
    };

    this.api.payAllPatientDebt(patientId, payload).subscribe({
      next: (res: any) => {
        this.payAllDebtSaving = false;
        this.payAllDebtMessageOk = true;
        this.payAllDebtResult = res?.data ?? null;
        this.payAllDebtMessage =
          res?.message ||
          `Payment applied across ${this.payAllDebtResult?.allocations?.length ?? 0} visit(s).`;
        this.refreshPayAllDebtPatientTotal(patientId);
        this.api.getInitialTriageVitalsForVisitId(patientId).subscribe({
          next: (visits) => {
            this.payAllDebtVisits = this.sortVisitsOldestFirst(Array.isArray(visits) ? visits : []);
            this.rebuildPayAllDebtAllocation();
          },
        });
      },
      error: (err) => {
        this.payAllDebtSaving = false;
        this.payAllDebtMessageOk = false;
        this.payAllDebtMessage =
          err?.error?.message || err?.error?.data?.message || 'Could not apply patient debt payment.';
      },
    });
  }

  private getDefaultPayAllDebtAmount(): number | null {
    const totalDebt = Number(this.payAllDebtPatientTotalDue);
    if (Number.isFinite(totalDebt) && totalDebt > 0) {
      return totalDebt;
    }
    const visitOutstanding = this.payAllDebtTotalOutstanding();
    if (visitOutstanding > 0) {
      return visitOutstanding;
    }
    return null;
  }

  private sortVisitsOldestFirst(visits: any[]): any[] {
    return [...visits].sort((a, b) => {
      const an = Number(a?.visitNumber ?? a?.id ?? 0);
      const bn = Number(b?.visitNumber ?? b?.id ?? 0);
      if (an !== bn) {
        return an - bn;
      }
      return Number(a?.id ?? 0) - Number(b?.id ?? 0);
    });
  }

  private rebuildPayAllDebtAllocation(): void {
    let remaining = Number(this.payAllDebtForm.amountToPay);
    if (!Number.isFinite(remaining) || remaining <= 0) {
      this.payAllDebtAllocation = [];
      return;
    }
    const rows: {
      visitId: number;
      visitNumber: number | null;
      visitDate: string;
      balanceDue: number;
      amountToApply: number;
    }[] = [];
    for (const visit of this.payAllDebtVisits || []) {
      if (remaining <= 0) {
        break;
      }
      const due = Number(visit?.balanceDue ?? 0);
      if (!Number.isFinite(due) || due <= 0) {
        continue;
      }
      const apply = Math.min(remaining, due);
      rows.push({
        visitId: Number(visit.id),
        visitNumber: visit?.visitNumber != null ? Number(visit.visitNumber) : null,
        visitDate: String(visit?.visitDate ?? ''),
        balanceDue: due,
        amountToApply: apply,
      });
      remaining -= apply;
    }
    this.payAllDebtAllocation = rows;
  }

  private refreshPayAllDebtPatientTotal(patientId: number): void {
    this.api.getTotalPatientBalanceDue(patientId).subscribe({
      next: (res) => {
        const total = res?.TotalAmountDue ?? res?.totalAmountDue ?? null;
        const parsed = total != null ? Number(total) : null;
        this.payAllDebtPatientTotalDue = Number.isFinite(parsed as number) ? (parsed as number) : null;
        this.updatePatientBalanceInList(patientId, this.payAllDebtPatientTotalDue);
        if (this.patientDetailsRecord?.id === patientId) {
          this.patientDetailsRecord = {
            ...this.patientDetailsRecord,
            totalBalanceDue: this.payAllDebtPatientTotalDue,
          };
        }
      },
    });
  }

  private updatePatientBalanceInList(patientId: number, totalBalanceDue: number | null): void {
    const apply = (list: any[]) =>
      list.map((p) => (p?.id === patientId ? { ...p, totalBalanceDue } : p));
    this.patientList = apply(this.patientList);
    this.data = apply(this.data);
    if (this.payAllDebtPatient?.id === patientId) {
      this.payAllDebtPatient = { ...this.payAllDebtPatient, totalBalanceDue };
    }
  }

  private assignablePatientGroups(): any[] {
    return this.accessControl.filterAssignablePatientGroups(this.patientGroupList);
  }

  loadPatientGroups() {
    this.api.getPatientGroupList().subscribe({
      next: (res) => {
        if (Array.isArray(res)) {
          this.patientGroupList = res;
        } else if (res && Array.isArray(res.data)) {
          this.patientGroupList = res.data;
        }
        this.filteredPatientGroupList = this.assignablePatientGroups();
      },
      error: (err: any) => {
        console.error("Error loading patient groups:", err);
        this.patientGroupList = [];
        this.filteredPatientGroupList = [];
        this.showGlobalError('Unable to load patient groups.');
      }
    });
  }

  // Patient Group Dropdown Methods
  togglePatientGroupDropdown() {
    this.isPatientGroupDropdownOpen = !this.isPatientGroupDropdownOpen;
    if (this.isPatientGroupDropdownOpen) {
      this.patientGroupSearchQuery = '';
      this.filteredPatientGroupList = this.assignablePatientGroups();
    }
  }

  closePatientGroupDropdown() {
    this.isPatientGroupDropdownOpen = false;
    this.patientGroupSearchQuery = '';
  }

  filterPatientGroups() {
    const query = this.patientGroupSearchQuery.toLowerCase().trim();
    const source = this.assignablePatientGroups();
    if (!query) {
      this.filteredPatientGroupList = source;
      return;
    }
    this.filteredPatientGroupList = source.filter(group => {
      const groupName = (group.groupName || group.name || '').toLowerCase();
      const shortForm = (group.groupNameShortForm || '').toLowerCase();
      return groupName.includes(query) || shortForm.includes(query);
    });
  }

  selectPatientGroup(group: any) {
    if (!this.accessControl.canAssignPatientToGroup(group)) {
      this.showGlobalError('You need admin approval to add any patient in Veneranda Hospital group.');
      return;
    }
    // Store the group ID for the backend, but display the group name
    this.currentPatient.patientGroupId = group.id;
    this.currentPatient.patientGroup = group.groupName || group.name; // For display purposes
    this.closePatientGroupDropdown();
  }

  private resolvePatientGroupDisplayName(groupId: any): string {
    if (!groupId) {
      return '';
    }

    const matchedGroup = this.patientGroupList.find((group: any) => {
      const id = group?.id ?? group?.patientGroupId;
      return String(id) === String(groupId);
    });

    return matchedGroup?.groupName || matchedGroup?.name || '';
  }

  private loadPatientGroupDisplayById(groupId: any): void {
    if (!groupId) {
      return;
    }

    this.api.getPatientGroupByGroupName(groupId).subscribe({
      next: (group: any) => {
        const resolvedName = group?.groupName || group?.name || '';
        if (
          resolvedName &&
          String(this.currentPatient?.patientGroupId) === String(groupId)
        ) {
          this.currentPatient.patientGroup = resolvedName;
        }
      },
      error: (err: any) => {
        console.error('Error loading patient group by id:', err);
      }
    });
  }

  // Add New Group Modal Methods
  openAddNewGroupModal() {
    this.closePatientGroupDropdown();
    this.clearFormNewGroup();
    this.isCollapsedNewGroup = false;
    document.body.style.overflow = 'hidden';
  }

  closeAddNewGroupModal() {
    this.isCollapsedNewGroup = true;
    document.body.style.overflow = '';
    this.clearFormNewGroup();
  }

  clearFormNewGroup() {
    this.currentPatientGroup = {
      groupName: '',
      groupNameShortForm: '',
      description: ''
    };
    this.saveButtonStatusGroup = "Add New Patient Group";
    this.isEditingGroup = false;
  }

  saveGroup(groupData: any) {
    this.isButtonDisabled = true;
    console.log("Patient group data to save:", groupData);

    if (this.isEditingGroup) {
      // Update existing group - Note: Update functionality needs to be implemented
      this.isButtonDisabled = false;
      this.responseColor = 'rgb(238, 16, 16)';
      this.responseMessage = "Update functionality is not yet implemented in the backend API.";
      this.showDivAddToDataBaseNewPatient = true;
      this.showGlobalInfo(this.responseMessage);
      
      setTimeout(() => {
        this.showDivAddToDataBaseNewPatient = false;
      }, 4000);
    } else {
      // Create new group
      this.api.createPatientGroup(groupData).subscribe({
        next: (response) => {
          console.log("Patient group saved successfully:", response);
          this.isButtonDisabled = false;
          this.responseColor = 'rgb(11, 155, 112)';
          this.responseMessage = "Patient group added successfully!";
          this.showDivAddToDataBaseNewPatient = true;
          this.showGlobalSuccess(this.responseMessage);
          
          // Reload patient groups
          this.loadPatientGroups();
          
          setTimeout(() => {
            this.showDivAddToDataBaseNewPatient = false;
            this.closeAddNewGroupModal();
          }, 2000);
        },
        error: (error) => {
          console.error("Error saving patient group:", error);
          this.isButtonDisabled = false;
          this.responseColor = 'rgb(238, 16, 16)';
          this.responseMessage = error.error?.message || "Error saving patient group. Please try again.";
          this.showDivAddToDataBaseNewPatient = true;
          this.showGlobalError(this.responseMessage);
          
          setTimeout(() => {
            this.showDivAddToDataBaseNewPatient = false;
          }, 4000);
        }
      });
    }
  }

  // Close dropdown when clicking outside
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.custom-dropdown')) {
      this.closePatientGroupDropdown();
    }
    if (
      !target.closest('.action-dropdown-container') &&
      !target.closest('.action-dropdown-menu-fixed')
    ) {
      this.closeActionDropdown();
    }
    if (!target.closest('.patient-filter-export-dropdown')) {
      this.closeExportDropdown();
    }
    if (!target.closest('.patient-filter-dropdown')) {
      this.closeFilterDropdowns();
    }
    if (!target.closest('.page-size-dropdown')) {
      this.closePageSizeMenu();
    }
  }

  @HostListener('window:scroll')
  @HostListener('window:resize')
  onViewportChange(): void {
    if (this.openActionDropdownId !== null) {
      this.closeActionDropdown();
    }
  }

  closeActionDropdown(): void {
    this.openActionDropdownId = null;
    this.actionDropdownPatient = null;
  }

  toggleActionDropdown(patient: any, event: MouseEvent): void {
    event.stopPropagation();
    const patientId = patient?.id;
    if (patientId == null) {
      return;
    }
    if (this.openActionDropdownId === patientId) {
      this.closeActionDropdown();
      return;
    }

    const buttonElement = event.currentTarget as HTMLElement;
    const rect = buttonElement.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;
    const openDown =
      spaceBelow >= this.actionMenuEstimatedHeight || spaceBelow >= spaceAbove;

    this.dropdownDirection = openDown ? 'down' : 'up';

    let top = openDown ? rect.bottom + 4 : rect.top - this.actionMenuEstimatedHeight - 4;
    let left = rect.right - this.actionMenuWidth;

    const margin = 8;
    left = Math.max(margin, Math.min(left, viewportWidth - this.actionMenuWidth - margin));
    top = Math.max(
      margin,
      Math.min(top, viewportHeight - this.actionMenuEstimatedHeight - margin)
    );

    this.actionMenuStyle = {
      top: `${Math.round(top)}px`,
      left: `${Math.round(left)}px`,
    };
    this.actionDropdownPatient = patient;
    this.openActionDropdownId = patientId;
  }

  get filteredPatientList() {
    const searchText = this.searchQuery.toLowerCase().trim();
    const digitsQuery = searchText.replace(/\D/g, '');
    const textFiltered = this.patientList.filter(patient => {
      if (!searchText) {
        return true;
      }
      if (this.selectedColumn === 'all') {
        return this.patientMatchesRegistrySearch(patient, searchText, digitsQuery);
      }

      if (this.selectedColumn === 'name') {
        const firstName = patient.patientFirstName || patient.firstName || '';
        const secondName = patient.patientSecondName || patient.secondName || '';
        const fullName = `${firstName} ${secondName}`;
        return fullName.toLowerCase().includes(searchText);
      }
      if (this.selectedColumn === 'patientContact') {
        return this.valueMatchesSearch(
          patient.patientContact || patient.phone || patient.patientPhone,
          searchText,
          digitsQuery
        );
      }
      if (this.selectedColumn === 'patientGender') {
        const gender = patient.patientGender || patient.gender || '';
        return gender.toLowerCase().includes(searchText);
      }
      if (this.selectedColumn === 'patientGroup') {
        const group = patient.patientGroup?.groupName || patient.patientGroup || '';
        return (typeof group === 'string' ? group : '').toLowerCase().includes(searchText);
      }
      const value = patient[this.selectedColumn];
      return this.valueMatchesSearch(value, searchText, digitsQuery);
    });

    return textFiltered.filter(patient => {
      if (this.selectedDebtFilter === 'with-debt' && !this.hasPatientDebt(patient)) {
        return false;
      }
      if (this.selectedDebtFilter === 'without-debt' && this.hasPatientDebt(patient)) {
        return false;
      }
      if (this.selectedPatientGroupFilter !== 'all') {
        const patientGroupId = this.getPatientGroupId(patient);
        if (String(patientGroupId ?? '') !== this.selectedPatientGroupFilter) {
          return false;
        }
      }
      const createdAt = this.extractCreatedDate(patient);
      if (this.createdDateFrom && (!createdAt || createdAt < this.createdDateFrom)) {
        return false;
      }
      if (this.createdDateTo && (!createdAt || createdAt > this.createdDateTo)) {
        return false;
      }
      return true;
    });
  }

  applyRegistryFilters(): void {
    this.closeFilterDropdowns();
    this.createdDateFrom = this.structToIsoDate(this.pendingCreatedDateFromStruct);
    this.createdDateTo = this.structToIsoDate(this.pendingCreatedDateToStruct);
    this.selectedPatientGroupFilter = this.pendingPatientGroupFilter || 'all';
    this.selectedDebtFilter = this.pendingDebtFilter || 'all';
    this.page = 1;
  }

  clearAdvancedFilters(): void {
    this.closeFilterDropdowns();
    this.pendingCreatedDateFromStruct = null;
    this.pendingCreatedDateToStruct = null;
    this.pendingPatientGroupFilter = 'all';
    this.pendingDebtFilter = 'all';
    this.createdDateFrom = '';
    this.createdDateTo = '';
    this.selectedPatientGroupFilter = 'all';
    this.selectedDebtFilter = 'all';
    this.page = 1;
  }

  private structToIsoDate(value: NgbDateStruct | null): string {
    if (!value?.year || !value?.month || !value?.day) {
      return '';
    }
    return `${value.year}-${String(value.month).padStart(2, '0')}-${String(value.day).padStart(2, '0')}`;
  }

  toggleFilterGroupDropdown(event: MouseEvent): void {
    event.stopPropagation();
    this.filterGroupDropdownOpen = !this.filterGroupDropdownOpen;
    if (this.filterGroupDropdownOpen) {
      this.filterDebtDropdownOpen = false;
    }
  }

  toggleFilterDebtDropdown(event: MouseEvent): void {
    event.stopPropagation();
    this.filterDebtDropdownOpen = !this.filterDebtDropdownOpen;
    if (this.filterDebtDropdownOpen) {
      this.filterGroupDropdownOpen = false;
    }
  }

  closeFilterDropdowns(): void {
    this.filterGroupDropdownOpen = false;
    this.filterDebtDropdownOpen = false;
  }

  selectFilterPatientGroup(value: string | number): void {
    this.pendingPatientGroupFilter = String(value);
    this.closeFilterDropdowns();
  }

  selectFilterDebt(value: 'all' | 'with-debt' | 'without-debt'): void {
    this.pendingDebtFilter = value;
    this.closeFilterDropdowns();
  }

  getPendingPatientGroupLabel(): string {
    if (this.pendingPatientGroupFilter === 'all') {
      return 'All groups';
    }
    const group = this.patientGroupList.find(
      (item) => String(item?.id) === String(this.pendingPatientGroupFilter)
    );
    return group?.groupName || group?.name || 'All groups';
  }

  getPendingDebtLabel(): string {
    return (
      this.debtFilterOptions.find((option) => option.value === this.pendingDebtFilter)?.label ||
      'All patients'
    );
  }

  private extractCreatedDate(patient: any): string | null {
    const raw =
      patient?.createdAt ??
      patient?.dateCreated ??
      patient?.createdDate ??
      patient?.createdOn ??
      patient?.creationDate;
    if (!raw) {
      return null;
    }
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) {
      return null;
    }
    return date.toISOString().slice(0, 10);
  }

  private getPatientGroupId(patient: any): number | string | null {
    return (
      patient?.patientGroup?.id ??
      patient?.patientGroupId ??
      patient?.patientGroup?.patientGroupId ??
      null
    );
  }

  private readonly importTemplateHeaders = [
    'First Name',
    'Second Name',
    'Contact',
    'Gender',
    'Date of Birth',
    'Age',
    'Address',
    'Occupation',
    'Patient Group',
    'Next of Kin Name',
    'Next of Kin Contact',
    'Relationship',
    'Next of Kin Address'
  ];

  private readonly importHeaderAliases: Record<string, string> = {
    sn: '_skip',
    balance: '_skip',
    'first name': 'patientFirstName',
    patientfirstname: 'patientFirstName',
    firstname: 'patientFirstName',
    'second name': 'patientSecondName',
    patientsecondname: 'patientSecondName',
    secondname: 'patientSecondName',
    surname: 'patientSecondName',
    contact: 'patientContact',
    phone: 'patientContact',
    patientcontact: 'patientContact',
    gender: 'patientGender',
    patientgender: 'patientGender',
    'date of birth': 'patientDateOfBirth',
    dateofbirth: 'patientDateOfBirth',
    patientdateofbirth: 'patientDateOfBirth',
    dob: 'patientDateOfBirth',
    age: 'patientAge',
    patientage: 'patientAge',
    address: 'patientAddress',
    patientaddress: 'patientAddress',
    occupation: 'occupation',
    'patient group': 'patientGroup',
    patientgroup: 'patientGroup',
    group: 'patientGroup',
    'next of kin name': 'nextOfKinName',
    nextofkinname: 'nextOfKinName',
    'next of kin contact': 'nextOfKinContact',
    nextofkincontact: 'nextOfKinContact',
    relationship: 'relationship',
    'next of kin address': 'nextOfKinAddress',
    nextofkinaddress: 'nextOfKinAddress',
    patientgroupid: 'patientGroupId'
  };

  openImportModal(): void {
    this.resetImportState();
    this.showImportModal = true;
    document.body.style.overflow = 'hidden';
  }

  closeImportModal(): void {
    if (this.importUploading) {
      return;
    }
    this.showImportModal = false;
    this.resetImportState();
    document.body.style.overflow = '';
  }

  private resetImportState(): void {
    this.importPreviewRows = [];
    this.importFileName = '';
    this.importParseError = '';
  }

  downloadImportTemplate(): void {
    const sampleRow = {
      'First Name': 'John',
      'Second Name': 'Doe',
      'Contact': '0700123456',
      'Gender': 'Male',
      'Date of Birth': '1990-05-15',
      'Age': 35,
      'Address': 'Kampala',
      'Occupation': 'Teacher',
      'Patient Group': '',
      'Next of Kin Name': 'Jane Doe',
      'Next of Kin Contact': '0700654321',
      'Relationship': 'Spouse',
      'Next of Kin Address': 'Kampala'
    };

    const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet([sampleRow], { header: this.importTemplateHeaders });
    const wb: XLSX.WorkBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Patients');
    XLSX.writeFile(wb, 'patient-import-template.xlsx');
  }

  onImportFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    this.importFileName = file.name;
    this.importParseError = '';
    this.importPreviewRows = [];

    const reader = new FileReader();
    reader.onload = (e: ProgressEvent<FileReader>) => {
      try {
        const data = e.target?.result;
        if (!data) {
          this.importParseError = 'Could not read the selected file.';
          return;
        }

        let workbook: XLSX.WorkBook;
        if (file.name.toLowerCase().endsWith('.csv')) {
          const text = typeof data === 'string' ? data : new TextDecoder().decode(data as ArrayBuffer);
          workbook = XLSX.read(text, { type: 'string' });
        } else {
          workbook = XLSX.read(data, { type: 'array' });
        }

        const sheetName = workbook.SheetNames[0];
        if (!sheetName) {
          this.importParseError = 'The file has no worksheets.';
          return;
        }

        const sheet = workbook.Sheets[sheetName];
        const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });
        if (!rawRows.length) {
          this.importParseError = 'No patient rows found. Use the template and add data from row 2.';
          return;
        }

        this.importPreviewRows = rawRows.map((row, index) => this.buildImportPreviewRow(row, index + 2));
      } catch {
        this.importParseError = 'Failed to parse file. Please use the provided Excel template.';
      } finally {
        input.value = '';
      }
    };

    if (file.name.toLowerCase().endsWith('.csv')) {
      reader.readAsText(file);
    } else {
      reader.readAsArrayBuffer(file);
    }
  }

  get importValidRows(): any[] {
    return this.importPreviewRows.filter(row => row.isValid).map(row => row.data);
  }

  get importInvalidCount(): number {
    return this.importPreviewRows.filter(row => !row.isValid).length;
  }

  uploadImportedPatients(): void {
    const payload = this.importValidRows;
    if (!payload.length) {
      this.showGlobalError('No valid patient rows to import. Fix errors in the preview first.');
      return;
    }

    this.importUploading = true;
    this.api.addBulkPatients(payload).subscribe({
      next: (res: any) => {
        this.importUploading = false;
        const message = res?.message || `Imported ${payload.length} patient(s) successfully.`;
        this.showGlobalSuccess(message);
        this.closeImportModal();
        this.initializeTableData();
      },
      error: (err: any) => {
        this.importUploading = false;
        this.showGlobalError(err?.error?.message || 'Failed to import patients. Check the file and try again.');
      }
    });
  }

  private buildImportPreviewRow(raw: Record<string, any>, rowNumber: number) {
    const normalized = this.normalizeImportRow(raw);
    const errors: string[] = [];
    const warnings: string[] = [];

    const patientFirstName = this.cleanImportText(normalized['patientFirstName']);
    const patientSecondName = this.cleanImportText(normalized['patientSecondName']);
    const patientContact = this.cleanImportText(normalized['patientContact']);
    const patientGender = this.normalizeImportGender(normalized['patientGender']);

    if (!patientFirstName) {
      errors.push('First Name is required');
    }
    if (!patientSecondName) {
      errors.push('Second Name is required');
    }
    if (!patientContact) {
      errors.push('Contact is required');
    }
    if (!patientGender) {
      errors.push('Gender is required (Male, Female, or Other)');
    }

    const patientAge = this.parseImportAge(normalized['patientAge']);
    const formattedDate = this.formatImportDate(normalized['patientDateOfBirth']);
    const patientGroupName = this.cleanImportText(normalized['patientGroup']);
    let patientGroupId: number | null = null;
    if (normalized['patientGroupId'] !== undefined && normalized['patientGroupId'] !== '') {
      const parsedId = Number(normalized['patientGroupId']);
      patientGroupId = Number.isFinite(parsedId) ? parsedId : null;
    } else {
      patientGroupId = this.resolveImportPatientGroupId(patientGroupName);
    }

    if (patientGroupName && patientGroupId == null) {
      warnings.push(`Patient group "${patientGroupName}" not found — patient will be saved without a group`);
    }

    const data = {
      patientFirstName,
      patientSecondName,
      patientAddress: this.cleanImportText(normalized['patientAddress']),
      patientContact,
      patientGender,
      patientDateOfBirth: formattedDate,
      patientAge,
      occupation: this.cleanImportText(normalized['occupation']),
      nextOfKinName: this.cleanImportText(normalized['nextOfKinName']),
      nextOfKinContact: this.cleanImportText(normalized['nextOfKinContact']),
      relationship: this.cleanImportText(normalized['relationship']),
      nextOfKinAddress: this.cleanImportText(normalized['nextOfKinAddress']),
      patientGroupId,
      userRole: this.userRole || null
    };

    return {
      rowNumber,
      data,
      errors,
      warnings,
      isValid: errors.length === 0
    };
  }

  private normalizeImportRow(raw: Record<string, any>): Record<string, unknown> {
    const normalized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(raw)) {
      const field = this.resolveImportHeader(key);
      if (!field || field === '_skip') {
        continue;
      }
      if (normalized[field] === undefined || normalized[field] === '') {
        normalized[field] = value;
      }
    }
    return normalized;
  }

  private resolveImportHeader(header: string): string | null {
    const key = String(header || '').trim().toLowerCase().replace(/\s+/g, ' ');
    if (!key) {
      return null;
    }
    if (this.importHeaderAliases[key]) {
      return this.importHeaderAliases[key];
    }
    const compact = key.replace(/\s+/g, '');
    return this.importHeaderAliases[compact] || null;
  }

  private cleanImportText(value: any): string {
    if (value === undefined || value === null) {
      return '';
    }
    return String(value).trim();
  }

  private normalizeImportGender(value: any): string {
    const raw = this.cleanImportText(value).toLowerCase();
    if (!raw) {
      return '';
    }
    if (raw === 'm' || raw === 'male') {
      return 'Male';
    }
    if (raw === 'f' || raw === 'female') {
      return 'Female';
    }
    if (raw === 'other') {
      return 'Other';
    }
    const title = raw.charAt(0).toUpperCase() + raw.slice(1);
    return ['Male', 'Female', 'Other'].includes(title) ? title : '';
  }

  private parseImportAge(value: any): number | null {
    if (value === undefined || value === null || value === '') {
      return null;
    }
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  }

  private formatImportDate(value: any): string | null {
    if (value === undefined || value === null || value === '') {
      return null;
    }

    if (typeof value === 'number' && value > 20000) {
      const excelEpoch = new Date(Date.UTC(1899, 11, 30));
      const date = new Date(excelEpoch.getTime() + value * 86400000);
      if (!Number.isNaN(date.getTime())) {
        return this.toBackendDateString(date);
      }
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      const slashMatch = trimmed.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
      if (slashMatch) {
        const year = Number(slashMatch[1]);
        const month = Number(slashMatch[2]);
        const day = Number(slashMatch[3]);
        return `${year}/${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}`;
      }
      const date = new Date(trimmed);
      if (!Number.isNaN(date.getTime())) {
        return this.toBackendDateString(date);
      }
    }

    return null;
  }

  private toBackendDateString(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}/${month}/${day}`;
  }

  private resolveImportPatientGroupId(groupName: string): number | null {
    if (!groupName) {
      return null;
    }
    const query = groupName.toLowerCase();
    const match = this.patientGroupList.find(group => {
      const name = (group.groupName || group.name || '').toLowerCase();
      const shortForm = (group.groupNameShortForm || '').toLowerCase();
      return name === query || shortForm === query;
    });
    return match?.id != null ? Number(match.id) : null;
  }

  // Export methods
  toggleExportDropdown(event: MouseEvent): void {
    event.stopPropagation();
    this.exportDropdownOpen = !this.exportDropdownOpen;
  }

  closeExportDropdown(): void {
    this.exportDropdownOpen = false;
  }

  exportFilteredPatients(format: 'excel' | 'pdf'): void {
    this.closeExportDropdown();
    if (!this.filteredPatientList.length) {
      this.showGlobalInfo('No patients to export for the current filters.');
      return;
    }
    if (format === 'excel') {
      this.exportToExcel();
      return;
    }
    this.downloadPdf();
  }

  exportToExcel() {
    const dataToExport = this.filteredPatientList.map((patient, index) => ({
      'SN': index + 1,
      'First Name': patient.patientFirstName || patient.firstName || '',
      'Second Name': patient.patientSecondName || patient.secondName || '',
      'Contact': patient.patientContact || patient.phone || '',
      'Gender': patient.patientGender || patient.gender || '',
      'Date of Birth': patient.patientDateOfBirth || patient.dateOfBirth || '',
      'Age': patient.patientAge ?? '',
      'Address': patient.patientAddress || patient.address || '',
      'Occupation': patient.occupation || '',
      'Patient Group': (patient.patientGroup?.groupName || patient.patientGroup || ''),
      'Next of Kin Name': patient.nextOfKinName || '',
      'Next of Kin Contact': patient.nextOfKinContact || '',
      'Relationship': patient.relationship || '',
      'Next of Kin Address': patient.nextOfKinAddress || '',
      'Balance': this.formatPatientBalance(patient)
    }));

    const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(dataToExport);
    const wb: XLSX.WorkBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Patients');
    XLSX.writeFile(wb, 'patients.xlsx');
  }

  downloadPdf() {
    const data = this.htmlData.nativeElement;
    html2canvas(data).then(canvas => {
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 208;
      const pageHeight = 295;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      pdf.save('patients.pdf');
    });
  }

  // Patient modal methods
  openPatientModal() {
    this.clearFormNewPatient();
    this.isCollapsedNewPatient = false;
    document.body.style.overflow = 'hidden';
  }

  clearFormNewPatient() {
    this.currentPatient = {
      patientFirstName: '',
      patientSecondName: '',
      patientAddress: '',
      patientContact: defaultContactValue(),
      patientGender: '',
      bloodGroup: '',
      patientDateOfBirth: '',
      patientAge: null,
      occupation: '',
      nextOfKinName: '',
      nextOfKinContact: defaultContactValue(),
      relationship: '',
      nextOfKinAddress: '',
      patientGroupId: null,
      patientGroup: '' // For display only
    };
    // Reset patient group dropdown
    this.closePatientGroupDropdown();
    this.saveButtonStatus = "Add New Patient";
    this.showDivAddToDataBaseNewPatient = false;
    this.showDivUpdatedLoaderNewPatient = false;
    this.isButtonDisabled = false;
    this.isEditingPatient = false;
    this.editingPatientId = null;
  }

  closePatientModal() {
    this.isCollapsedNewPatient = true;
    document.body.style.overflow = '';
    this.clearFormNewPatient();
  }

  editPatient(patient: any) {
    if (!patient || !patient.id) {
      console.error('Invalid patient data for editing');
      return;
    }

    this.closeActionDropdown();
    this.isEditingPatient = true;
    this.editingPatientId = patient.id;
    const resolvedGroupId =
      patient?.patientGroup?.id ||
      patient?.patientGroupId ||
      patient?.patientGroup?.patientGroupId ||
      (typeof patient?.patientGroup === 'number' ? patient.patientGroup : null);

    const groupFromObject =
      (typeof patient?.patientGroup === 'object' &&
        (patient.patientGroup?.groupName || patient.patientGroup?.name)) ||
      '';
    const groupFromString =
      typeof patient?.patientGroup === 'string' ? patient.patientGroup : '';
    const resolvedGroupName =
      groupFromObject ||
      groupFromString ||
      this.resolvePatientGroupDisplayName(resolvedGroupId);

    this.currentPatient = {
      patientFirstName: patient.patientFirstName || patient.firstName || '',
      patientSecondName: patient.patientSecondName || patient.secondName || '',
      patientAddress: patient.patientAddress || patient.address || '',
      patientContact: patient.patientContact || patient.phone || '',
      patientGender: patient.patientGender || patient.gender || '',
      bloodGroup: patient.bloodGroup || '',
      patientDateOfBirth: patient.patientDateOfBirth || patient.dateOfBirth || '',
      patientAge: patient.patientAge || null,
      occupation: patient.occupation || '',
      nextOfKinName: patient.nextOfKinName || '',
      nextOfKinContact: patient.nextOfKinContact || '',
      relationship: patient.relationship || '',
      nextOfKinAddress: patient.nextOfKinAddress || '',
      patientGroupId: resolvedGroupId,
      patientGroup: resolvedGroupName // For display
    };

    if (resolvedGroupId && !resolvedGroupName) {
      this.loadPatientGroupDisplayById(resolvedGroupId);
    }
    this.saveButtonStatus = "Update Patient";
    this.showDivAddToDataBaseNewPatient = false;
    this.showDivUpdatedLoaderNewPatient = false;
    this.isButtonDisabled = false;
    this.isCollapsedNewPatient = false;
    document.body.style.overflow = 'hidden';
  }

  /** Row click opens patient visit (same as Consultation); ignores checkbox and actions column. */
  onPatientTableRowClick(patient: any, event: MouseEvent): void {
    const el = event.target as HTMLElement | null;
    if (!el || !patient?.id) {
      return;
    }
    if (this.consultationLoadingPatientId === patient.id) {
      return;
    }
    if (
      el.closest('input[type="checkbox"]') ||
      el.closest('.patient-row-select-cell') ||
      el.closest('.patient-row-actions-cell')
    ) {
      return;
    }
    this.openConsultation(patient);
  }

  openPatientDetails(patient: any) {
    if (!patient?.id) {
      console.error('Invalid patient data for details view');
      return;
    }
    this.closeActionDropdown();
    this.patientDetailsRecord = {
      ...this.buildPatientItemForPatientVisit(patient),
      totalBalanceDue: patient.totalBalanceDue
    };
    this.showPatientDetailsModal = true;
    document.body.style.overflow = 'hidden';
  }

  closePatientDetailsModal() {
    this.showPatientDetailsModal = false;
    this.patientDetailsRecord = null;
    document.body.style.overflow = '';
  }

  /**
   * Same flow as `patient.component.ts` → `patientDetails`: latest visit + full patient row in sessionStorage, then `/#/overview/consultation-v2`.
   */
  openConsultation(patient: any) {
    if (!patient || !patient.id) {
      console.error('Invalid patient data for consultation');
      return;
    }

    this.closeActionDropdown();
    this.consultationLoadingPatientId = patient.id;

    const item = this.buildPatientItemForPatientVisit(patient);

    this.api.getInitialVisitForPatientId(patient.id).subscribe({
      next: (visitRes) => {
        const initialVisit = visitRes != null && typeof visitRes === 'object' && visitRes.id != null ? visitRes : {};
        sessionStorage.setItem('item', JSON.stringify(item));
        sessionStorage.setItem('initialPatientVisit', JSON.stringify(initialVisit));
        this.consultationLoadingPatientId = null;
        this.router.navigate(['/overview/consultation-v2']);
      },
      error: () => {
        sessionStorage.setItem('item', JSON.stringify(item));
        sessionStorage.setItem('initialPatientVisit', JSON.stringify({}));
        this.consultationLoadingPatientId = null;
        this.router.navigate(['/overview/consultation-v2']);
      }
    });
  }

  /**
   * Shape expected by `PatientVisitComponent.loadPatientDataFromItem` (aligned with patient list / edit form).
   */
  private buildPatientItemForPatientVisit(patient: any): any {
    const resolvedGroupId =
      patient?.patientGroup?.id ||
      patient?.patientGroupId ||
      patient?.patientGroup?.patientGroupId ||
      (typeof patient?.patientGroup === 'number' ? patient.patientGroup : null);

    const groupFromObject =
      (typeof patient?.patientGroup === 'object' &&
        (patient.patientGroup?.groupName ||
          patient.patientGroup?.name ||
          patient.patientGroup?.groupNameShortForm)) ||
      '';
    const groupFromString =
      typeof patient?.patientGroup === 'string' ? patient.patientGroup : '';

    const resolvedGroupName =
      patient.patientGroupName ||
      patient.groupName ||
      patient.groupNameShortForm ||
      groupFromObject ||
      groupFromString ||
      '';

    return {
      ...patient,
      id: patient.id,
      patientId: patient.id,
      patientFirstName: patient.patientFirstName || patient.firstName || '',
      patientSecondName: patient.patientSecondName || patient.secondName || '',
      patientProfilePic:
        patient.patientProfilePic || patient.profilePic || 'assets/images/vector.jpeg',
      patientFileNo:
        patient.patientFileNo || patient.fileNo || patient.patientFileNumber || '',
      patientContact:
        patient.patientContact || patient.phone || patient.patientPhone || '',
      patientGender: patient.patientGender || patient.gender || '',
      bloodGroup: patient.bloodGroup || '',
      patientAddress: patient.patientAddress || patient.address || '',
      patientAge: patient.patientAge ?? patient.age ?? null,
      patientDateOfBirth: patient.patientDateOfBirth || patient.dateOfBirth || '',
      occupation: patient.occupation || '',
      nextOfKinName: patient.nextOfKinName || '',
      nextOfKinContact: patient.nextOfKinContact || '',
      nextOfKinAddress: patient.nextOfKinAddress || '',
      relationship: patient.relationship || '',
      diagnosis: patient.diagnosis || '',
      patientGroupId: resolvedGroupId,
      patientGroupName: resolvedGroupName
    };
  }

  savePatient(data: any) {
    this.showDivUpdatedLoaderNewPatient = true;
    this.isButtonDisabled = true;
    this.showDivAddToDataBaseNewPatient = false;

    // Format date to yyyy/MM/dd format expected by backend
    let formattedDate = null;
    if (data.patientDateOfBirth) {
      if (typeof data.patientDateOfBirth === 'string') {
        // If it's already a string, try to format it
        const date = new Date(data.patientDateOfBirth);
        if (!isNaN(date.getTime())) {
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          formattedDate = `${year}/${month}/${day}`;
        }
      } else if (data.patientDateOfBirth.year) {
        // Handle date picker object format
        const { year, month, day } = data.patientDateOfBirth;
        formattedDate = `${year}/${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}`;
      }
    }

    // Convert age to number if provided
    let patientAge = null;
    if (data.patientAge !== undefined && data.patientAge !== null && data.patientAge !== '') {
      patientAge = Number(data.patientAge);
    }

    const patientData = {
      patientFirstName: data.patientFirstName || '',
      patientSecondName: data.patientSecondName || '',
      patientAddress: data.patientAddress || '',
      patientContact: data.patientContact || '',
      patientGender: data.patientGender || '',
      bloodGroup: data.bloodGroup || '',
      patientDateOfBirth: formattedDate,
      patientAge: patientAge,
      occupation: data.occupation || '',
      nextOfKinName: data.nextOfKinName || '',
      nextOfKinContact: data.nextOfKinContact || '',
      relationship: data.relationship || '',
      nextOfKinAddress: data.nextOfKinAddress || '',
      patientGroupId: this.currentPatient?.patientGroupId || null,
      userRole: this.userRole || null
    };

    console.log("Patient data to save:", patientData);

    if (this.isEditingPatient && this.editingPatientId) {
      // Update existing patient
      this.api.updatePatientById(this.editingPatientId, patientData).subscribe({
        next: (response: any) => {
          console.log("Patient updated successfully:", response);
          this.showDivUpdatedLoaderNewPatient = false;
          this.isButtonDisabled = false;
          this.responseColor = 'rgb(11, 155, 112)';
          this.responseMessage = response.message || "Patient updated successfully!";
          this.showDivAddToDataBaseNewPatient = true;
          this.showGlobalSuccess(this.responseMessage);
          
          // Reload patient list
          this.initializeTableData();
          
          setTimeout(() => {
            this.showDivAddToDataBaseNewPatient = false;
            this.closePatientModal();
            this.isEditingPatient = false;
            this.editingPatientId = null;
          }, 2000);
        },
        error: (error: any) => {
          console.error("Error updating patient:", error);
          this.showDivUpdatedLoaderNewPatient = false;
          this.isButtonDisabled = false;
          this.responseColor = 'rgb(238, 16, 16)';
          this.responseMessage = error.error?.message || "Error updating patient. Please try again.";
          this.showDivAddToDataBaseNewPatient = true;
          this.showGlobalError(this.responseMessage);
          
          setTimeout(() => {
            this.showDivAddToDataBaseNewPatient = false;
          }, 4000);
        }
      });
    } else {
      // Create new patient
      this.api.addPatient(patientData).subscribe({
        next: (response: any) => {
          console.log("Patient saved successfully:", response);
          this.showDivUpdatedLoaderNewPatient = false;
          this.isButtonDisabled = false;
          this.responseColor = 'rgb(11, 155, 112)';
          this.responseMessage = response.message || "Patient added successfully!";
          this.showDivAddToDataBaseNewPatient = true;
          this.showGlobalSuccess(this.responseMessage);
          
          // Reload patient list
          this.initializeTableData();
          
          setTimeout(() => {
            this.showDivAddToDataBaseNewPatient = false;
            this.closePatientModal();
          }, 2000);
        },
        error: (error: any) => {
          console.error("Error saving patient:", error);
          this.showDivUpdatedLoaderNewPatient = false;
          this.isButtonDisabled = false;
          this.responseColor = 'rgb(238, 16, 16)';
          this.responseMessage = error.error?.message || "Error saving patient. Please try again.";
          this.showDivAddToDataBaseNewPatient = true;
          this.showGlobalError(this.responseMessage);
          
          setTimeout(() => {
            this.showDivAddToDataBaseNewPatient = false;
          }, 4000);
        }
      });
    }
  }

  onPageChange(page: number) {
    this.page = page;
  }

  onSearchQueryChange(query: string) {
    this.searchQuery = query;
    this.page = 1; // Reset to first page when searching
  }

  private patientMatchesRegistrySearch(
    patient: any,
    searchText: string,
    digitsQuery: string
  ): boolean {
    const groupName =
      typeof patient?.patientGroup === 'string'
        ? patient.patientGroup
        : patient?.patientGroup?.groupName || '';
    const textFields = [
      patient?.patientFirstName || patient?.firstName,
      patient?.patientSecondName || patient?.secondName,
      patient?.patientOtherName || patient?.otherName || patient?.lastName,
      patient?.nextOfKinName,
      patient?.patientAddress || patient?.address,
      patient?.nextOfKinAddress,
      patient?.patientFileNo || patient?.fileNo || patient?.patientFileNumber,
      patient?.patientNo,
      patient?.patientContact || patient?.phone || patient?.patientPhone,
      patient?.nextOfKinContact,
      patient?.patientGender || patient?.gender,
      groupName,
      this.formatPatientBalance(patient),
    ];
    if (textFields.some((value) => this.valueMatchesSearch(value, searchText, digitsQuery))) {
      return true;
    }
    const fullName = `${patient?.patientFirstName || patient?.firstName || ''} ${
      patient?.patientSecondName || patient?.secondName || ''
    }`.toLowerCase();
    return fullName.includes(searchText);
  }

  private valueMatchesSearch(value: any, searchText: string, digitsQuery: string): boolean {
    if (value == null || value === '') {
      return false;
    }
    const text = String(value).toLowerCase();
    if (text.includes(searchText)) {
      return true;
    }
    if (digitsQuery.length >= 2) {
      const digits = text.replace(/\D/g, '');
      return !!digits && digits.includes(digitsQuery);
    }
    return false;
  }

  onSelectedColumnChange(column: string) {
    this.selectedColumn = column;
    this.page = 1; // Reset to first page when filtering
  }

  get totalItemsCount(): number {
    return this.patientList.length;
  }

  getFullName(patient: any): string {
    const firstName = patient.patientFirstName || patient.firstName || '';
    const secondName = patient.patientSecondName || patient.secondName || '';
    
    // Capitalize first letter of each name part
    const capitalizeFirst = (str: string): string => {
      if (!str) return '';
      return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    };
    
    const capitalizedFirstName = capitalizeFirst(firstName);
    const capitalizedSecondName = capitalizeFirst(secondName);
    
    const parts = [capitalizedFirstName, capitalizedSecondName].filter(p => p);
    return parts.length > 0 ? parts.join(' ') : 'N/A';
  }

  getInitials(patient: any): string {
    const firstName = patient.patientFirstName || patient.firstName || '';
    const secondName = patient.patientSecondName || patient.secondName || '';
    const firstInitial = firstName.charAt(0).toUpperCase();
    const secondInitial = secondName.charAt(0).toUpperCase();
    return firstInitial + (secondInitial || '');
  }

  getAvatarColor(patient: any): string {
    const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444', '#6366f1', '#14b8a6'];
    const name = this.getFullName(patient);
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  }

  formatDate(date: string): string {
    if (!date) return '';
    try {
      const d = new Date(date);
      const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
    } catch {
      return date;
    }
  }

  formatPhone(phone: string): string {
    if (!phone) {
      return '';
    }
    const cleaned = String(phone).replace(/\D/g, '');
    if (!cleaned) {
      return String(phone).replace(/^\+\s*/, '').trim();
    }
    if (cleaned.startsWith('256') && cleaned.length > 3) {
      return `256 ${cleaned.slice(3)}`;
    }
    return cleaned;
  }

  getPatientId(index: number): string {
    const id = (this.page - 1) * this.itemsPerPage + index + 1;
    return 'PS' + String(id).padStart(5, '0');
  }
}
