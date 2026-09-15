import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ApiService } from './api.service';

export interface HeaderMessagePreview {
  id: number;
  participantId: number;
  participantName: string;
  participantUsername?: string;
  lastMessage: string;
  timeLabel: string;
  unread: number;
}

@Injectable({ providedIn: 'root' })
export class HeaderMessagesService {
  constructor(private api: ApiService) {}

  fetchPreviews(limit = 12): Observable<{
    previews: HeaderMessagePreview[];
    totalUnread: number;
  }> {
    return this.api.getAllConversations().pipe(
      map((rows: any[]) => {
        const list = Array.isArray(rows) ? rows : [];
        const mapped = list
          .map((conv) => this.mapConversation(conv))
          .sort((a, b) => {
            if ((b.unread || 0) !== (a.unread || 0)) {
              return (b.unread || 0) - (a.unread || 0);
            }
            return (b.sortTime || 0) - (a.sortTime || 0);
          });
        const totalUnread = mapped.reduce((sum, c) => sum + (c.unread || 0), 0);
        const previews = mapped.slice(0, limit).map(({ sortTime, ...rest }) => rest);
        return { previews, totalUnread };
      }),
      catchError(() => of({ previews: [], totalUnread: 0 }))
    );
  }

  private mapConversation(conv: any): HeaderMessagePreview & { sortTime: number } {
    const lastTime = conv.lastMessageTime || conv.updatedAt || conv.createdAt;
    return {
      id: conv.id || conv.conversationId,
      participantId: conv.participantId || conv.otherUserId,
      participantName:
        conv.participantName || conv.otherUserName || conv.username || 'Unknown user',
      participantUsername: conv.participantUsername || conv.username,
      lastMessage: conv.lastMessage || conv.lastMessageText || '',
      timeLabel: this.formatTime(lastTime),
      unread: Number(conv.unreadCount ?? conv.unread ?? 0) || 0,
      sortTime: this.parseTime(lastTime),
    };
  }

  private parseTime(value: any): number {
    if (!value) {
      return 0;
    }
    if (Array.isArray(value) && value.length >= 3) {
      const y = Number(value[0]);
      const mo = Number(value[1]);
      const d = Number(value[2]);
      const h = value.length > 3 ? Number(value[3]) : 0;
      const mi = value.length > 4 ? Number(value[4]) : 0;
      return new Date(y, mo - 1, d, h, mi).getTime();
    }
    const t = new Date(value).getTime();
    return Number.isNaN(t) ? 0 : t;
  }

  private formatTime(dateString?: string): string {
    if (!dateString) {
      return '';
    }
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) {
      return 'Now';
    }
    if (diffMins < 60) {
      return `${diffMins}m`;
    }
    if (diffHours < 24) {
      return `${diffHours}h`;
    }
    if (diffDays < 7) {
      return `${diffDays}d`;
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
}
