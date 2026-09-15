import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { BaseService } from './base.service';
import { Patient, Visit, ApiResponse, PaginatedResponse } from '../interfaces/patient-visit.interface';

@Injectable({
  providedIn: 'root'
})
export class PatientService extends BaseService {
  private readonly endpoint = '/course/Patient-management';

  // Patient Management
  getAllPatients(page: number = 0, size: number = 10): Observable<PaginatedResponse<Patient>> {
    return this.get<PaginatedResponse<Patient>>(`${this.endpoint}/get-all-patients?page=${page}&size=${size}`);
  }

  getPatientById(id: number): Observable<ApiResponse<Patient>> {
    return this.get<ApiResponse<Patient>>(`${this.endpoint}/get-patient/${id}`);
  }

  createPatient(patient: Patient): Observable<ApiResponse<Patient>> {
    return this.post<ApiResponse<Patient>>(`${this.endpoint}/create-patient`, patient);
  }

  updatePatient(id: number, patient: Partial<Patient>): Observable<ApiResponse<Patient>> {
    return this.put<ApiResponse<Patient>>(`${this.endpoint}/update-patient/${id}`, patient);
  }

  deletePatient(id: number): Observable<ApiResponse<void>> {
    return this.delete<ApiResponse<void>>(`${this.endpoint}/delete-patient/${id}`);
  }

  searchPatients(searchTerm: string, page: number = 0, size: number = 10): Observable<PaginatedResponse<Patient>> {
    return this.get<PaginatedResponse<Patient>>(`${this.endpoint}/search-patients?search=${searchTerm}&page=${page}&size=${size}`);
  }

  // Visit Management
  getPatientVisits(patientId: number, page: number = 0, size: number = 10): Observable<PaginatedResponse<Visit>> {
    return this.get<PaginatedResponse<Visit>>(`${this.endpoint}/get-patient-visits/${patientId}?page=${page}&size=${size}`);
  }

  createVisit(visit: Omit<Visit, 'id'>): Observable<ApiResponse<Visit>> {
    return this.post<ApiResponse<Visit>>(`${this.endpoint}/create-visit`, visit);
  }

  updateVisit(id: number, visit: Partial<Visit>): Observable<ApiResponse<Visit>> {
    return this.put<ApiResponse<Visit>>(`${this.endpoint}/update-visit/${id}`, visit);
  }

  getVisitById(id: number): Observable<ApiResponse<Visit>> {
    return this.get<ApiResponse<Visit>>(`${this.endpoint}/get-visit/${id}`);
  }
}

