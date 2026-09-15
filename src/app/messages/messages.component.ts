import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../services/api.service';
import { Subscription } from 'rxjs';
import { MessagingHubService } from '../services/messaging-hub.service';
import { MessagingWebSocketService, MessagePushEvent } from '../services/messaging-websocket.service';
import { MessageSoundService } from '../services/message-sound.service';
import { ThemeService } from '../services/theme.service';

interface Message {
  id: number;
  senderId: number;
  text: string;
  createdAt?: string;
  time?: string;
  from: 'me' | 'them' | 'system';
  accent?: 'warning' | 'info';
  isRead?: boolean;
  pending?: boolean;
}

interface Conversation {
  id: number;
  participantId: number;
  participantName: string;
  participantUsername?: string;
  name: string;
  title?: string;
  lastMessage: string;
  time: string;
  unread?: number;
  active?: boolean;
}

interface User {
  id: number;
  username: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: string;
}

@Component({
  selector: 'app-messages',
  templateUrl: './messages.component.html',
  styleUrls: ['./messages.component.css'],
})
export class MessagesComponent implements OnInit, OnDestroy {
  @ViewChild('chatBody') chatBody?: ElementRef<HTMLElement>;

  conversations: Conversation[] = [];
  messages: Message[] = [];
  availableUsers: User[] = [];

  currentUserId: number | null = null;
  currentUsername: string = '';

  selectedConversation: Conversation | null = null;
  activeFilter: 'all' | 'unread' = 'all';
  searchText = '';

  isLoading = false;
  isLoadingMessages = false;
  showUserSelector = false;
  errorMessage = '';
  isDarkMode = false;
  private isSwitchingConversation = false;
  private pendingConversationId: number | null = null;

  private routeSub?: Subscription;
  private wsSub?: Subscription;
  private themeSub?: Subscription;

  constructor(
    private api: ApiService,
    private router: Router,
    private route: ActivatedRoute,
    private messagingHub: MessagingHubService,
    private messagingWs: MessagingWebSocketService,
    private messageSound: MessageSoundService,
    private themeService: ThemeService
  ) {}

  ngOnInit(): void {
    this.themeSub = this.themeService.isDarkMode$.subscribe((isDark) => {
      this.isDarkMode = isDark;
    });
    const username = sessionStorage.getItem('username');
    const userDetailsStr = sessionStorage.getItem('userDetails');
    const userIdStr = sessionStorage.getItem('userid') || sessionStorage.getItem('userId');

    if (!username) {
      this.router.navigate(['/login4']);
      return;
    }

    let userId: number | null = null;
    if (userDetailsStr) {
      try {
        const userDetails = JSON.parse(userDetailsStr);
        userId = userDetails.id || userDetails.userId || null;
      } catch {
        /* ignore */
      }
    }
    if (!userId && userIdStr) {
      userId = parseInt(userIdStr, 10);
    }

    this.currentUserId = userId;
    this.currentUsername = username;

    this.routeSub = this.route.queryParamMap.subscribe((params) => {
      const raw = params.get('conversation');
      this.pendingConversationId = raw ? parseInt(raw, 10) : null;
      if (this.conversations.length) {
        this.trySelectPendingConversation();
      }
    });

    this.loadConversations();
    this.loadAvailableUsers();

    this.messagingWs.connect();
    this.wsSub = this.messagingWs.incoming$.subscribe((event) => this.handleRealtimePush(event));
  }

  ngOnDestroy(): void {
    this.messageSound.setActiveConversationId(null);
    this.wsSub?.unsubscribe();
    this.routeSub?.unsubscribe();
    this.themeSub?.unsubscribe();
  }

