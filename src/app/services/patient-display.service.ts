import { Injectable } from '@angular/core';
import { forkJoin, Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { ApiService } from './api.service';
import {
  buildPatientDisplayName,
  extractPatientIdFromDepartmentRequest,
  normalizePatientRecord,
} from '../utils/patient-display.util';

@Injectable({ providedIn: 'root' })
export class PatientDisplayService {
  private readonly cache = new Map<number, ReturnType<typeof normalizePatientRecord>>();

  constructor(private api: ApiService) {}

  extractPatientId(request: any): number | null {
    return extractPatientIdFromDepartmentRequest(request);
  }

  getDisplayName(request: any): string {
    const patientId = typeof request === 'number' ? request : this.extractPatientId(request);
    if (patientId) {
      const cached = this.cache.get(patientId);
      if (cached) {
        return buildPatientDisplayName(cached);
      }
      return '';
    }
    if (request && typeof request === 'object') {
      return buildPatientDisplayName(request);
    }
    return '';
  }

  clearCache(): void {
    this.cache.clear();
  }

  invalidatePatient(patientId: number | string): void {
    const id = Number(patientId);
    if (Number.isFinite(id) && id > 0) {
      this.cache.delete(id);
    }
  }

  getCachedPatient(patientId: number): any | null {
    return this.cache.get(patientId) ?? null;
  }

  upsertPatient(raw: any): void {
    const normalized = normalizePatientRecord(raw);
    const patientId = Number(normalized.id ?? normalized.patientId);
    if (Number.isFinite(patientId) && patientId > 0) {
      this.cache.set(patientId, normalized);
    }
  }

  refreshPatient(patientId: number | string): Observable<any | null> {
    const id = Number(patientId);
    if (!Number.isFinite(id) || id <= 0) {
      return of(null);
    }

    return this.api.getPatientById(id).pipe(
      tap((patient) => {
        if (patient) {
          this.upsertPatient(patient);
        }
      }),
      map(() => this.getCachedPatient(id)),
      catchError(() => of(null))
    );
  }

  hydrateFromRequests(requests: any[], forceRefresh = false): Observable<void> {
    const patientIds = Array.from(
      new Set(
        (requests || [])
          .map((request) => this.extractPatientId(request))
          .filter((id): id is number => id != null)
      )
    );

    const idsToFetch = forceRefresh
      ? patientIds
      : patientIds.filter((id) => !this.cache.has(id));

    if (!idsToFetch.length) {
      return of(void 0);
    }

    return forkJoin(
      idsToFetch.map((id) =>
        this.api.getPatientById(id).pipe(
          tap((patient) => {
            if (patient) {
              this.upsertPatient(patient);
            }
          }),
          catchError(() => of(null))
        )
      )
    ).pipe(map(() => void 0));
  }

  /** Reload all patients from the registry so department lists always show current names. */
  refreshPatientDirectory(): Observable<void> {
    this.cache.clear();
    return this.api.getAllPatients().pipe(
      tap((patients: any[]) => {
        (Array.isArray(patients) ? patients : []).forEach((patient) => this.upsertPatient(patient));
      }),
      map(() => void 0),
      catchError(() => of(void 0))
    );
  }
}
