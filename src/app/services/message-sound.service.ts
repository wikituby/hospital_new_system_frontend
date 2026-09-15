import { Injectable, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import {
  MessagePushEvent,
  MessagingWebSocketService,
} from './messaging-websocket.service';

@Injectable({ providedIn: 'root' })
export class MessageSoundService implements OnDestroy {
  private audioContext?: AudioContext;
  private wsSub?: Subscription;
  private unlockBound = false;
  private activeConversationId: number | null = null;
  private currentUserId: number | null = null;

  constructor(private messagingWs: MessagingWebSocketService) {}

  start(): void {
    this.readCurrentUserId();
    this.bindAudioUnlock();
    this.wsSub?.unsubscribe();
    this.wsSub = this.messagingWs.incoming$.subscribe((event) =>
      this.onPush(event)
    );
  }

  stop(): void {
    this.wsSub?.unsubscribe();
    this.wsSub = undefined;
    this.activeConversationId = null;
    this.currentUserId = null;
  }

  setActiveConversationId(conversationId: number | null): void {
    this.activeConversationId = conversationId;
  }

  ngOnDestroy(): void {
    this.stop();
  }

  private onPush(event: MessagePushEvent): void {
    if (event?.type === 'NEW_MESSAGE' && event.message) {
      this.handleNewMessage(event);
      return;
    }

    if (event?.type === 'QUEUE_PATIENT' || event?.type === 'STOCK_ALERT') {
      this.playBeep();
      return;
    }

    if (event?.type === 'TREATMENT_DOSE_DUE') {
      this.playBeep();
    }
  }

  private handleNewMessage(event: MessagePushEvent): void {
    if (!event.message) {
      return;
    }

    const conversationId = Number(
      event.conversationId ?? event.message.conversationId
    );
    if (!Number.isFinite(conversationId)) {
      return;
    }

    if (conversationId === this.activeConversationId) {
      return;
    }

    const senderId = Number(event.message.senderId);
    if (
      Number.isFinite(senderId) &&
      this.currentUserId != null &&
      senderId === this.currentUserId
    ) {
      return;
    }

    this.playBeep();
  }

  private playBeep(): void {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) {
        return;
      }

      if (ctx.state === 'suspended') {
        void ctx.resume().then(() => this.playBeepTone(ctx));
        return;
      }

      this.playBeepTone(ctx);
    } catch {
      /* ignore autoplay or audio errors */
    }
  }

  private playBeepTone(ctx: AudioContext): void {
    const now = ctx.currentTime;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, now);
    oscillator.frequency.exponentialRampToValueAtTime(660, now + 0.08);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.22, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);

    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.17);
  }

  private getAudioContext(): AudioContext | undefined {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const AudioCtx =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) {
      return undefined;
    }

    if (!this.audioContext) {
      this.audioContext = new AudioCtx();
    }

    return this.audioContext;
  }

  private bindAudioUnlock(): void {
    if (this.unlockBound || typeof document === 'undefined') {
      return;
    }

    this.unlockBound = true;
    const unlock = () => {
      const ctx = this.getAudioContext();
      if (ctx?.state === 'suspended') {
        void ctx.resume();
      }
      document.removeEventListener('click', unlock);
      document.removeEventListener('keydown', unlock);
    };

    document.addEventListener('click', unlock, { once: true });
    document.addEventListener('keydown', unlock, { once: true });
  }

  private readCurrentUserId(): void {
    this.currentUserId = null;

    const userIdStr =
      sessionStorage.getItem('userid') || sessionStorage.getItem('userId');
    if (userIdStr) {
      const parsed = Number(userIdStr);
      if (Number.isFinite(parsed)) {
        this.currentUserId = parsed;
        return;
      }
    }

    const userDetailsStr = sessionStorage.getItem('userDetails');
    if (!userDetailsStr) {
      return;
    }

    try {
      const userDetails = JSON.parse(userDetailsStr);
      const parsed = Number(userDetails.id ?? userDetails.userId);
      if (Number.isFinite(parsed)) {
        this.currentUserId = parsed;
      }
    } catch {
      /* ignore malformed session data */
    }
  }
}
