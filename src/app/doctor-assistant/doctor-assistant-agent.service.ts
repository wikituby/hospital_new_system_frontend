import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../services/api.service';
import {
  AgentLlmConfig,
  AgentSessionState,
  AgentTurnResult,
  DOCTOR_ASSISTANT_TOOLS,
  createEmptyAgentState,
  executeDoctorAssistantTool,
  extractNameFromMessage,
  formatPatientSummary,
  matchPatientsSimilar
} from './doctor-assistant-agent.tools';

const SYSTEM_PROMPT = `You are Doctor Assistant for a hospital EMR (VMD / Kavuma Medical Center).
You help clinicians through registry lookup, vitals, consultation, investigations, and treatment planning.

Rules:
- Understand natural language. Users will NOT use rigid commands.
- When asked about patients by name (including "similar name", "anyone like", "does X exist"), call search_patients.
- Use similar=true for partial/fuzzy/similar name searches.
- Before saving clinical data, ensure a visit is loaded or ask which visit to use.
- When saving, map conversational data to the JSON fields expected by the hospital API tools.
- Be concise, clinical, and helpful. After tool results, summarize clearly for the doctor.
- If multiple patients match, list them and ask which to open.
- Never invent patient ids or visit ids — always use tool results.`;

@Injectable({ providedIn: 'root' })
export class DoctorAssistantAgentService {
  private serverLlmConfig: AgentLlmConfig | null = null;

  constructor(private api: ApiService) {}

  createState(): AgentSessionState {
    return createEmptyAgentState();
  }

  /** Load server LLM config once per session (Groq / Ollama / OpenRouter on backend). */
  async refreshServerLlmConfig(): Promise<AgentLlmConfig> {
    try {
      const cfg: any = await firstValueFrom(this.api.doctorAssistantLlmConfig());
      const merged = this.loadLlmConfig();
      merged.serverAvailable = Boolean(cfg?.available);
      merged.activeProvider = cfg?.activeProvider || '';
      merged.keySource = cfg?.keySource || 'none';
      if (cfg?.model && !sessionStorage.getItem('doctorAssistantLlmModel')) {
        merged.model = cfg.model;
      }
      this.serverLlmConfig = merged;
      return merged;
    } catch {
      return this.loadLlmConfig();
    }
  }

  loadLlmConfig(): AgentLlmConfig {
    const cached = this.serverLlmConfig;
    return {
      apiKey: sessionStorage.getItem('doctorAssistantLlmApiKey') || '',
      model: sessionStorage.getItem('doctorAssistantLlmModel') || 'llama-3.3-70b-versatile',
      serverAvailable: cached?.serverAvailable,
      activeProvider: cached?.activeProvider,
      keySource: cached?.keySource
    };
  }

  saveLlmConfig(config: AgentLlmConfig): void {
    if (config.apiKey?.trim()) {
      sessionStorage.setItem('doctorAssistantLlmApiKey', config.apiKey.trim());
    } else {
      sessionStorage.removeItem('doctorAssistantLlmApiKey');
    }
    sessionStorage.setItem('doctorAssistantLlmModel', config.model || 'llama-3.3-70b-versatile');
  }

  private canUseLlm(llmConfig: AgentLlmConfig): boolean {
    return Boolean(llmConfig.apiKey?.trim()) || Boolean(llmConfig.serverAvailable);
  }

  async processMessage(
    userMessage: string,
    state: AgentSessionState,
    llmConfig: AgentLlmConfig,
    recentUserMessages: string[] = []
  ): Promise<AgentTurnResult> {
    const text = (userMessage || '').trim();
    if (!text) {
      return {
        reply: 'Please type a message.',
        systemNotes: [],
        state,
        usedLlm: false
      };
    }

    const hasLlmKey = this.canUseLlm(llmConfig);
    if (hasLlmKey) {
      try {
        return await this.runLlmAgent(text, state, llmConfig);
      } catch (err: any) {
        const fallback = await this.runLocalAgent(text, state, recentUserMessages);
        fallback.systemNotes.push(
          `LLM unavailable (${err?.message || 'error'}). Answered using built-in agent.`
        );
        return fallback;
      }
    }

    return this.runLocalAgent(text, state, recentUserMessages);
  }

