import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { NgForm } from '@angular/forms';
import { ApiService } from '../services/api.service';
import { Router } from '@angular/router';
import { PatientDisplayService } from '../services/patient-display.service';

@Component({
  selector: 'app-lab-mobile-page',
  templateUrl: './lab-mobile-page.component.html',
  styleUrls: ['./lab-mobile-page.component.css']
})
export class LabMobilePageComponent implements OnInit {
  constructor(
    private api: ApiService,
    private router: Router,
    private patientDisplay: PatientDisplayService,
    private cdr: ChangeDetectorRef,
  ) {}

  isSaving = false;
  isLoadingRequests = false;
  message = '';
  messageColor = '#28a745';
  responseMessage = '';
  responseColor = '';
  userName: any;
  showDivUpdatedLoaderconsultation = false;
  showDivAddToDataBaseConsultation = false;
  showDivUpdatedLoaderInvoice = false;

  showDrawer = false;
  searchText = '';
  requests: any[] = [];
  selectedRequest: any = null;
  selectedTestType = '';
  
  // Form visibility flags
  showMrdtForm = false;
  showGeneralForm = false;
  showUrinalysisForm = false;
  showCbcForm = false;
  showParasitologyStoolForm = false;

  // MRDT Form Data
  generalUs: any = {
    bs: '',
    mrdt: '',
    labReportTitle: '',
    test: '',
    notes: '',
    recommendation: '',
    result: ''
  };

