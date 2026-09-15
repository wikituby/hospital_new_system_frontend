import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type FeedbackType = 'success' | 'error' | 'info' | 'warning';

export interface FeedbackState {
  isVisible: boolean;
  message: string;
  type: FeedbackType;
}

@Injectable({
  providedIn: 'root'
})
export class GlobalFeedbackService {
  private readonly feedbackStateSubject = new BehaviorSubject<FeedbackState>({
    isVisible: false,
    message: '',
    type: 'info'
  });

  feedbackState$ = this.feedbackStateSubject.asObservable();
  private hideTimer: ReturnType<typeof setTimeout> | null = null;
  private lastShownKey = '';
  private lastShownAt = 0;

  show(message: string, type: FeedbackType = 'info', durationMs = 3500): void {
    const normalizedMessage = (message || '').trim();
    if (!normalizedMessage) return;

    const now = Date.now();
    const dedupeKey = `${type}:${normalizedMessage}`;
    if (dedupeKey === this.lastShownKey && now - this.lastShownAt < 900) {
      return;
    }
    this.lastShownKey = dedupeKey;
    this.lastShownAt = now;

    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }

    this.feedbackStateSubject.next({
      isVisible: true,
      message: normalizedMessage,
      type
    });

    if (durationMs > 0) {
      this.hideTimer = setTimeout(() => {
        this.hide();
      }, durationMs);
    }
  }

  hide(): void {
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }

    this.feedbackStateSubject.next({
      isVisible: false,
      message: '',
      type: 'info'
    });
  }
}
