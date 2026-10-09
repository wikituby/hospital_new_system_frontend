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

/** Emitted when a visit prescription (drug or sundry) is saved, edited, or removed. */
export interface PharmacyPrescriptionChangedEvent {
  visitId: number;
}

@Injectable({
  providedIn: 'root',
})
export class PharmacyVisitSyncService {
  private readonly saleCompletedSubject = new Subject<PharmacyVisitSaleEvent>();
  readonly saleCompleted$ = this.saleCompletedSubject.asObservable();

  private readonly prescriptionChangedSubject = new Subject<PharmacyPrescriptionChangedEvent>();
  readonly prescriptionChanged$ = this.prescriptionChangedSubject.asObservable();

  private readonly prescriptionChannel: BroadcastChannel | null;

  constructor() {
    let channel: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel('veneranda-pharmacy-prescription');
      channel.onmessage = (message: MessageEvent) => {
        const visitId = Number(message?.data?.visitId);
        if (Number.isFinite(visitId) && visitId > 0) {
          this.prescriptionChangedSubject.next({ visitId });
        }
      };
    }
    this.prescriptionChannel = channel;
  }

  notifyPrescriptionSaleCompleted(event: PharmacyVisitSaleEvent): void {
    this.saleCompletedSubject.next(event);
  }

  notifyPrescriptionChanged(event: PharmacyPrescriptionChangedEvent): void {
    const visitId = Number(event?.visitId);
    if (!Number.isFinite(visitId) || visitId <= 0) {
      return;
    }
    const payload = { visitId };
    this.prescriptionChangedSubject.next(payload);
    try {
      this.prescriptionChannel?.postMessage(payload);
    } catch {
      // Another tab may already be closed.
    }
  }
}
