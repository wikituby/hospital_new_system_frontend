import { Component, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { Patient, Visit, VitalSigns, LabTest, Scan, Procedure, Payment, Invoice } from '../../../interfaces/patient-visit.interface';
import { PatientService } from '../../../services/patient.service';
import { VisitManagementService } from '../../../services/visit-management.service';
import { PatientVisitStateService } from '../../../services/patient-visit-state.service';

@Component({
  selector: 'app-patient-visit-container',
  templateUrl: './patient-visit-container.component.html',
  styleUrls: ['./patient-visit-container.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PatientVisitContainerComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // State observables
  currentPatient$ = this.stateService.currentPatient$;
  currentVisit$ = this.stateService.currentVisit$;
  vitals$ = this.stateService.vitals$;
  labTests$ = this.stateService.labTests$;
  scans$ = this.stateService.scans$;
  procedures$ = this.stateService.procedures$;
  payments$ = this.stateService.payments$;
  invoices$ = this.stateService.invoices$;
  isLoading$ = this.stateService.isLoading$;
  hasError$ = this.stateService.hasError$;
  errors$ = this.stateService.errors$;

  constructor(
    private patientService: PatientService,
    private visitManagementService: VisitManagementService,
    private stateService: PatientVisitStateService
  ) {}

  ngOnInit(): void {
    // Initialize any required data
    this.loadInitialData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadInitialData(): void {
    // Load any initial data if needed
  }

  // Patient Management
  onPatientSelected(patient: Patient): void {
    this.stateService.setCurrentPatient(patient);
    this.loadPatientData(patient.id!);
  }

  onEditPatient(patient: Patient): void {
    // Handle patient editing
    console.log('Edit patient:', patient);
  }

  onDeletePatient(patientId: number): void {
    if (confirm('Are you sure you want to delete this patient?')) {
      this.patientService.deletePatient(patientId)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.stateService.setCurrentPatient(null);
            console.log('Patient deleted successfully');
          },
          error: (error) => {
            console.error('Error deleting patient:', error);
          }
        });
    }
  }

  private loadPatientData(patientId: number): void {
    // Load patient visits, vitals, etc.
    this.loadPatientVisits(patientId);
  }

  private loadPatientVisits(patientId: number): void {
    this.stateService.setLoadingState('visit', { isLoading: true });
    
    this.patientService.getPatientVisits(patientId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (visits) => {
          // Handle visits data
          this.stateService.setLoadingState('visit', { isLoading: false });
        },
        error: (error) => {
          this.stateService.setLoadingState('visit', { 
            isLoading: false, 
            error: 'Failed to load patient visits' 
          });
        }
      });
  }

  // Vital Signs Management
  onAddVitals(vitals: Omit<VitalSigns, 'id'>): void {
    this.stateService.setLoadingState('vitals', { isLoading: true });
    
    this.visitManagementService.createVitalSigns(vitals)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.stateService.addVital(response.data);
          this.stateService.setLoadingState('vitals', { isLoading: false, success: true });
        },
        error: (error) => {
          this.stateService.setLoadingState('vitals', { 
            isLoading: false, 
            error: 'Failed to add vital signs' 
          });
        }
      });
  }

  onUpdateVitals(updateData: { id: number; vitals: Partial<VitalSigns> }): void {
    this.stateService.setLoadingState('vitals', { isLoading: true });
    
    this.visitManagementService.updateVitalSigns(updateData.id, updateData.vitals)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.stateService.updateVital(response.data);
          this.stateService.setLoadingState('vitals', { isLoading: false, success: true });
        },
        error: (error) => {
          this.stateService.setLoadingState('vitals', { 
            isLoading: false, 
            error: 'Failed to update vital signs' 
          });
        }
      });
  }

  onDeleteVitals(vitalId: number): void {
    this.stateService.setLoadingState('vitals', { isLoading: true });
    
    this.visitManagementService.deleteVitalSigns(vitalId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.stateService.removeVital(vitalId);
          this.stateService.setLoadingState('vitals', { isLoading: false, success: true });
        },
        error: (error) => {
          this.stateService.setLoadingState('vitals', { 
            isLoading: false, 
            error: 'Failed to delete vital signs' 
          });
        }
      });
  }

  // Error handling
  onClearError(section: keyof PatientVisitStateService['stateSubject']['value']['loadingStates']): void {
    this.stateService.clearError(section);
  }
}
