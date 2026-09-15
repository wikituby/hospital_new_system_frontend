import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-consultation-patient-info',
  templateUrl: './consultation-patient-info.component.html',
  styleUrls: ['./consultation-patient-info.component.css']
})
export class ConsultationPatientInfoComponent {
  @Input() patient: any = null;
  @Input() isLoading = false;
  @Output() patientSelected = new EventEmitter<any>();

  searchQuery: string = '';
  patients: any[] = []; // This would come from a service

  onPatientSelect(patient: any): void {
    this.patientSelected.emit(patient);
  }

  searchPatients(): void {
    // TODO: Implement patient search
    console.log('Searching for:', this.searchQuery);
  }
}










