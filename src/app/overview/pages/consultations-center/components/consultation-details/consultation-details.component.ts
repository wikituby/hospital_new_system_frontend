import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';

@Component({
  selector: 'app-consultation-details',
  templateUrl: './consultation-details.component.html',
  styleUrls: ['./consultation-details.component.css']
})
export class ConsultationDetailsComponent implements OnInit {
  @Input() patient: any = null;
  @Input() consultations: any[] = [];
  @Input() isLoading = false;
  @Output() addConsultation = new EventEmitter<any>();
  @Output() updateConsultation = new EventEmitter<any>();
  @Output() deleteConsultation = new EventEmitter<number>();

  consultationForm: FormGroup;
  isFormVisible = false;
  editingConsultationId: number | null = null;

  constructor(private fb: FormBuilder) {
    this.consultationForm = this.createConsultationForm();
  }

  ngOnInit(): void {
    // Initialize form
  }

  private createConsultationForm(): FormGroup {
    return this.fb.group({
      chiefComplaint: ['', Validators.required],
      historyOfPresentIllness: ['', Validators.required],
      physicalExamination: [''],
      diagnosis: ['', Validators.required],
      treatmentPlan: ['', Validators.required],
      notes: [''],
      consultationDate: [new Date().toISOString().split('T')[0], Validators.required],
      doctorName: ['', Validators.required]
    });
  }

  showAddForm(): void {
    if (!this.patient) {
      alert('Please select a patient first');
      return;
    }
    this.isFormVisible = true;
    this.editingConsultationId = null;
    this.consultationForm.reset();
    this.consultationForm.patchValue({
      consultationDate: new Date().toISOString().split('T')[0]
    });
  }

  showEditForm(consultation: any): void {
    this.isFormVisible = true;
    this.editingConsultationId = consultation.id;
    this.consultationForm.patchValue(consultation);
  }

  hideForm(): void {
    this.isFormVisible = false;
    this.editingConsultationId = null;
    this.consultationForm.reset();
  }

  onSubmit(): void {
    if (this.consultationForm.valid && this.patient) {
      const consultationData = {
        ...this.consultationForm.value,
        patientId: this.patient.id
      };

      if (this.editingConsultationId) {
        this.updateConsultation.emit({
          id: this.editingConsultationId,
          consultation: consultationData
        });
      } else {
        this.addConsultation.emit(consultationData);
      }

      this.hideForm();
    }
  }

  onDelete(consultationId: number): void {
    if (confirm('Are you sure you want to delete this consultation?')) {
      this.deleteConsultation.emit(consultationId);
    }
  }

  hasError(fieldName: string, errorType: string): boolean {
    const field = this.consultationForm.get(fieldName);
    return field ? field.hasError(errorType) && (field.dirty || field.touched) : false;
  }
}










