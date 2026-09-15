import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ThemeService } from '../../../../services/theme.service';
import { defaultContactValue } from '../../../../utils/phone-contact.util';

@Component({
  selector: 'app-patient-registration',
  templateUrl: './patient-registration.component.html',
  styleUrls: ['./patient-registration.component.css']
})
export class PatientRegistrationComponent implements OnInit {
  isDarkMode: boolean = false;
  
  patientData: any = {
    firstName: '',
    lastName: '',
    middleName: '',
    dateOfBirth: '',
    gender: '',
    maritalStatus: '',
    phone: defaultContactValue(),
    email: '',
    address: '',
    city: '',
    state: '',
    postalCode: '',
    bloodGroup: '',
    allergies: '',
    medicalHistory: '',
    emergencyName: '',
    emergencyPhone: defaultContactValue(),
    emergencyRelation: ''
  };

  recentRegistrations = [
    { name: 'John Doe', initials: 'JD', fileNo: 'P001234', date: '2 hours ago' },
    { name: 'Jane Smith', initials: 'JS', fileNo: 'P001235', date: '5 hours ago' },
    { name: 'Michael Johnson', initials: 'MJ', fileNo: 'P001236', date: '1 day ago' }
  ];

  constructor(
    private router: Router,
    private themeService: ThemeService
  ) {}

  ngOnInit(): void {
    this.themeService.isDarkMode$.subscribe(isDark => {
      this.isDarkMode = isDark;
    });
  }

  registerPatient(formData: any): void {
    console.log('Registering patient:', formData);
    // Implement patient registration logic
  }

  clearForm(): void {
    this.patientData = {
      firstName: '',
      lastName: '',
      middleName: '',
      dateOfBirth: '',
      gender: '',
      maritalStatus: '',
      phone: defaultContactValue(),
      email: '',
      address: '',
      city: '',
      state: '',
      postalCode: '',
      bloodGroup: '',
      allergies: '',
      medicalHistory: '',
      emergencyName: '',
      emergencyPhone: defaultContactValue(),
      emergencyRelation: ''
    };
  }

  saveDraft(): void {
    console.log('Saving draft:', this.patientData);
    // Implement draft save logic
  }

  searchPatient(): void {
    console.log('Search patient');
  }

  importPatients(): void {
    console.log('Import patients');
  }
}