  // Urinalysis Form Data
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
    volume: ''
  };

  // CBC Form Data
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
    pct: ''
  };

  // CBC Fields with units and reference ranges
  cbcFields: Array<{ key: string; label: string; unit: string; ref: string }> = [
    { key: 'wbc', label: 'WBC', unit: '10^9/L', ref: '4.0 - 11.0' },
    { key: 'lymph', label: 'LYMPH', unit: '10^9/L', ref: '0.8 - 4.0' },
    { key: 'mid', label: 'MID', unit: '10^9/L', ref: '0.1 - 1.5' },
    { key: 'gran', label: 'GRAN', unit: '10^9/L', ref: '2.0 - 7.5' },
    { key: 'lymphPercent', label: 'LYMPH %', unit: '%', ref: '20 - 45' },
    { key: 'midPercent', label: 'MID %', unit: '%', ref: '3 - 15' },
    { key: 'granPercent', label: 'GRAN %', unit: '%', ref: '50 - 70' },
    { key: 'hgb', label: 'HGB', unit: 'g/dL', ref: '12.0 - 17.5' },
    { key: 'rbc', label: 'RBC', unit: '10^12/L', ref: '4.2 - 5.9' },
    { key: 'hct', label: 'HCT', unit: '%', ref: '36 - 50' },
    { key: 'mcv', label: 'MCV', unit: 'fL', ref: '80 - 100' },
    { key: 'mch', label: 'MCH', unit: 'pg', ref: '27 - 33' },
    { key: 'mchc', label: 'MCHC', unit: 'g/dL', ref: '32 - 36' },
    { key: 'rdwCv', label: 'RDW-CV', unit: '%', ref: '11 - 15' },
    { key: 'rdwSd', label: 'RDW-SD', unit: 'fL', ref: '35 - 56' },
    { key: 'plt', label: 'PLT', unit: '10^9/L', ref: '150 - 450' },
    { key: 'mpv', label: 'MPV', unit: 'fL', ref: '7.5 - 11.5' },
    { key: 'pdw', label: 'PDW', unit: 'fL', ref: '9 - 17' },
    { key: 'pct', label: 'PCT', unit: '%', ref: '0.1 - 0.3' }
  ];

  cbcInterpretation: any = {
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
    pct: ''
  };

  private parseCbcRange(ref: string): { low: number; high: number } | null {
    if (!ref) {
      return null;
    }
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
    const normalized = String(value).replace(/,/g, '').trim();
    const numeric = Number(normalized);
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

  updateAllCbcInterpretations(): void {
    const nextInterp: any = {};
    for (const field of this.cbcFields) {
      nextInterp[field.key] = this.buildCbcInterpretation(this.cbc[field.key], field.ref);
    }
    this.cbcInterpretation = nextInterp;
  }

  // Parasitology Stool Form Data
  parasitologyStool: any = {
    ova: '',
    cysts: '',
    larvae: '',
    color: '',
    consistency: '',
    blood: '',
    mucus: '',
    visibleParasites: '',
    others: ''
  };

  scanRequestId: any;
  scanReportId: any;
  scanReport: any = {};
  selectedScanRequest: any = null;

  ngOnInit(): void {
    // Get username from sessionStorage
    this.userName = sessionStorage.getItem('username');
    
    if (this.userName === null) {
      this.router.navigate(['/login-mobile']);
      return;
    }
    
    this.loadRequests();
  }

  loadRequests(): void {
    this.isLoadingRequests = true;
    this.api.getAllLabProceduresRequested().subscribe({
      next: (res: any) => {
        const procedures = res?.data || res || [];
        this.requests = Array.isArray(procedures) ? procedures : [];
        this.patientDisplay.refreshPatientDirectory().subscribe(() => {
          this.cdr.detectChanges();
        });
        this.isLoadingRequests = false;
      },
      error: () => {
        this.isLoadingRequests = false;
      }
    });
  }

  get filteredRequests(): any[] {
    const q = (this.searchText || '').toLowerCase().trim();
    if (!q) {
      return this.requests;
    }
    return this.requests.filter((req) =>
      (this.getRequestPatientName(req) || '').toLowerCase().includes(q) ||
      (req.procedureRequestedName || '').toLowerCase().includes(q) ||
      (req.exam || '').toLowerCase().includes(q) ||
      (req.report || '').toLowerCase().includes(q) ||
      (req.dateOfProcedure || '').toLowerCase().includes(q)
    );
  }

  getRequestPatientName(request: any): string {
    return this.patientDisplay.getDisplayName(request);
  }

  private refreshSelectedPatientFromEntity(request: any): void {
    const patientId = this.patientDisplay.extractPatientId(request);
    if (!patientId) {
      return;
    }

    this.patientDisplay.refreshPatient(patientId).subscribe(() => {
      this.cdr.detectChanges();
    });
  }

  selectRequest(req: any): void {
    this.selectedRequest = req;
    this.selectedScanRequest = req;
    this.scanRequestId = req.id;
    this.message = '';
    this.responseMessage = '';
    this.responseColor = '';
    this.refreshSelectedPatientFromEntity(req);
    
    // Reset all forms
    this.showMrdtForm = false;
    this.showGeneralForm = false;
    this.showUrinalysisForm = false;
    this.showCbcForm = false;
    this.showParasitologyStoolForm = false;

    // Determine which form to show based on request (same logic as desktop)
    const category = (req.category || '').toString().toLowerCase();
    const requestName = (req.procedureRequestedName || '').toString().toLowerCase();

    if (category === 'malaria test') {
      this.showMrdtForm = true;
      this.showGeneralForm = false;
      this.loadScanReportForThatRequest(req);
    } else {
      if (requestName === 'urinalysis') {
        this.showUrinalysisForm = true;
        this.loadUrinalysisReportForRequest(req);
      } else {
        if (requestName === 'cbc' || requestName.includes('cbc')) {
          this.showCbcForm = true;
          this.loadCbcReportForRequest(req);
        } else {
          if (requestName === 'parasitology stool' || requestName === 'parasitologystool' || requestName.includes('parasitology stool')) {
            this.showParasitologyStoolForm = true;
            this.loadParasitologyStoolReportForRequest(req);
          } else {
            this.showMrdtForm = false;
            this.showUrinalysisForm = false;
            this.showGeneralForm = true;
            this.loadGeneralLabReportForRequest(req);
          }
        }
      }
    }

    this.showDrawer = false;
  }

  // Load methods matching desktop exactly
  loadScanReportForThatRequest(scanRequest: any): void {
    this.isLoadingRequests = true;
    this.scanRequestId = scanRequest.id;
    this.selectedScanRequest = scanRequest;

    this.api.getLabReportByRequestId(scanRequest.id).subscribe({
      next: (res: any) => {
        this.isLoadingRequests = false;
        this.scanReport = res?.data || res || {};
        this.scanReportId = this.scanReport.id || null;
        
        // Populate MRDT form data
        this.generalUs.mrdt = this.scanReport.mrdt || '';
        this.generalUs.bs = this.scanReport.bs || '';
        this.generalUs.notes = this.scanReport.notes || '';
        this.generalUs.test = this.scanReport.test || '';
        this.generalUs.labReportTitle = this.scanReport.labReportTitle || '';
        this.generalUs.recommendation = this.scanReport.recommendation || '';
        this.generalUs.result = this.scanReport.result || this.scanReport.report || this.scanReport.findings || '';
      },
      error: (error: any) => {
        this.isLoadingRequests = false;
        console.error('Error loading report:', error);
        this.scanReportId = null;
      }
    });
  }

  loadUrinalysisReportForRequest(scanRequest: any): void {
    this.isLoadingRequests = true;
    this.scanRequestId = scanRequest.id;
    this.selectedScanRequest = scanRequest;

    this.api.getUrinalysisReportByRequestId(scanRequest.id).subscribe({
      next: (res: any) => {
        this.isLoadingRequests = false;
        const report = res?.data || res || {};
        this.scanReport = report;
        this.scanReportId = report.id || null;
        
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
          volume: report.volume || ''
        };
        this.generalUs.labReportTitle = report.labReportTitle || '';
      },
      error: (error: any) => {
        this.isLoadingRequests = false;
        console.error('Error loading urinalysis report:', error);
        this.scanReportId = null;
      }
    });
  }

  loadCbcReportForRequest(scanRequest: any): void {
    this.isLoadingRequests = true;
    this.scanRequestId = scanRequest.id;
    this.selectedScanRequest = scanRequest;

    this.api.getCbcReportByRequestId(scanRequest.id).subscribe({
      next: (res: any) => {
        this.isLoadingRequests = false;
        const report = res?.data || res || {};
        this.scanReport = report;
        this.scanReportId = report.id || null;
        
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
          pct: report.pct || ''
        };
        this.generalUs.labReportTitle = report.labReportTitle || '';
        this.updateAllCbcInterpretations();
      },
      error: (error: any) => {
        this.isLoadingRequests = false;
        console.error('Error loading CBC report:', error);
        this.scanReportId = null;
      }
    });
  }

  loadParasitologyStoolReportForRequest(scanRequest: any): void {
    this.isLoadingRequests = true;
    this.scanRequestId = scanRequest.id;
    this.selectedScanRequest = scanRequest;

    this.api.getParasitologyStoolReportByRequestId(scanRequest.id).subscribe({
      next: (res: any) => {
        this.isLoadingRequests = false;
        const report = res?.data || res || {};
        this.scanReport = report;
        this.scanReportId = report.id || null;
        
        this.parasitologyStool = {
          ova: report.ova || '',
          cysts: report.cysts || '',
          larvae: report.larvae || '',
          color: report.color || '',
          consistency: report.consistency || '',
          blood: report.blood || '',
          mucus: report.mucus || '',
          visibleParasites: report.visibleParasites || '',
          others: report.others || ''
        };
        this.generalUs.labReportTitle = report.labReportTitle || '';
      },
      error: (error: any) => {
        this.isLoadingRequests = false;
        console.error('Error loading parasitology stool report:', error);
        this.scanReportId = null;
      }
    });
  }

  loadGeneralLabReportForRequest(scanRequest: any): void {
    this.isLoadingRequests = true;
    this.scanRequestId = scanRequest.id;
    this.selectedScanRequest = scanRequest;

    this.api.getGeneralLabReportByRequestId(scanRequest.id).subscribe({
      next: (res: any) => {
        this.isLoadingRequests = false;
        const report = res?.data ?? res ?? {};
        if (!report || !report.id || (typeof report?.message === 'string' && report.message.toLowerCase().includes('not found'))) {
          this.createGeneralLabReportForRequest(scanRequest);
          return;
        }
        this.scanReport = report;
        this.scanReportId = report.id || null;

        this.generalUs.result = report.result || report.report || report.findings || '';
        this.generalUs.notes = report.notes || '';
        this.generalUs.recommendation = report.recommendation || '';
      },
      error: (error: any) => {
        this.isLoadingRequests = false;
        console.error('Error loading general lab report:', error);
        this.scanReportId = null;
      }
    });
  }

  createGeneralLabReportForRequest(scanRequest: any): void {
    const fallbackPayload = {
      doneBy: this.userName || '',
      recommendation: '',
      result: '',
      notes: ''
    };

    this.api.createGeneralLabReportByRequestId(scanRequest.id, fallbackPayload).subscribe({
      next: (res: any) => {
        const report = res?.data ?? res ?? {};
        this.scanReport = report;
        this.generalUs.result = report.result || report.report || report.findings || '';
        this.generalUs.notes = report.notes || '';
        this.generalUs.recommendation = report.recommendation || '';
        this.scanReportId = report.id || this.scanReportId;
      },
      error: (err: any) => {
        console.error('Error creating general lab report:', err);
        this.scanReportId = null;
      }
    });
  }

  toggleDrawer(open?: boolean): void {
    if (open === undefined) {
      this.showDrawer = !this.showDrawer;
      return;
    }
    this.showDrawer = open;
  }

  saveResult(form: NgForm): void {
    this.responseColor = '';
    this.responseMessage = '';

    // Validation checks (same as desktop)
    if (!this.scanReportId) {
      this.responseMessage = "Missing scanReport Id";
      this.responseColor = "rgb(238, 16, 16)";
      this.showDivAddToDataBaseConsultation = true;
      this.message = this.responseMessage;
      this.messageColor = this.responseColor;
      setTimeout(() => {
        this.showDivAddToDataBaseConsultation = false;
        this.message = '';
      }, 2000);
      return;
    }

    if (!this.userName) {
      this.responseMessage = "Missing labtechnician's initials";
      this.responseColor = "rgb(238, 16, 16)";
      this.showDivAddToDataBaseConsultation = true;
      this.message = this.responseMessage;
      this.messageColor = this.responseColor;
      setTimeout(() => {
        this.showDivAddToDataBaseConsultation = false;
        this.message = '';
      }, 2000);
      return;
    }

    this.isSaving = true;
    this.showDivUpdatedLoaderconsultation = true;
    this.message = '';

    // Build payload based on form type (same as desktop lab getUserFormDataConsultation)
    const cbcPayload = this.showCbcForm ? (() => {
      this.updateAllCbcInterpretations();
      const interpretations: Record<string, string> = {};
      for (const field of this.cbcFields) {
        const v = this.cbcInterpretation[field.key];
        interpretations[field.key] = v != null && v !== '' ? String(v) : '';
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
        labReportTitle: this.generalUs.labReportTitle,
        interpretations
      };
    })() : {};

    const parasitologyPayload = this.showParasitologyStoolForm ? {
      ova: this.parasitologyStool.ova,
      cysts: this.parasitologyStool.cysts,
      larvae: this.parasitologyStool.larvae,
      color: this.parasitologyStool.color,
      consistency: this.parasitologyStool.consistency,
      blood: this.parasitologyStool.blood,
      mucus: this.parasitologyStool.mucus,
      visibleParasites: this.parasitologyStool.visibleParasites,
      others: this.parasitologyStool.others
    } : {};

    let requestData: any = {};

    if (this.showMrdtForm) {
      requestData = {
        bs: this.generalUs.bs,
        mrdt: this.generalUs.mrdt,
        notes: this.generalUs.notes,
        test: this.generalUs.test,
        labReportTitle: this.generalUs.labReportTitle,
        recommendation: this.generalUs.recommendation,
        result: this.generalUs.result,
        doneBy: this.userName
      };
    } else if (this.showUrinalysisForm) {
      requestData = {
        ...this.urinalysis,
        labReportTitle: this.generalUs.labReportTitle,
        doneBy: this.userName
      };
    } else if (this.showCbcForm) {
      requestData = {
        ...cbcPayload,
        doneBy: this.userName
      };
    } else if (this.showParasitologyStoolForm) {
      requestData = {
        ...parasitologyPayload,
        labReportTitle: this.generalUs.labReportTitle,
        doneBy: this.userName
      };
    } else if (this.showGeneralForm) {
      requestData = {
        result: this.generalUs.result,
        notes: this.generalUs.notes,
        recommendation: this.generalUs.recommendation,
        doneBy: this.userName
      };
    }

    // Use the correct API method for each form type (same as desktop)
    const updateRequest = this.showUrinalysisForm
      ? this.api.updateUrinalysisReport(this.scanReportId, requestData)
      : (this.showCbcForm
        ? this.api.updateCbcReport(this.scanReportId, requestData)
        : (this.showParasitologyStoolForm
          ? this.api.updateParasitologyStoolReport(this.scanReportId, requestData)
          : (this.showGeneralForm
            ? this.api.updateGeneralLabReport(this.scanReportId, requestData)
            : this.api.updateLabReport(this.scanReportId, requestData))));

    updateRequest.subscribe(
      (response: any) => {
        console.log("Data sent to API:", requestData);
        this.isSaving = false;
        this.showDivUpdatedLoaderconsultation = false;

        if (response && response.message) {
          this.responseColor = "rgb(11, 155, 112)";
          this.responseMessage = response.message;
        } else {
          this.responseColor = "rgb(214, 80, 80)";
          this.responseMessage = "Internal server error";
        }

        this.message = this.responseMessage;
        this.messageColor = this.responseColor;
        this.showDivAddToDataBaseConsultation = true;

        // Reload requests list after save (same as desktop)
        this.loadRequests();

        setTimeout(() => {
          this.showDivAddToDataBaseConsultation = false;
          this.message = '';
          this.responseColor = '';
        }, 3000);
      },
      (error: any) => {
        console.error("Error saving result:", error);
        this.isSaving = false;
        this.showDivUpdatedLoaderconsultation = false;

        // Extract error message (same as desktop)
        if (error.error && error.error.message) {
          this.responseMessage = error.error.message;
        } else if (error.error && error.error.error) {
          this.responseMessage = error.error.error;
        } else {
          this.responseMessage = "An unexpected error occurred. Please try again.";
        }
        this.responseColor = "rgb(201, 87, 67)";

        this.message = this.responseMessage;
        this.messageColor = this.responseColor;
        this.showDivAddToDataBaseConsultation = true;

        setTimeout(() => {
          this.showDivAddToDataBaseConsultation = false;
          this.message = '';
        }, 5000);
      }
    );
  }

  hasFormData(): boolean {
    if (this.showMrdtForm) {
      return !!(this.generalUs.bs || this.generalUs.mrdt || this.generalUs.result);
    } else if (this.showUrinalysisForm) {
      return Object.values(this.urinalysis).some(v => v);
    } else if (this.showCbcForm) {
      return Object.values(this.cbc).some(v => v);
    } else if (this.showParasitologyStoolForm) {
      return Object.values(this.parasitologyStool).some(v => v);
    } else if (this.showGeneralForm) {
      return !!(this.generalUs.result || this.generalUs.notes);
    }
    return false;
  }

  clearForm(form: NgForm): void {
    form.resetForm();
    
    // Reset form data
    if (this.showMrdtForm) {
      this.generalUs = {
        bs: '',
        mrdt: '',
        labReportTitle: '',
        test: '',
        notes: '',
        recommendation: '',
        result: ''
      };
    } else if (this.showUrinalysisForm) {
      this.urinalysis = {
        ph: '', sg: '', protein: '', glucose: '', ketones: '', blood: '',
        bilirubin: '', urobilinogen: '', nitrite: '', leukocyteE: '',
        epithelialCells: '', pusCells: '', casts: '', redCells: '', crystals: '',
        others: '',
        color: '', appearance: '', volume: ''
      };
      this.generalUs.labReportTitle = '';
    } else if (this.showCbcForm) {
      this.cbc = {
        wbc: '', lymph: '', mid: '', gran: '', lymphPercent: '', midPercent: '',
        granPercent: '', hgb: '', rbc: '', hct: '', mcv: '', mch: '', mchc: '',
        rdwCv: '', rdwSd: '', plt: '', mpv: '', pdw: '', pct: ''
      };
      this.generalUs.labReportTitle = '';
      this.updateAllCbcInterpretations();
    } else if (this.showParasitologyStoolForm) {
      this.parasitologyStool = {
        ova: '', cysts: '', larvae: '', color: '', consistency: '', blood: '',
        mucus: '', visibleParasites: '', others: ''
      };
      this.generalUs.labReportTitle = '';
    } else if (this.showGeneralForm) {
      this.generalUs.result = '';
      this.generalUs.notes = '';
      this.generalUs.recommendation = '';
    }
    
    this.message = '';
  }

  printScanResults(): void {
    if (!this.scanRequestId) {
      this.message = 'No request selected';
      this.messageColor = '#dc3545';
      return;
    }

    this.showDivUpdatedLoaderInvoice = true;
    this.message = 'Generating PDF...';

    this.api.exportScanResults(this.scanRequestId).subscribe({
      next: (res: Blob) => {
        this.showDivUpdatedLoaderInvoice = false;
        this.message = '';

        const blob = new Blob([res], { type: 'application/pdf' });
        const url = window.URL.createObjectURL(blob);
      
        // Create a link element and trigger a download
        const a = document.createElement('a');
        a.href = url;
        a.download = 'lab-report.pdf';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      
        // Clean up the object URL
        window.URL.revokeObjectURL(url);
      },
      error: (error: any) => {
        console.error("Error generating PDF:", error);
        this.showDivUpdatedLoaderInvoice = false;

        if (error.error && error.error.message) {
          this.responseMessage = error.error.message;
        } else if (error.error && error.error.error) {
          this.responseMessage = error.error.error;
        } else {
          this.responseMessage = "An unexpected error occurred while generating PDF.";
        }
        this.responseColor = "rgb(201, 87, 67)";

        this.message = this.responseMessage;
        this.messageColor = this.responseColor;

        setTimeout(() => {
          this.message = '';
        }, 5000);
      }
    });
  }
}
