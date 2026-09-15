import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { ApiService } from '../../../../services/api.service';
import { PatientDisplayService } from '../../../../services/patient-display.service';
import { isMaternityProcedureRequest } from '../../../../utils/lab-results-docx.util';

@Component({
  selector: 'app-maternal-child-health-requests',
  templateUrl: './maternal-child-health-requests.component.html',
  styleUrls: ['../../../../lab/lab.component.css', './maternal-child-health-requests.component.css']
})
export class MaternalChildHealthRequestsComponent implements OnInit {
  scanRequestsList: any[] = [];
  selectedScanRequest: any = null;
  searchText = '';
  isLoadingPatientVisits = false;

  currentPatientVisit = 'Maternity procedure requests';
  visitType = 'outpatient';
  visitSaveButtonStatus = 'Save Visit';
  patientId: any = '';

  patientFirstName = '';
  patientSecondName = '';
  patientProfilePic = 'assets/images/vector.jpeg';
  patientFileNo = '';
  patientAge: any = '';
  patientDateOfBirth = '';
  patientContact = '';
  patientGender = '';
  patientAddress = '';
  patientGroupName = '';
  patientOccupation = '';
  nextOfKinName = '';
  nextOfKinContact = '';
  nextOfKinAddress = '';
  relationship = '';
  diagnosis = '';
  userName = '';