  private handleRealtimePush(event: MessagePushEvent): void {
    if (event?.type === 'MESSAGES_READ') {
      this.applyMessagesReadPush(Number(event.conversationId));
      return;
    }

    if (event?.type !== 'NEW_MESSAGE' || !event.message) {
      return;
    }

    const conversationId = Number(event.conversationId ?? event.message.conversationId);
    if (!Number.isFinite(conversationId)) {
      return;
    }

    const incoming = this.mapRawMessage(event.message);
    this.applyConversationPreviewFromPush(conversationId, incoming, event.conversation);

    if (this.selectedConversation?.id === conversationId) {
      if (this.messages.some((m) => m.id === incoming.id)) {
        return;
      }
      if (incoming.from === 'me') {
        const optimisticIdx = this.messages.findIndex(
          (m) => m.from === 'me' && m.text === incoming.text && m.id >= 1_000_000_000_000
        );
        if (optimisticIdx !== -1) {
          this.messages[optimisticIdx] = incoming;
          return;
        }
      }
      const wasNearBottom = this.isChatNearBottom();
      this.messages = [...this.messages, incoming].sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeA - timeB;
      });
      if (incoming.from === 'them') {
        this.api.markConversationAsRead(conversationId).subscribe({ error: () => undefined });
      }
      if (wasNearBottom) {
        setTimeout(() => this.scrollChatToBottom(), 50);
      }
    }

    this.messagingHub.syncFromConversations(this.conversations);
    if (this.selectedConversation?.id !== conversationId) {
      this.messagingHub.refreshBadge();
    }
  }

  private applyConversationPreviewFromPush(
    conversationId: number,
    message: Message,
    conversationPayload?: MessagePushEvent['conversation']
  ): void {
    let conv = this.conversations.find((c) => c.id === conversationId);
    if (!conv && conversationPayload) {
      conv = this.mapConversation({
        ...conversationPayload,
        id: conversationPayload.id ?? conversationPayload.conversationId ?? conversationId,
      });
      this.conversations = [conv, ...this.conversations];
    }
    if (!conv) {
      return;
    }
    conv.lastMessage = message.text;
    conv.time = message.time || 'Now';
    if (this.selectedConversation?.id !== conversationId && message.from === 'them') {
      conv.unread = (conv.unread || 0) + 1;
    }
  }

  private applyMessagesReadPush(conversationId: number): void {
    if (!Number.isFinite(conversationId)) {
      return;
    }
    if (this.selectedConversation?.id === conversationId) {
      this.messages = this.messages.map((m) =>
        m.from === 'me' ? { ...m, isRead: true, pending: false } : m
      );
    }
    const conv = this.conversations.find((c) => c.id === conversationId);
    if (conv) {
      conv.unread = 0;
    }
    this.messagingHub.syncFromConversations(this.conversations);
  }

  private mapRawMessage(msg: any, index = 0): Message {
    const isMe =
      msg.senderId === this.currentUserId ||
      msg.sender?.id === this.currentUserId ||
      msg.userId === this.currentUserId ||
      msg.fromUserId === this.currentUserId ||
      String(msg.senderId ?? msg.sender?.id ?? '') === String(this.currentUserId ?? '');
    const messageTime =
      msg.createdAt || msg.timestamp || msg.created_at || new Date().toISOString();
    return {
      id: msg.id || msg.messageId || Date.now() + index,
      senderId: msg.senderId || msg.sender?.id || msg.userId || this.currentUserId!,
      text: msg.text || msg.message || msg.content || msg.body || '',
      createdAt: messageTime,
      time: this.formatTime(messageTime),
      from: (isMe ? 'me' : 'them') as 'me' | 'them' | 'system',
      isRead: msg.isRead === true || msg.isRead === 'true',
      pending: false,
    };
  }

  loadConversations(silent = false): void {
    if (!silent) {
      this.isLoading = true;
    }
    this.api.getAllConversations().subscribe({
      next: (data: any[]) => {
        const loaded = (Array.isArray(data) ? data : []).map((conv) =>
          this.mapConversation(conv)
        );
        const existingIds = new Set(loaded.map((c) => c.id));
        const localOnly = this.conversations.filter((c) => !existingIds.has(c.id));
        this.conversations = [...localOnly, ...loaded];

        if (this.selectedConversation) {
          const updated = this.conversations.find(
            (c) => c.id === this.selectedConversation!.id
          );
          if (updated) {
            updated.active = true;
            this.selectedConversation = updated;
          }
        }

        this.trySelectPendingConversation();

        if (!this.selectedConversation && this.conversations.length > 0) {
          this.selectConversation(this.conversations[0]);
        }

        this.messagingHub.syncFromConversations(this.conversations);

        if (!silent) {
          this.isLoading = false;
        }
      },
      error: () => {
        if (!silent) {
          this.isLoading = false;
        }
      },
    });
  }

  private mapConversation(conv: any): Conversation {
    const name =
      conv.participantName || conv.otherUserName || conv.username || 'Unknown user';
    return {
      id: conv.id || conv.conversationId,
      participantId: conv.participantId || conv.otherUserId,
      participantName: name,
      participantUsername: conv.participantUsername || conv.username,
      name,
      title: conv.role || conv.participantRole || '',
      lastMessage: conv.lastMessage || conv.lastMessageText || '',
      time: this.formatTime(conv.lastMessageTime || conv.updatedAt || conv.createdAt),
      unread: Number(conv.unreadCount ?? conv.unread ?? 0) || 0,
      active: false,
    };
  }

  private trySelectPendingConversation(): void {
    if (!this.pendingConversationId) {
      return;
    }
    const conv = this.conversations.find((c) => c.id === this.pendingConversationId);
    if (conv) {
      this.selectConversation(conv);
      this.pendingConversationId = null;
    }
  }

  loadAvailableUsers(): void {
    this.api.getAvailableUsers().subscribe({
      next: (data: any[]) => {
        this.availableUsers = this.mapUsers(data);
      },
      error: () => {
        this.api.getAllUsers().subscribe({
          next: (users: any[]) => {
            this.availableUsers = this.mapUsers(users);
          },
          error: () => {
            this.errorMessage = 'Unable to load users. Please try again later.';
          },
        });
      },
    });
  }

  private mapUsers(data: any[]): User[] {
    return (Array.isArray(data) ? data : [])
      .map((user) => ({
        id: user.id,
        username: user.username || '',
        firstName: user.firstName || user.first_name || '',
        lastName: user.lastName || user.last_name || '',
        email: user.email || '',
        role: user.role || '',
      }))
      .filter((user) => user.id !== this.currentUserId);
  }

  loadMessages(conversationId: number, clearMessages = false): void {
    if (!conversationId) {
      this.isLoadingMessages = false;
      this.isSwitchingConversation = false;
      return;
    }

    if (this.selectedConversation && this.selectedConversation.id !== conversationId) {
      this.isSwitchingConversation = false;
      return;
    }

    if (clearMessages) {
      this.messages = [];
    }
    if (clearMessages || this.messages.length === 0) {
      this.isLoadingMessages = true;
    }

    this.api.getConversationMessages(conversationId).subscribe({
      next: (response: any) => {
        if (this.selectedConversation?.id !== conversationId) {
          this.isLoadingMessages = false;
          this.isSwitchingConversation = false;
          return;
        }

        const wasNearBottom = clearMessages || this.isChatNearBottom();
        const data = this.extractMessageArray(response);
        const newMessages = data.map((msg: any, index: number) =>
          this.mapRawMessage(msg, index)
        );

        if (clearMessages) {
          this.messages = newMessages;
        } else {
          const existingIds = new Set(this.messages.map((m) => m.id));
          const toAdd = newMessages.filter((m) => !existingIds.has(m.id));
          if (toAdd.length === 0) {
            this.isLoadingMessages = false;
            this.isSwitchingConversation = false;
            return;
          }
          this.messages = [...this.messages, ...toAdd].sort((a, b) => {
            const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return timeA - timeB;
          });
        }

        if (this.selectedConversation) {
          this.selectedConversation.unread = 0;
        }

        this.isLoadingMessages = false;
        this.isSwitchingConversation = false;
        if (wasNearBottom) {
          setTimeout(() => this.scrollChatToBottom(), 50);
        }
      },
      error: () => {
        if (this.selectedConversation?.id !== conversationId) {
          return;
        }
        this.isLoadingMessages = false;
        this.isSwitchingConversation = false;
        if (clearMessages) {
          this.messages = [];
        }
      },
    });
  }

  private extractMessageArray(response: any): any[] {
    if (Array.isArray(response)) {
      return response;
    }
    if (response?.data && Array.isArray(response.data)) {
      return response.data;
    }
    if (response?.messages && Array.isArray(response.messages)) {
      return response.messages;
    }
    return [];
  }

  selectConversation(conv: Conversation): void {
    if (this.selectedConversation?.id === conv.id) {
      return;
    }

    this.isSwitchingConversation = true;
    this.conversations.forEach((c) => (c.active = c.id === conv.id));
    this.selectedConversation = conv;
    this.messageSound.setActiveConversationId(conv.id);
    const previousUnread = conv.unread || 0;
    conv.unread = 0;
    this.messagingHub.onConversationRead(previousUnread);

    this.messages = [];
    this.isLoadingMessages = true;
    this.loadMessages(conv.id, true);

    this.api.markConversationAsRead(conv.id).subscribe({
      error: () => {
        /* loadMessages also marks read on backend */
      },
    });
  }

  startConversation(user: User): void {
    if (!user?.id) {
      return;
    }

    const existingConv = this.conversations.find((c) => c.participantId === user.id);
    if (existingConv) {
      this.selectConversation(existingConv);
      this.showUserSelector = false;
      return;
    }

    this.isLoading = true;
    this.api.createConversation(user.id).subscribe({
      next: (response: any) => {
        const conversation = response?.data ?? response;
        const displayName = user.username || user.email || 'User';
        const newConv: Conversation = {
          id: conversation.id || conversation.conversationId,
          participantId: user.id,
          participantName: displayName,
          participantUsername: user.username,
          name: displayName,
          title: user.role || '',
          lastMessage: '',
          time: 'Now',
          unread: 0,
          active: true,
        };

        this.conversations = [
          newConv,
          ...this.conversations.filter((c) => c.participantId !== user.id),
        ];
        this.selectConversation(newConv);
        this.showUserSelector = false;
        this.isLoading = false;
        this.messagingHub.syncFromConversations(this.conversations);
      },
      error: () => {
        this.errorMessage = 'Could not start conversation. Please try again.';
        this.isLoading = false;
      },
    });
  }

  sendMessage(input: HTMLTextAreaElement): void {
    const value = input.value.trim();
    if (!value || !this.selectedConversation) {
      return;
    }

    const tempId = Date.now();
    const time = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    const tempMessage: Message = {
      id: tempId,
      senderId: this.currentUserId!,
      text: value,
      time,
      from: 'me',
      pending: true,
      isRead: false,
    };
    this.messages.push(tempMessage);
    this.selectedConversation.lastMessage = value;
    this.selectedConversation.time = 'Now';
    input.value = '';
    this.scrollChatToBottom();

    this.api.sendMessage(this.selectedConversation.id, value).subscribe({
      next: (response: any) => {
        const messageData = response?.data ?? response;
        const index = this.messages.findIndex((m) => m.id === tempId);
        if (index !== -1) {
          this.messages[index] = {
            id: messageData.id || messageData.messageId || tempId,
            senderId: this.currentUserId!,
            text: value,
            createdAt:
              messageData.createdAt ||
              messageData.created_at ||
              new Date().toISOString(),
            time: this.formatTime(
              messageData.createdAt || messageData.created_at || new Date().toISOString()
            ),
            from: 'me',
            pending: false,
            isRead: messageData.isRead === true,
          };
        }
        this.messagingHub.syncFromConversations(this.conversations);
      },
      error: () => {
        const index = this.messages.findIndex((m) => m.id === tempId);
        if (index !== -1) {
          this.messages[index].time = 'Failed to send';
        }
      },
    });
  }

  onMessageKeydown(event: KeyboardEvent, input: HTMLTextAreaElement): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage(input);
    }
  }

  scrollChatToBottom(): void {
    const el = this.chatBody?.nativeElement;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }

  /** Only auto-scroll on new messages if the user is already at the bottom (WhatsApp behaviour). */
  private isChatNearBottom(thresholdPx = 80): boolean {
    const el = this.chatBody?.nativeElement;
    if (!el) {
      return true;
    }
    return el.scrollHeight - el.scrollTop - el.clientHeight <= thresholdPx;
  }

  formatTime(dateString?: string): string {
    if (!dateString) {
      return 'Now';
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
      return `${diffMins}m ago`;
    }
    if (diffHours < 24) {
      return `${diffHours}h ago`;
    }
    if (diffDays < 7) {
      return `${diffDays}d ago`;
    }

    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  get hasUnread(): boolean {
    return this.conversations?.some((c) => (c.unread || 0) > 0) ?? false;
  }

  get totalUnread(): number {
    return this.conversations.reduce((sum, c) => sum + (c.unread || 0), 0);
  }

  get filteredConversations(): Conversation[] {
    let list = this.conversations;

    if (this.activeFilter === 'unread') {
      list = list.filter((c) => (c.unread || 0) > 0);
    }

    if (this.searchText?.trim()) {
      const term = this.searchText.toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(term) ||
          c.participantUsername?.toLowerCase().includes(term) ||
          c.lastMessage.toLowerCase().includes(term)
      );
    }

    return list;
  }

  get filteredAvailableUsers(): User[] {
    if (!this.searchText?.trim()) {
      return this.availableUsers;
    }

    const term = this.searchText.toLowerCase();
    return this.availableUsers.filter(
      (u) =>
        u.username.toLowerCase().includes(term) ||
        `${u.firstName} ${u.lastName}`.toLowerCase().includes(term) ||
        u.email?.toLowerCase().includes(term) ||
        u.role?.toLowerCase().includes(term)
    );
  }

  setFilter(filter: 'all' | 'unread'): void {
    this.activeFilter = filter;
  }

  toggleUserSelector(): void {
    this.showUserSelector = !this.showUserSelector;
    this.errorMessage = '';
    if (this.showUserSelector && this.availableUsers.length === 0) {
      this.loadAvailableUsers();
    }
  }

  displayUserName(user: User): string {
    const full = `${user.firstName || ''} ${user.lastName || ''}`.trim();
    return full || user.username || user.email || 'User';
  }

  trackByMessageId(index: number, msg: Message): number {
    return msg.id || index;
  }
}
