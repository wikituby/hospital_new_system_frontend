import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import {
  AgentSessionState,
  createEmptyAgentState
} from './doctor-assistant-agent.tools';
import { DoctorAssistantAgentService } from './doctor-assistant-agent.service';
import { ThemeService } from '../services/theme.service';

type Sender = 'user' | 'assistant' | 'system';

interface ChatMessage {
  id: number;
  sender: Sender;
  text: string;
  time: Date;
}

@Component({
  selector: 'app-doctor-assistant',
  templateUrl: './doctor-assistant.component.html',
  styleUrls: ['./doctor-assistant.component.css']
})
export class DoctorAssistantComponent implements OnInit, OnDestroy {
  @ViewChild('chatScroll') chatScroll?: ElementRef<HTMLElement>;

  messages: ChatMessage[] = [];
  draft = '';
  loading = false;
  private nextMessageId = 1;
  isDarkMode = false;
  private themeSub?: Subscription;

  agentState: AgentSessionState = createEmptyAgentState();
  private recentUserMessages: string[] = [];

  showLlmSettings = false;
  llmApiKey = '';
  llmModel = 'llama-3.3-70b-versatile';
  llmServerAvailable = false;
  llmActiveProvider = '';
  readonly freeLlmProviders = [
    { id: 'groq', label: 'Groq (free)', model: 'llama-3.3-70b-versatile', url: 'https://console.groq.com/keys' },
    { id: 'openrouter', label: 'OpenRouter (free models)', model: 'meta-llama/llama-3.3-70b-instruct:free', url: 'https://openrouter.ai/settings/keys' },
    { id: 'ollama', label: 'Ollama (local)', model: 'llama3.2', url: 'https://ollama.com/download' }
  ];

  readonly suggestionPrompts = [
    'Any patient with similar name tumwesigye clynton',
    'Check if patient exists john doe',
    'Load visit 120 and show summary',
    'Search patients named mukasa'
  ];

  constructor(
    private agent: DoctorAssistantAgentService,
    private router: Router,
    private themeService: ThemeService
  ) {}

  ngOnInit(): void {
    this.themeSub = this.themeService.isDarkMode$.subscribe((isDark) => {
      this.isDarkMode = isDark;
    });
    const cfg = this.agent.loadLlmConfig();
    this.llmApiKey = cfg.apiKey;
    this.llmModel = cfg.model;
    this.agent.refreshServerLlmConfig().then((serverCfg) => {
      this.llmServerAvailable = Boolean(serverCfg.serverAvailable);
      this.llmActiveProvider = serverCfg.activeProvider || '';
      if (!this.llmApiKey && serverCfg.model) {
        this.llmModel = serverCfg.model;
      }
      if (this.llmServerAvailable) {
        this.pushSystem(
          `Conversational AI ready (${this.llmActiveProvider || 'server'} · ${this.llmModel}).`
        );
      } else {
        this.pushSystem(
          'Clinical agent ready — patient search works now. For ChatGPT-style conversation, add a free Groq key on the server (see Settings).'
        );
      }
    });
  }

  ngOnDestroy(): void {
    this.themeSub?.unsubscribe();
  }

  get activeVisitId(): number | null {
    return this.agentState.activeVisitId;
  }

  get activePatientId(): number | null {
    return this.agentState.activePatientId;
  }

  get showWelcome(): boolean {
    return !this.messages.some((m) => m.sender === 'user');
  }

  get canSend(): boolean {
    return !this.loading && (this.draft || '').trim().length > 0;
  }

  trackByMessage(_: number, m: ChatMessage): number {
    return m.id;
  }

  useSuggestion(text: string): void {
    this.draft = text;
  }

  autoResizeTextarea(el: HTMLTextAreaElement): void {
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }

  send(): void {
    const text = (this.draft || '').trim();
    if (!text || this.loading) {
      return;
    }
    this.draft = '';
    this.push('user', text);
    this.recentUserMessages.push(text);
    if (this.recentUserMessages.length > 10) {
      this.recentUserMessages.shift();
    }
    this.runAgent(text);
  }

  onDraftEnter(event: KeyboardEvent): void {
    if (event.shiftKey) {
      return;
    }
    event.preventDefault();
    this.send();
  }

  saveLlmSettings(): void {
    this.agent.saveLlmConfig({ apiKey: this.llmApiKey, model: this.llmModel });
    this.showLlmSettings = false;
    this.pushSystem('LLM settings saved for this browser session.');
  }

  applyFreeProvider(p: { model: string; url: string }): void {
    this.llmModel = p.model;
    window.open(p.url, '_blank', 'noopener');
  }

  openVisitPage(): void {
    if (!this.activeVisitId) {
      this.push('assistant', 'Load a visit first — for example: "load visit 120" or "show visit 120".');
      return;
    }
    sessionStorage.setItem('doctorAssistantVisitId', String(this.activeVisitId));
    this.router.navigate(['/overview/consultation-v2']);
  }

  private runAgent(userMessage: string): void {
    this.loading = true;
    this.scrollToBottom();
    const llmConfig = this.agent.loadLlmConfig();

    this.agent
      .processMessage(userMessage, this.agentState, llmConfig, this.recentUserMessages)
      .then((result) => {
        this.agentState = result.state;
        for (const note of result.systemNotes) {
          this.pushSystem(note);
        }
        this.push('assistant', result.reply);
        this.loading = false;
        this.scrollToBottom();
      })
      .catch((err: any) => {
        this.push('assistant', `Something went wrong: ${err?.message || 'Unknown error'}`);
        this.loading = false;
        this.scrollToBottom();
      });
  }

  private push(sender: Sender, text: string): void {
    this.messages.push({
      id: this.nextMessageId++,
      sender,
      text,
      time: new Date()
    });
    this.scrollToBottom();
  }

  private pushSystem(text: string): void {
    this.push('system', text);
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      const el = this.chatScroll?.nativeElement;
      if (el) {
        el.scrollTop = el.scrollHeight;
      }
    }, 0);
  }
}
