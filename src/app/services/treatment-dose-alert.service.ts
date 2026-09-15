import { Injectable, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import {
  MessagePushEvent,
  MessagingWebSocketService,
} from './messaging-websocket.service';
import { GlobalFeedbackService } from './global-feedback.service';

@Injectable({ providedIn: 'root' })
export class TreatmentDoseAlertService implements OnDestroy {
  private wsSub?: Subscription;
  private modalWatchTimer?: ReturnType<typeof setInterval>;
  private lastAlertKey = '';

  constructor(
    private messagingWs: MessagingWebSocketService,
    private globalFeedback: GlobalFeedbackService
  ) {}

  startListening(): void {
    this.wsSub?.unsubscribe();
    this.wsSub = this.messagingWs.incoming$.subscribe((event) => {
      if (event?.type === 'TREATMENT_DOSE_DUE') {
        this.presentAlert(event.title, event.body, event.treatmentDoseDue);
      }
    });
  }

  stopListening(): void {
    this.wsSub?.unsubscribe();
    this.wsSub = undefined;
  }

  presentAlert(
    title?: string,
    body?: string,
    detail?: MessagePushEvent['treatmentDoseDue']
  ): void {
    const message =
      (body || title || 'Next treatment dose is due now').trim();
    const key = `dose:${detail?.chartId ?? message}`;
    if (key === this.lastAlertKey) {
      return;
    }
    this.lastAlertKey = key;
    this.globalFeedback.show(message, 'warning', 12000);
  }

  startModalWatch(
    getNextDueMs: () => number | null,
    getMessage: () => string
  ): void {
    this.stopModalWatch();
    this.lastAlertKey = '';
    this.modalWatchTimer = setInterval(() => {
      const dueMs = getNextDueMs();
      if (dueMs == null || !Number.isFinite(dueMs)) {
        return;
      }
      if (Date.now() < dueMs) {
        return;
      }
      const key = `modal:${dueMs}`;
      if (key === this.lastAlertKey) {
        return;
      }
      this.lastAlertKey = key;
      this.presentAlert('Next dose due', getMessage());
    }, 15000);
  }

  stopModalWatch(): void {
    if (this.modalWatchTimer) {
      clearInterval(this.modalWatchTimer);
      this.modalWatchTimer = undefined;
    }
  }

  ngOnDestroy(): void {
    this.stopListening();
    this.stopModalWatch();
  }
}