  /** Built-in agent: no API key required; understands free-form clinical chat. */
  private async runLocalAgent(
    userMessage: string,
    state: AgentSessionState,
    recentUserMessages: string[] = []
  ): Promise<AgentTurnResult> {
    const notes: string[] = [];
    const lower = userMessage.toLowerCase();

    if (/^(hi|hello|hey|good\s+(morning|afternoon|evening))\b/.test(lower)) {
      return {
        reply:
          'Hello. I can search patients (including similar names), load visits, review clinical data, and save vitals, consultations, treatments, or orders.',
        systemNotes: notes,
        state,
        usedLlm: false
      };
    }

    if (/\b(summary|status|where are we)\b/.test(lower)) {
      const { result, state: next } = await executeDoctorAssistantTool(
        'get_session_summary',
        {},
        state,
        this.api
      );
      return {
        reply: this.formatSummaryReply(result),
        systemNotes: notes,
        state: next,
        usedLlm: false
      };
    }

    const visitIdMatch = userMessage.match(/\bvisit\s+#?(\d+)\b/i);
    if (visitIdMatch) {
      notes.push(`Loading visit ${visitIdMatch[1]}…`);
      const { result, state: next } = await executeDoctorAssistantTool(
        'load_visit',
        { visitId: Number(visitIdMatch[1]) },
        state,
        this.api
      );
      return {
        reply: `Visit loaded.\n${this.formatSummaryReply(result)}`,
        systemNotes: notes,
        state: next,
        usedLlm: false
      };
    }

    const patientIdMatch = userMessage.match(/\bpatient\s+#?(\d+)\b/i);
    if (patientIdMatch && !/name|similar|find|search|check|exist/i.test(lower)) {
      const { result, state: next } = await executeDoctorAssistantTool(
        'get_patient',
        { patientId: Number(patientIdMatch[1]) },
        state,
        this.api
      );
      const patient = (result as any)?.patient ?? 'Patient loaded.';
      return { reply: String(patient), systemNotes: notes, state: next, usedLlm: false };
    }

    const isPatientLookup =
      /\b(patient|registry|similar|name|find|search|check|exist|lookup|anyone|match|like)\b/i.test(
        lower
      );

    if (isPatientLookup) {
      const name =
        extractNameFromMessage(userMessage) ||
        this.nameFromRecentMessages(recentUserMessages) ||
        state.lastPatientSearchQuery ||
        this.nameFromRecentContext(state);

      if (!name) {
        return {
          reply:
            'Which patient name should I search for? For example: "any patient with similar name tumwesigye".',
          systemNotes: notes,
          state,
          usedLlm: false
        };
      }

      const similar =
        /\b(similar|like|match|close|partial|sound|anyone)\b/i.test(lower) || !extractNameFromMessage(userMessage);

      notes.push(`Searching registry${similar ? ' (similar names)' : ''} for "${name}"…`);

      const { result, state: next } = await executeDoctorAssistantTool(
        'search_patients',
        { query: name, similar },
        state,
        this.api
      );

      const r = result as { count?: number; patients?: string[]; query?: string };
      if (!r.count) {
        return {
          reply: `No patients found${similar ? ' with similar names' : ''} for "${name}". They may need to be registered first.`,
          systemNotes: notes,
          state: next,
          usedLlm: false
        };
      }

      if (r.count === 1 && r.patients?.[0]) {
        const rows = await firstValueFrom(this.api.getAllPatients());
        const list = Array.isArray(rows) ? rows : [];
        const match = matchPatientsSimilar(name, list)[0];
        if (match) {
          next.context.patient = match;
          const id = Number(match?.id ?? match?.patientId);
          if (Number.isFinite(id)) {
            next.activePatientId = id;
          }
        }
        return {
          reply: `Found 1 patient:\n${r.patients[0]}\n\nI've set them as the active patient for this session.`,
          systemNotes: notes,
          state: next,
          usedLlm: false
        };
      }

      const lines = (r.patients || []).map((p, i) => `${i + 1}. ${p}`).join('\n');
      const more = (r.count ?? 0) > (r.patients?.length ?? 0) ? `\n… and ${(r.count ?? 0) - (r.patients?.length ?? 0)} more.` : '';
      return {
        reply: `Found ${r.count} patient(s) matching "${name}":\n${lines}${more}\n\nTell me which patient id to load, or give a more specific name.`,
        systemNotes: notes,
        state: next,
        usedLlm: false
      };
    }

    // Treat short name-like messages as patient search (e.g. "tumwesigye clynton")
    const extractedName = extractNameFromMessage(userMessage);
    const looksLikeName =
      extractedName &&
      extractedName.split(/\s+/).length >= 1 &&
      !/^(summary|help|yes|no|ok|thanks|thank you)$/i.test(extractedName);

    if (looksLikeName && !/\b(visit|vitals|consult|treat|order|save|summary)\b/i.test(lower)) {
      notes.push(`Searching registry (similar names) for "${extractedName}"…`);
      const { result, state: next } = await executeDoctorAssistantTool(
        'search_patients',
        { query: extractedName, similar: true },
        state,
        this.api
      );
      const r = result as { count?: number; patients?: string[] };
      if (!r.count) {
        return {
          reply: `No patients found with similar names for "${extractedName}". They may need to be registered first.`,
          systemNotes: notes,
          state: next,
          usedLlm: false
        };
      }
      const lines = (r.patients || []).map((p, i) => `${i + 1}. ${p}`).join('\n');
      return {
        reply: `Found ${r.count} patient(s) matching "${extractedName}":\n${lines}`,
        systemNotes: notes,
        state: next,
        usedLlm: false
      };
    }

    return {
      reply:
        'I can help with patient search (including similar names), visit lookup, and saving clinical data. Try: "any patient with similar name tumwesigye" or "load visit 120".',
      systemNotes: notes,
      state,
      usedLlm: false
    };
  }

  private async runLlmAgent(
    userMessage: string,
    state: AgentSessionState,
    llmConfig: AgentLlmConfig
  ): Promise<AgentTurnResult> {
    const notes: string[] = [];
    let working = { ...state, llmMessages: [...state.llmMessages] };

    if (!working.llmMessages.length) {
      working.llmMessages.push({
        role: 'system',
        content: SYSTEM_PROMPT + `\n\nCurrent session: ${JSON.stringify({
          activePatientId: working.activePatientId,
          activeVisitId: working.activeVisitId,
          lastPatientSearchQuery: working.lastPatientSearchQuery
        })}`
      });
    }

    working.llmMessages.push({ role: 'user', content: userMessage });

    for (let step = 0; step < 8; step++) {
      const response: any = await firstValueFrom(
        this.api.doctorAssistantLlmChat({
          messages: working.llmMessages,
          tools: DOCTOR_ASSISTANT_TOOLS,
          model: llmConfig.model,
          ...(llmConfig.apiKey?.trim() ? { apiKey: llmConfig.apiKey.trim() } : {})
        })
      );

      const choice = response?.choices?.[0]?.message ?? response?.data?.choices?.[0]?.message;
      if (!choice) {
        throw new Error('Invalid LLM response');
      }

      const toolCalls = choice.tool_calls ?? choice.toolCalls;
      if (Array.isArray(toolCalls) && toolCalls.length) {
        working.llmMessages.push(choice);

        for (const tc of toolCalls) {
          const fn = tc.function ?? tc;
          const name = fn.name;
          let args: Record<string, unknown> = {};
          try {
            args = JSON.parse(fn.arguments || '{}');
          } catch {
            args = {};
          }

          notes.push(`Tool: ${name}`);
          const executed = await executeDoctorAssistantTool(name, args, working, this.api);
          working = { ...executed.state, llmMessages: [...working.llmMessages] };

          working.llmMessages.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: JSON.stringify(executed.result)
          });
        }
        continue;
      }

      const content = String(choice.content ?? '').trim();
      working.llmMessages.push({ role: 'assistant', content });

      return {
        reply: content || 'Done.',
        systemNotes: notes,
        state: working,
        usedLlm: true
      };
    }

    return {
      reply: 'I need another step to finish that request. Please try again with a bit more detail.',
      systemNotes: notes,
      state: working,
      usedLlm: true
    };
  }

  private formatSummaryReply(result: unknown): string {
    const r = result as Record<string, unknown>;
    const lines = [
      `Patient: ${r['patient'] ?? 'Not loaded'}`,
      `Visit ID: ${r['activeVisitId'] ?? 'Not loaded'}`,
      `Vitals: ${r['vitalsCount'] ?? 0}`,
      `Consultations: ${r['consultationsCount'] ?? 0}`,
      `Treatments: ${r['treatmentsCount'] ?? 0}`,
      `Lab orders: ${r['labOrdersCount'] ?? 0}`,
      `Scan orders: ${r['scanOrdersCount'] ?? 0}`
    ];
    return lines.join('\n');
  }

  private nameFromRecentContext(state: AgentSessionState): string {
    if (state.context.patient) {
      return formatPatientSummary(state.context.patient).split(' (ID')[0];
    }
    return '';
  }

  private nameFromRecentMessages(recentUserMessages: string[]): string {
    for (let i = recentUserMessages.length - 2; i >= 0; i--) {
      const n = extractNameFromMessage(recentUserMessages[i]);
      if (n) {
        return n;
      }
    }
    return '';
  }
}
