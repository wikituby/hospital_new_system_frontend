import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from '../../../../services/api.service';
import { ThemeService } from '../../../../services/theme.service';
import {
  ensureFromModuleInList,
  normalizeHospitalModules,
  pickDefaultFromModuleId,
  isQueueDischargeDestination,
  QUEUE_DISCHARGE_DESTINATION_ID,
  queueDestinationOptions,
} from '../../../../utils/queue-module.util';

type ViewTab = 'queues' | 'directory';

@Component({
  selector: 'app-queue-management',
  templateUrl: './queue-management.component.html',
  styleUrls: ['./queue-management.component.css']
})
export class QueueManagementComponent implements OnInit {
  isDarkMode = false;
  activeTab: ViewTab = 'queues';
  departmentFilter: number | null = null;
  isLoading = false;
  isSaving = false;
  responseError = '';

  waitingPatients = 0;
  servingNow = 0;
  completedToday = 0;
  averageWaitTime = 0;

  /** All active modules (From field + department filter). */
  modules: any[] = [];
  /** Destinations the user may send patients to (role / assignment scoped). */
  toModules: any[] = [];
  clinics: any[] = [];
  queueEntries: any[] = [];
  directoryDepartments: any[] = [];
  directoryTotal = 0;
  patients: any[] = [];
  patientGroups: any[] = [];
  private readonly currentRole = (sessionStorage.getItem('userrole') || '').toLowerCase();

  showQueueModal = false;
  showPatientPicker = false;
  patientSearch = '';

