import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class MessagingHubService {
  private readonly totalUnreadSubject = new BehaviorSubject<number>(0);
  readonly totalUnread$ = this.totalUnreadSubject.asObservable();

  constructor(private api: ApiService) {}

  get totalUnread(): number {
    return this.totalUnreadSubject.value;
  }

  /** One lightweight call after login — badge only, no conversation list. */
  refreshBadge(): void {
    this.api.getMessagesUnreadCount().subscribe({
      next: (count) => this.totalUnreadSubject.next(count),
      error: () => this.totalUnreadSubject.next(0),
    });
  }

  /** Sync badge from a conversations payload already loaded on the messages page. */
  syncFromConversations(conversations: Array<{ unread?: number; unreadCount?: number }>): void {
    const total = (conversations || []).reduce(
      (sum, conv) => sum + (Number(conv.unreadCount ?? conv.unread ?? 0) || 0),
      0
    );
    this.totalUnreadSubject.next(total);
  }

  /** After opening a thread and marking it read locally. */
  onConversationRead(previousUnread: number): void {
    if (previousUnread > 0) {
      this.totalUnreadSubject.next(Math.max(0, this.totalUnread - previousUnread));
    }
  }

  setTotalUnread(count: number): void {
    this.totalUnreadSubject.next(Math.max(0, count));
  }

  reset(): void {
    this.totalUnreadSubject.next(0);
  }
}
