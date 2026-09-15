import { Injectable, OnDestroy } from '@angular/core';
import { Subscription, Subject } from 'rxjs';
import { ApiConfigService } from './api-config.service';
import { MessagingWebSocketService, MessagePushEvent } from './messaging-websocket.service';

export type DepartmentRequestKind = 'scan' | 'lab' | 'dental' | 'mch' | 'any';

export interface DepartmentRequestRefreshEvent {
  type: 'PROCEDURE_REQUESTED' | 'PROCEDURE_UPDATED' | 'API_READY' | 'POLL';
  category?: string | null;
  procedureCategoryName?: string | null;
  categoryParentName?: string | null;
  procedureRequestedName?: string | null;
  procedureId?: number | null;
  visitId?: number | null;
}

/**
 * Keeps department request boards (scan/lab/dental/mch) fresh:
 * - waits for API host ready (fixes empty list after reload/reconnect)
 * - listens for PROCEDURE_REQUESTED WebSocket pushes
 * - light visibility polling as a backup when WS is down
 */
@Injectable({ providedIn: 'root' })
export class DepartmentRequestRealtimeService implements OnDestroy {
  private readonly refreshSubject = new Subject<DepartmentRequestRefreshEvent>();
  readonly refresh$ = this.refreshSubject.asObservable();

  private apiReadySub?: Subscription;
  private wsSub?: Subscription;
  private pollTimer?: ReturnType<typeof setInterval>;
  private visibilityHandler?: () => void;
  private started = false;

  constructor(
    private apiConfig: ApiConfigService,
    private messagingWs: MessagingWebSocketService
  ) {}

  /** Idempotent: start listening once for the app session. */
  ensureStarted(): void {
    if (this.started) {
      return;
    }
    this.started = true;

    const connectAndSignalReady = () => {
      if (!this.apiConfig.isReady()) {
        return;
      }
      this.messagingWs.connect();
      this.refreshSubject.next({ type: 'API_READY' });
    };

    connectAndSignalReady();
    this.apiReadySub = this.apiConfig.state$.subscribe((state) => {
      if (state === 'ready') {
        connectAndSignalReady();
      }
    });

    this.wsSub = this.messagingWs.incoming$.subscribe((event) => this.handlePush(event));

    this.pollTimer = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible' && this.apiConfig.isReady()) {
        this.refreshSubject.next({ type: 'POLL' });
      }
    }, 20000);

    if (typeof document !== 'undefined') {
      this.visibilityHandler = () => {
        if (document.visibilityState === 'visible' && this.apiConfig.isReady()) {
          this.refreshSubject.next({ type: 'POLL' });
        }
      };
      document.addEventListener('visibilitychange', this.visibilityHandler);
    }
  }

  matchesKind(event: DepartmentRequestRefreshEvent, kind: DepartmentRequestKind): boolean {
    if (kind === 'any' || event.type === 'API_READY' || event.type === 'POLL') {
      return true;
    }
    const haystack = `${event.category || ''} ${event.procedureCategoryName || ''} ${event.categoryParentName || ''} ${event.procedureRequestedName || ''}`.toLowerCase();
    switch (kind) {
      case 'scan':
        return haystack.includes('ultrasound') || haystack.includes('imaging') || haystack.includes('scan');
      case 'dental':
        return haystack.includes('dental');
      case 'lab':
        return (
          haystack.includes('lab') ||
          haystack.includes('test') ||
          haystack.includes('malaria') ||
          haystack.includes('urinalysis') ||
          haystack.includes('cbc')
        );
      case 'mch':
        return (
          haystack.includes('maternity') ||
          haystack.includes('mch') ||
          haystack.includes('antenatal') ||
          haystack.includes('postnatal') ||
          haystack.includes('obstetric')
        );
      default:
        return true;
    }
  }

  private handlePush(event: MessagePushEvent): void {
    if (!event?.type) {
      return;
    }
    if (event.type !== 'PROCEDURE_REQUESTED' && event.type !== 'PROCEDURE_UPDATED') {
      return;
    }
    const pr = (event as any).procedureRequest || {};
    this.refreshSubject.next({
      type: event.type as 'PROCEDURE_REQUESTED' | 'PROCEDURE_UPDATED',
      category: pr.category ?? null,
      procedureCategoryName: pr.procedureCategoryName ?? null,
      categoryParentName: pr.categoryParentName ?? null,
      procedureRequestedName: pr.procedureRequestedName ?? null,
      procedureId: pr.id ?? null,
      visitId: pr.visitId ?? null,
    });
  }

  ngOnDestroy(): void {
    this.apiReadySub?.unsubscribe();
    this.wsSub?.unsubscribe();
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
    }
    if (this.visibilityHandler && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
    }
  }
}