  selectedPatient: any = null;
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
    patientVisitId: null as number | null
  };

  readonly QUEUE_DISCHARGE_DESTINATION_ID = QUEUE_DISCHARGE_DESTINATION_ID;
  readonly isQueueDischargeDestination = isQueueDischargeDestination;

  get queueDestinationModules(): any[] {
    return queueDestinationOptions(this.toModules);
  }

  /** Group entries by destination module for queue cards. */
  get queueByDepartment(): { moduleId: number; department: string; status: string; patients: any[] }[] {
    const map = new Map<number, any[]>();
    for (const e of this.queueEntries) {
      const id = e.toModuleId;
      if (!map.has(id)) {
        map.set(id, []);
      }
      map.get(id)!.push({
        ...e,
        name: `${e.patientSurname || ''} ${e.patientOtherNames || ''}`.trim(),
        fileNo: e.patientFileNo,
        waitTime: e.waitMinutes ?? 0
      });
    }
    return Array.from(map.entries()).map(([moduleId, patients]) => ({
      moduleId,
      department: patients[0]?.toModuleName || 'Unknown',
      status: 'active',
      patients: patients.sort((a: any, b: any) => {
        if (!!a.emergency !== !!b.emergency) {
          return a.emergency ? -1 : 1;
        }
        const pa = a.queuePosition ?? 999999;
        const pb = b.queuePosition ?? 999999;
        if (pa !== pb) return pa - pb;
        const da = new Date(a.queuedAt as any).getTime();
        const db = new Date(b.queuedAt as any).getTime();
        return da - db;
      })
    }));
  }

  get filteredQueues() {
    if (this.departmentFilter == null) {
      return this.queueByDepartment;
    }
    return this.queueByDepartment.filter(q => q.moduleId === this.departmentFilter);
  }

  get filteredPatientsForPicker(): any[] {
    const q = this.patientSearch.trim().toLowerCase();
    if (!q) {
      return this.patients.slice(0, 50);
    }
    return this.patients.filter(p => {
      const name = `${p.patientSecondName || ''} ${p.patientFirstName || ''}`.toLowerCase();
      const file = (p.patientFileNo || '').toLowerCase();
      return name.includes(q) || file.includes(q);
    }).slice(0, 50);
  }

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
    this.themeService.isDarkMode$.subscribe(isDark => {
      this.isDarkMode = isDark;
    });
    this.loadModules();
    this.loadPatientGroups();
    this.loadPatients();
    this.refreshQueues();
  }

  loadModules(): void {
    this.api.getAllHospitalModules().subscribe({
      next: (res: any) => {
        const all = normalizeHospitalModules(res);
        const assigned = this.parseAssignedModuleIds();
        this.modules = all;
        if (assigned.length > 0) {
          this.toModules = all.filter((m: any) => assigned.includes(m.id));
        } else {
          this.toModules = all.filter((m: any) => this.isAllowedForCurrentRole(m?.allowedRoles));
        }
        if (!this.toModules.length) {
          this.toModules = all;
        }
        this.queueForm.fromModuleId = ensureFromModuleInList(
          this.queueForm.fromModuleId,
          this.modules
        );
        if (!this.queueForm.fromModuleId) {
          this.queueForm.fromModuleId = pickDefaultFromModuleId(this.modules);
        }
      }
    });
  }

  private parseAssignedModuleIds(): number[] {
    const csv = sessionStorage.getItem('assignedModuleIds') || '';
    if (!csv.trim()) {
      return [];
    }
    return csv
      .split(',')
      .map(s => Number(s.trim()))
      .filter(n => !Number.isNaN(n));
  }

  loadPatientGroups(): void {
    this.api.getAllPatientGroups().subscribe({
      next: (res: any) => {
        this.patientGroups = Array.isArray(res) ? res : [];
      }
    });
  }

  loadPatients(): void {
    this.api.getAllPatients().subscribe({
      next: (res: any) => {
        this.patients = Array.isArray(res) ? res : [];
      }
    });
  }

  onToModuleChange(): void {
    this.queueForm.clinicId = null;
    if (isQueueDischargeDestination(this.queueForm.toModuleId)) {
      this.clinics = [];
      return;
    }
    if (this.queueForm.toModuleId) {
      this.api.getHospitalClinics(this.queueForm.toModuleId).subscribe({
        next: (res: any) => {
          const all = Array.isArray(res) ? res : [];
          this.clinics = all.filter((c: any) => c.active !== false).filter((c: any) => this.isAllowedForCurrentRole(c?.allowedRoles));
        }
      });
    } else {
      this.clinics = [];
    }
  }

  private isAllowedForCurrentRole(allowedRolesCsv: any): boolean {
    // Admins and MDs typically need broad access; keep them unrestricted.
    if (this.currentRole === 'admin' || this.currentRole === 'md') {
      return true;
    }
    if (!allowedRolesCsv || typeof allowedRolesCsv !== 'string' || !allowedRolesCsv.trim()) {
      return true;
    }
    const allowed = allowedRolesCsv
      .split(',')
      .map((s: string) => s.trim().toLowerCase())
      .filter(Boolean);
    return allowed.includes(this.currentRole);
  }

  onSchemeChange(): void {
    const g = this.patientGroups.find(x => x.id === this.queueForm.patientGroupId);
    this.queueForm.visitDefaultScheme = g?.groupName || '';
  }

  refreshQueues(): void {
    this.isLoading = true;
    this.api.getPatientQueueEntries(this.departmentFilter ?? undefined).subscribe({
      next: (res: any) => {
        this.queueEntries = Array.isArray(res) ? res : [];
        this.updateStats();
        this.isLoading = false;
      },
      error: () => {
        this.queueEntries = [];
        this.isLoading = false;
      }
    });
    if (this.activeTab === 'directory') {
      this.loadDirectory();
    }
  }

  loadDirectory(): void {
    this.api.getHospitalDirectory().subscribe({
      next: (res: any) => {
        this.directoryDepartments = res?.departments || [];
        this.directoryTotal = res?.totalPatients ?? 0;
      }
    });
  }

  setTab(tab: ViewTab): void {
    this.activeTab = tab;
    if (tab === 'directory') {
      this.loadDirectory();
    }
  }

  updateStats(): void {
    this.waitingPatients = this.queueEntries.filter(e => e.status === 'WAITING').length;
    this.servingNow = this.queueEntries.filter(e => e.status === 'SERVING' || e.status === 'CALLED').length;
    const waits = this.queueEntries.map(e => e.waitMinutes || 0).filter(w => w > 0);
    this.averageWaitTime = waits.length
      ? Math.round(waits.reduce((a, b) => a + b, 0) / waits.length)
      : 0;
  }

  addToQueue(): void {
    this.selectedPatient = null;
    this.queueForm = {
      fromModuleId: this.queueForm.fromModuleId,
      toModuleId: null,
      clinicId: null,
      note: '',
      visitDefaultScheme: '',
      patientGroupId: null,
      emergency: false,
      revisit: false,
      printQueueTicket: false,
      patientVisitId: null
    };
    this.clinics = [];
    this.showPatientPicker = true;
    this.responseError = '';
  }

  selectPatientForQueue(patient: any): void {
    this.selectedPatient = patient;
    this.showPatientPicker = false;
    this.showQueueModal = true;
    this.queueForm.fromModuleId = ensureFromModuleInList(this.queueForm.fromModuleId, this.modules);
    if (patient.patientGroup?.id) {
      this.queueForm.patientGroupId = patient.patientGroup.id;
      this.queueForm.visitDefaultScheme = patient.patientGroup.groupName || '';
    }
  }

  get patientHeaderAge(): string {
    if (!this.selectedPatient) {
      return '';
    }
    if (this.selectedPatient.patientAge != null) {
      return `${this.selectedPatient.patientAge} yrs`;
    }
    return '';
  }

  submitQueue(): void {
    const isDischarge = isQueueDischargeDestination(this.queueForm.toModuleId);
    if (!this.selectedPatient?.id) {
      this.responseError = 'Select patient';
      return;
    }
    if (!isDischarge && !this.queueForm.fromModuleId) {
      this.responseError = 'Select patient and from department';
      return;
    }
    if (!this.queueForm.toModuleId) {
      this.responseError = 'Select destination';
      return;
    }
    this.isSaving = true;
    this.responseError = '';
    const username = sessionStorage.getItem('username') || '';

    if (isDischarge) {
      this.api.dischargePatientFromQueue({
        patientId: this.selectedPatient.id,
        note: this.queueForm.note,
        dischargedBy: username,
      }).subscribe({
        next: () => {
          this.isSaving = false;
          this.showQueueModal = false;
          this.refreshQueues();
        },
        error: (err: any) => {
          this.isSaving = false;
          this.responseError = err?.error?.message || 'Failed to discharge patient';
        },
      });
      return;
    }

    const scheme = this.queueForm.visitDefaultScheme ||
      this.patientGroups.find(g => g.id === this.queueForm.patientGroupId)?.groupName || '';
    const fromModuleId = this.queueForm.fromModuleId;
    const toModuleId = this.queueForm.toModuleId;
    if (fromModuleId == null || toModuleId == null) {
      this.isSaving = false;
      this.responseError = 'Select From and To departments';
      return;
    }

    this.api.queuePatient({
      patientId: this.selectedPatient.id,
      patientVisitId: this.queueForm.patientVisitId ?? undefined,
      fromModuleId,
      toModuleId,
      clinicId: this.queueForm.clinicId ?? undefined,
      note: this.queueForm.note,
      visitDefaultScheme: scheme,
      patientGroupId: this.queueForm.patientGroupId ?? undefined,
      emergency: this.queueForm.emergency,
      revisit: this.queueForm.revisit,
      queuedBy: sessionStorage.getItem('username') || ''
    }).subscribe({
      next: (entry: any) => {
        this.isSaving = false;
        this.showQueueModal = false;
        if (this.queueForm.printQueueTicket && entry?.queueNumber) {
          this.printTicket(entry);
        }
        this.refreshQueues();
      },
      error: (err: any) => {
        this.isSaving = false;
        this.responseError = err?.error?.message || 'Failed to queue patient';
      }
    });
  }

  printTicket(entry: any): void {
    const w = window.open('', '_blank', 'width=400,height=320');
    if (!w) {
      return;
    }
    const p = this.selectedPatient;
    w.document.write(`
      <html><head><title>Queue Ticket</title></head><body style="font-family:sans-serif;padding:16px">
      <h2>Queue Ticket</h2>
      <p><strong>${entry.queueNumber}</strong></p>
      <p>${p?.patientSecondName || ''} ${p?.patientFirstName || ''}</p>
      <p>OP: ${p?.patientFileNo || ''}</p>
      <p>To: ${entry.toModuleName || ''}</p>
      </body></html>
    `);
    w.document.close();
    w.print();
  }

  callPatient(patient: any): void {
    this.api.callPatientQueueEntry(patient.id).subscribe({ next: () => this.refreshQueues() });
  }

  servePatient(patient: any): void {
    this.api.servePatientQueueEntry(patient.id).subscribe({ next: () => this.refreshQueues() });
  }

  removePatient(patient: any): void {
    if (!confirm('Remove patient from queue?')) {
      return;
    }
    this.api.cancelPatientQueueEntry(patient.id).subscribe({ next: () => this.refreshQueues() });
  }

  completePatient(patient: any): void {
    this.api.completePatientQueueEntry(patient.id).subscribe({ next: () => this.refreshQueues() });
  }

  toggleEmergency(patient: any): void {
    const next = !patient.emergency;
    this.api.updatePatientQueueEntry(patient.id, { emergency: next }).subscribe({
      next: () => this.refreshQueues(),
      error: () => this.refreshQueues(),
    });
  }

  moveUp(patient: any, queue: { patients: any[] }): void {
    const idx = queue.patients.findIndex((p) => p.id === patient.id);
    if (idx <= 0) return;
    const above = queue.patients[idx - 1];
    const curPos = patient.queuePosition ?? idx + 1;
    const abovePos = above.queuePosition ?? idx;
    this.api.updatePatientQueueEntry(patient.id, { queuePosition: abovePos }).subscribe({
      next: () => {
        this.api.updatePatientQueueEntry(above.id, { queuePosition: curPos }).subscribe({
          next: () => this.refreshQueues(),
          error: () => this.refreshQueues(),
        });
      },
      error: () => this.refreshQueues(),
    });
  }

  moveDown(patient: any, queue: { patients: any[] }): void {
    const idx = queue.patients.findIndex((p) => p.id === patient.id);
    if (idx < 0 || idx >= queue.patients.length - 1) return;
    const below = queue.patients[idx + 1];
    const curPos = patient.queuePosition ?? idx + 1;
    const belowPos = below.queuePosition ?? idx + 2;
    this.api.updatePatientQueueEntry(patient.id, { queuePosition: belowPos }).subscribe({
      next: () => {
        this.api.updatePatientQueueEntry(below.id, { queuePosition: curPos }).subscribe({
          next: () => this.refreshQueues(),
          error: () => this.refreshQueues(),
        });
      },
      error: () => this.refreshQueues(),
    });
  }

  callNext(queue: { patients: any[] }): void {
    const next = queue.patients.find(p => p.status === 'WAITING');
    if (next) {
      this.callPatient(next);
    }
  }

  closeModals(): void {
    this.showQueueModal = false;
    this.showPatientPicker = false;
  }
}
