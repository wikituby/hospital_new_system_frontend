import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

/** Emitted when a prescription sale is completed from the OTC dispensary page. */
export interface PharmacyVisitSaleEvent {
  visitId: number;
  treatmentRequestedIds: number[];
  amountPaid?: number | string;
  balanceDue?: number | string;
  totalAmount?: number | string;
  visitPaymentRecorded?: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class PharmacyVisitSyncService {
  private readonly saleCompletedSubject = new Subject<PharmacyVisitSaleEvent>();
  readonly saleCompleted$ = this.saleCompletedSubject.asObservable();

  notifyPrescriptionSaleCompleted(event: PharmacyVisitSaleEvent): void {
    this.saleCompletedSubject.next(event);
  }
}
