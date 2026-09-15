import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { Patient } from '../../../interfaces/patient-visit.interface';

@Component({
  selector: 'app-patient-info',
  templateUrl: './patient-info.component.html',
  styleUrls: ['./patient-info.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PatientInfoComponent {
  @Input() patient: Patient | null = null;
  @Input() isLoading = false;
  @Output() patientSelected = new EventEmitter<Patient>();
  @Output() editPatient = new EventEmitter<Patient>();
  @Output() deletePatient = new EventEmitter<number>();

  onPatientSelect(patient: Patient): void {
    this.patientSelected.emit(patient);
  }

  onEditPatient(patient: Patient): void {
    this.editPatient.emit(patient);
  }

  onDeletePatient(patientId: number): void {
    this.deletePatient.emit(patientId);
  }
}