  generalUs: any = {
    labReportTitle: '',
    notes: '',
    recommendation: ''
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

  scanReportId: any = null;
  showSaveMessage = false;
  saveMessage = '';
  saveMessageColor = '';

  constructor(
    private api: ApiService,
    private patientDisplay: PatientDisplayService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    const item = JSON.parse(sessionStorage.getItem('item') || '{}');
    this.patientId = item.id ?? '';
    this.patientFirstName = item.patientFirstName ?? '';
    this.patientSecondName = item.patientSecondName ?? '';
    this.patientFileNo = item.patientFileNo ?? '';
    this.userName = sessionStorage.getItem('username') || '';
    this.loadScanRequests();
  }

  createNewPatientVisits(pid: any): void {
    this.visitSaveButtonStatus = 'Save Visit';
    this.patientId = pid;
    this.visitType = 'outpatient';
  }

  loadScanRequests(): void {
    this.isLoadingPatientVisits = true;
    const selectedId = this.selectedScanRequest?.id;
    this.api.getAllMaternityProceduresRequested().subscribe({
      next: (res: any) => {
        const list = Array.isArray(res) ? res : [];
        this.scanRequestsList = list;
        this.patientDisplay.refreshPatientDirectory().subscribe(() => {
          this.cdr.detectChanges();
        });
        if (selectedId) {
          const match = this.filteredMaternityRequests().find((r: any) => r.id === selectedId);
          if (match) this.selectedScanRequest = match;
        }
        this.isLoadingPatientVisits = false;
      },
      error: () => {
        this.scanRequestsList = [];
        this.isLoadingPatientVisits = false;
      }
    });
  }

  filteredMaternityRequests(): any[] {
    const maternityOnly = this.scanRequestsList.filter(isMaternityProcedureRequest);
    const source = maternityOnly.length ? maternityOnly : this.scanRequestsList;
    if (!this.searchText?.trim()) {
      return [...source].sort(
        (a, b) => (b.visitNumber ?? b.id ?? 0) - (a.visitNumber ?? a.id ?? 0)
      );
    }
    const q = this.searchText.toLowerCase();
    return source
      .filter(
        r =>
          (this.getRequestPatientName(r) || '').toLowerCase().includes(q) ||
          (r.procedureRequestedName || '').toLowerCase().includes(q) ||
          (r.report || '').toLowerCase().includes(q) ||
          (r.exam || '').toLowerCase().includes(q) ||
          String(r.dateOfProcedure || '')
            .toLowerCase()
            .includes(q)
      )
      .sort((a, b) => (b.visitNumber ?? b.id ?? 0) - (a.visitNumber ?? a.id ?? 0));
  }

  selectScanRequest(scanRequest: any): void {
    this.selectedScanRequest = scanRequest;
    if (!scanRequest) return;

    this.patientFirstName =
      scanRequest.patientFirstName ||
      scanRequest.patient?.patientFirstName ||
      scanRequest.visit?.patient?.patientFirstName ||
      this.patientFirstName ||
      '';
    this.patientSecondName =
      scanRequest.patientSecondName ||
      scanRequest.patient?.patientSecondName ||
      scanRequest.visit?.patient?.patientSecondName ||
      '';

    this.patientProfilePic =
      scanRequest.visit?.patient?.patientProfilePic ||
      scanRequest.patientProfilePic ||
      scanRequest.patient?.patientProfilePic ||
      'assets/images/vector.jpeg';

    this.patientFileNo =
      scanRequest.visit?.patient?.patientFileNo ||
      scanRequest.patientFileNo ||
      scanRequest.patient?.patientFileNo ||
      this.patientFileNo ||
      '';
    this.patientId =
      scanRequest.visit?.patient?.id ||
      scanRequest.patientId ||
      scanRequest.patient?.id ||
      this.patientId ||
      '';

    this.patientAge =
      scanRequest.patientAge ||
      scanRequest.patient?.patientAge ||
      scanRequest.visit?.patient?.patientAge ||
      '';
    this.patientDateOfBirth =
      scanRequest.patientDateOfBirth ||
      scanRequest.visit?.patient?.patientDateOfBirth ||
      '';
    this.patientContact =
      scanRequest.visit?.patient?.patientContact ||
      scanRequest.patientContact ||
      '';
    this.patientGender =
      scanRequest.patientGender ||
      scanRequest.visit?.patient?.patientGender ||
      '';
    this.patientAddress =
      scanRequest.patientAddress ||
      scanRequest.visit?.patient?.patientAddress ||
      '';
    this.patientGroupName =
      scanRequest.visit?.patient?.patientGroupName ||
      scanRequest.patientGroupName ||
      '';
    this.patientOccupation =
      scanRequest.patientOccupation ||
      scanRequest.visit?.patient?.patientOccupation ||
      '';
    this.nextOfKinName =
      scanRequest.nextOfKinName || scanRequest.visit?.patient?.nextOfKinName || '';
    this.nextOfKinContact =
      scanRequest.nextOfKinContact || scanRequest.visit?.patient?.nextOfKinContact || '';
    this.nextOfKinAddress =
      scanRequest.nextOfKinAddress || scanRequest.visit?.patient?.nextOfKinAddress || '';
    this.relationship =
      scanRequest.relationship || scanRequest.visit?.patient?.relationship || '';
    this.diagnosis =
      scanRequest.diagnosis ||
      scanRequest.patient?.diagnosis ||
      scanRequest.visit?.patient?.diagnosis ||
      '';

    this.refreshSelectedPatientFromEntity(scanRequest);
    this.loadGeneralReportForRequest(scanRequest);
  }

  getRequestPatientName(request: any): string {
    return this.patientDisplay.getDisplayName(request);
  }

  private applyPatientProfileFromEntity(patient: any): void {
    if (!patient) {
      return;
    }

    this.patientFirstName = patient.patientFirstName || '';
    this.patientSecondName = patient.patientSecondName || '';
    this.patientFileNo = patient.patientFileNo || this.patientFileNo || '';
    this.patientContact = patient.patientContact || this.patientContact || '';
    this.patientAge = patient.patientAge || this.patientAge || '';
    this.patientDateOfBirth = patient.patientDateOfBirth || this.patientDateOfBirth || '';
    this.patientGender = patient.patientGender || this.patientGender || '';
    this.patientAddress = patient.patientAddress || this.patientAddress || '';
    this.patientGroupName = patient.patientGroupName || this.patientGroupName || '';
    this.patientOccupation = patient.patientOccupation || this.patientOccupation || '';
    this.nextOfKinName = patient.nextOfKinName || this.nextOfKinName || '';
    this.nextOfKinContact = patient.nextOfKinContact || this.nextOfKinContact || '';
    this.nextOfKinAddress = patient.nextOfKinAddress || this.nextOfKinAddress || '';
    this.relationship = patient.relationship || this.relationship || '';
    this.diagnosis = patient.diagnosis || this.diagnosis || '';

    if (patient.patientProfilePic) {
      this.patientProfilePic = patient.patientProfilePic;
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

  private resetMchForm(): void {
    Object.keys(this.mchForm).forEach(k => (this.mchForm[k] = ''));
    this.generalUs.labReportTitle = '';
    this.generalUs.notes = '';
    this.generalUs.recommendation = '';
    this.scanReportId = null;
  }

  loadGeneralReportForRequest(scanRequest: any): void {
    this.isLoadingPatientVisits = true;
    this.api.getGeneralLabReportByRequestId(scanRequest.id).subscribe({
      next: (raw: any) => {
        this.isLoadingPatientVisits = false;
        const report = raw?.data ?? raw ?? {};
        if (
          !report?.id ||
          (typeof report?.message === 'string' &&
            report.message.toLowerCase().includes('not found'))
        ) {
          this.resetMchForm();
          return;
        }
        this.scanReportId = report.id;
        this.generalUs.labReportTitle = report.labReportTitle || '';
        this.generalUs.notes = report.notes || '';
        this.generalUs.recommendation = report.recommendation || '';
        const text = report.result || report.report || report.findings || '';
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
      },
      error: () => {
        this.isLoadingPatientVisits = false;
        this.resetMchForm();
      }
    });
  }

  saveMchReport(): void {
    if (!this.selectedScanRequest?.id) return;
    const resultPayload = JSON.stringify(this.mchForm);
    const body = {
      doneBy: this.userName,
      result: resultPayload,
      notes: this.generalUs.notes,
      recommendation: this.generalUs.recommendation,
      labReportTitle: this.generalUs.labReportTitle
    };

    const req = this.scanReportId
      ? this.api.updateGeneralLabReport(this.scanReportId, body)
      : this.api.createGeneralLabReportByRequestId(this.selectedScanRequest.id, body);

    req.subscribe({
      next: (res: any) => {
        const data = res?.data ?? res;
        if (data?.id) this.scanReportId = data.id;
        this.saveMessage = res?.message || 'Saved';
        this.saveMessageColor = 'rgb(11, 155, 112)';
        this.showSaveMessage = true;
        this.loadScanRequests();
        setTimeout(() => (this.showSaveMessage = false), 4000);
      },
      error: (err: any) => {
        this.saveMessage =
          err?.error?.message || err?.message || 'Save failed';
        this.saveMessageColor = 'rgb(214, 80, 80)';
        this.showSaveMessage = true;
        setTimeout(() => (this.showSaveMessage = false), 5000);
      }
    });
  }

  printMchReport(): void {
    window.print();
  }

  saveUpDateVisit(): void {
    /* Placeholder — same entry point as lab; extend when visit API is wired */
    this.visitSaveButtonStatus = 'Save Visit';
  }

  toggleCollapseClearFileds(): void {
    this.visitType = 'outpatient';
  }

  getUserFormDataNewVisit(_v: any): void {
    this.saveUpDateVisit();
  }
}
