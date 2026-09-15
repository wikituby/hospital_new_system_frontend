import { firstValueFrom } from 'rxjs';
import { ApiService } from '../services/api.service';

/** OpenAI-compatible tool definitions for the clinical agent. */
export const DOCTOR_ASSISTANT_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'search_patients',
      description:
        'Search the patient registry by name. Use similar=true for partial/fuzzy matches (e.g. similar surname or spelling).',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Patient name or name fragment to search' },
          similar: {
            type: 'boolean',
            description: 'When true, return partial/similar name matches'
          }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_patient',
      description: 'Load full patient record by numeric patient id.',
      parameters: {
        type: 'object',
        properties: {
          patientId: { type: 'number' }
        },
        required: ['patientId']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'load_visit',
      description: 'Load a visit and its clinical data (vitals, consultation, treatments, orders).',
      parameters: {
        type: 'object',
        properties: {
          visitId: { type: 'number' }
        },
        required: ['visitId']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'save_vitals',
      description: 'Save triage vitals for the active visit. Map natural language to API fields (weight kg, temperature, BP, pulse, etc.).',
      parameters: {
        type: 'object',
        properties: {
          visitId: { type: 'number' },
          data: { type: 'object', description: 'InitialTriageVitals payload for create-new-InitialTriageVitals' }
        },
        required: ['visitId', 'data']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'save_consultation',
      description: 'Save consultation notes, complaints, history, diagnosis for a visit.',
      parameters: {
        type: 'object',
        properties: {
          visitId: { type: 'number' },
          data: { type: 'object', description: 'Consultation request body' }
        },
        required: ['visitId', 'data']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'save_treatment',
      description: 'Add a drug/treatment line to the visit treatment plan.',
      parameters: {
        type: 'object',
        properties: {
          visitId: { type: 'number' },
          data: { type: 'object', description: 'TreatmentRequested payload' }
        },
        required: ['visitId', 'data']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'order_procedure',
      description: 'Order a lab test, scan, or other procedure for the visit.',
      parameters: {
        type: 'object',
        properties: {
          visitId: { type: 'number' },
          data: { type: 'object', description: 'ProcedureRequested payload' }
        },
        required: ['visitId', 'data']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_session_summary',
      description: 'Summarize the currently loaded patient/visit session.',
      parameters: {
        type: 'object',
        properties: {}
      }
    }
  }
];

export interface AgentSessionState {
  activeVisitId: number | null;
  activePatientId: number | null;
  lastPatientSearchQuery: string;
  context: {
    patient: any | null;
    visit: any | null;
    vitals: any[];
    consultations: any[];
    treatments: any[];
    labOrders: any[];
    scanOrders: any[];
    otherProcedures: any[];
  };
  llmMessages: Array<Record<string, unknown>>;
}

export interface AgentTurnResult {
  reply: string;
  systemNotes: string[];
  state: AgentSessionState;
  usedLlm: boolean;
}

export interface AgentLlmConfig {
  apiKey: string;
  model: string;
  /** Server has a free/provider key configured — use backend proxy without browser key. */
  serverAvailable?: boolean;
  activeProvider?: string;
  keySource?: string;
}

export function createEmptyAgentState(): AgentSessionState {
  return {
    activeVisitId: null,
    activePatientId: null,
    lastPatientSearchQuery: '',
    context: {
      patient: null,
      visit: null,
      vitals: [],
      consultations: [],
      treatments: [],
      labOrders: [],
      scanOrders: [],
      otherProcedures: []
    },
    llmMessages: []
  };
}

export type ToolExecutor = (
  name: string,
  args: Record<string, unknown>,
  state: AgentSessionState,
  api: ApiService
) => Promise<{ result: unknown; state: AgentSessionState }>;

export async function executeDoctorAssistantTool(
  name: string,
  args: Record<string, unknown>,
  state: AgentSessionState,
  api: ApiService
): Promise<{ result: unknown; state: AgentSessionState }> {
  const next = { ...state, context: { ...state.context } };

  switch (name) {
    case 'search_patients': {
      const query = String(args['query'] ?? '').trim();
      const similar = Boolean(args['similar']);
      if (!query) {
        return { result: { error: 'query is required' }, state: next };
      }
      next.lastPatientSearchQuery = query;
      const rows = await firstValueFrom(api.getAllPatients());
      const list = Array.isArray(rows) ? rows : [];
      const matches = similar
        ? matchPatientsSimilar(query, list)
        : matchPatientsByName(query, list);
      return {
        result: {
          query,
          similar,
          count: matches.length,
          patients: matches.slice(0, 15).map(formatPatientSummary)
        },
        state: next
      };
    }

    case 'get_patient': {
      const patientId = Number(args['patientId']);
      const row = await firstValueFrom(api.getPatientById(patientId));
      applyActivePatient(next, row);
      return { result: { patient: formatPatientSummary(row) }, state: next };
    }

    case 'load_visit': {
      const visitId = Number(args['visitId']);
      const loaded = await loadVisitContext(next, visitId, api);
      return { result: loaded.summary, state: loaded.state };
    }

    case 'save_vitals': {
      const visitId = Number(args['visitId'] ?? next.activeVisitId);
      const data = args['data'] ?? {};
      await firstValueFrom(api.takeVitals(visitId, data));
      const loaded = await loadVisitContext(next, visitId, api);
      return { result: { saved: true, visitId }, state: loaded.state };
    }

    case 'save_consultation': {
      const visitId = Number(args['visitId'] ?? next.activeVisitId);
      const data = args['data'] ?? {};
      await firstValueFrom(api.saveConsultation(visitId, data));
      const loaded = await loadVisitContext(next, visitId, api);
      return { result: { saved: true, visitId }, state: loaded.state };
    }

    case 'save_treatment': {
      const visitId = Number(args['visitId'] ?? next.activeVisitId);
      const data = args['data'] ?? {};
      await firstValueFrom(api.saveTreatmentRequested(visitId, data));
      const loaded = await loadVisitContext(next, visitId, api);
      return { result: { saved: true, visitId }, state: loaded.state };
    }

    case 'order_procedure': {
      const visitId = Number(args['visitId'] ?? next.activeVisitId);
      const data = args['data'] ?? {};
      await firstValueFrom(api.saveProcedure(visitId, data));
      const loaded = await loadVisitContext(next, visitId, api);
      return { result: { saved: true, visitId }, state: loaded.state };
    }

    case 'get_session_summary':
      return { result: buildSessionSummary(next), state: next };

    default:
      return { result: { error: `Unknown tool: ${name}` }, state: next };
  }
}

async function loadVisitContext(
  state: AgentSessionState,
  visitId: number,
  api: ApiService
): Promise<{ state: AgentSessionState; summary: Record<string, unknown> }> {
  const next = { ...state, context: { ...state.context }, activeVisitId: visitId };
  const [visit, vitals, consultations, treatments, labOrders, scanOrders, otherProcedures] =
    await Promise.all([
      firstValueFrom(api.getPatientVisitByVisitId(visitId)).catch(() => null),
      firstValueFrom(api.getInitialVitalsByVisit(visitId)).catch(() => []),
      firstValueFrom(api.getConsultationsByVisit(visitId)).catch(() => []),
      firstValueFrom(api.getTreatmentRequestedByVisit(visitId)).catch(() => []),
      firstValueFrom(api.getLabTestProceduresByVisit(visitId)).catch(() => []),
      firstValueFrom(api.getUltrasoundScanProceduresByVisit(visitId)).catch(() => []),
      firstValueFrom(api.geOtherProceduresByVisit(visitId)).catch(() => [])
    ]);

  next.context.visit = visit;
  next.context.vitals = Array.isArray(vitals) ? vitals : [];
  next.context.consultations = Array.isArray(consultations) ? consultations : [];
  next.context.treatments = Array.isArray(treatments) ? treatments : [];
  next.context.labOrders = Array.isArray(labOrders) ? labOrders : [];
  next.context.scanOrders = Array.isArray(scanOrders) ? scanOrders : [];
  next.context.otherProcedures = Array.isArray(otherProcedures) ? otherProcedures : [];

  const patientId = Number(visit?.patientId ?? visit?.patient?.id ?? next.activePatientId ?? NaN);
  if (Number.isFinite(patientId) && patientId > 0) {
    const patient = await firstValueFrom(api.getPatientById(patientId)).catch(() => null);
    applyActivePatient(next, patient);
  }

  return { state: next, summary: buildSessionSummary(next) };
}

function buildSessionSummary(state: AgentSessionState): Record<string, unknown> {
  return {
    activePatientId: state.activePatientId,
    activeVisitId: state.activeVisitId,
    patient: state.context.patient ? formatPatientSummary(state.context.patient) : null,
    vitalsCount: state.context.vitals.length,
    consultationsCount: state.context.consultations.length,
    treatmentsCount: state.context.treatments.length,
    labOrdersCount: state.context.labOrders.length,
    scanOrdersCount: state.context.scanOrders.length,
    otherProceduresCount: state.context.otherProcedures.length
  };
}

function applyActivePatient(state: AgentSessionState, p: any): void {
  if (!p) {
    return;
  }
  state.context.patient = p;
  const id = Number(p?.id ?? p?.patientId);
  if (Number.isFinite(id) && id > 0) {
    state.activePatientId = id;
  }
}

export function patientFullName(p: any): string {
  const first = String(p?.patientFirstName ?? p?.firstName ?? '').trim();
  const second = String(p?.patientSecondName ?? p?.secondName ?? '').trim();
  const combined = `${first} ${second}`.trim();
  return combined || String(p?.patientName ?? p?.name ?? '').trim();
}

export function formatPatientSummary(p: any): string {
  const id = p?.id ?? p?.patientId ?? '—';
  const name = patientFullName(p) || '—';
  const gender = p?.patientGender ?? p?.gender ?? '—';
  const contact = p?.patientContact ?? p?.phone ?? '—';
  const fileNo = p?.patientFileNumber ?? p?.fileNumber ?? p?.opNumber ?? '—';
  return `${name} (ID: ${id}, OP: ${fileNo}, Gender: ${gender}, Contact: ${contact})`;
}

export function matchPatientsByName(query: string, patients: any[]): any[] {
  const q = (query || '').toLowerCase().trim();
  if (!q) {
    return [];
  }
  const tokens = q.split(/\s+/).filter((t) => t.length > 0);
  return patients.filter((p) => {
    const full = patientFullName(p).toLowerCase();
    const reversed = patientFullNameReversed(p).toLowerCase();
    if (full.includes(q) || reversed.includes(q)) {
      return true;
    }
    return tokens.every((tok) => full.includes(tok) || reversed.includes(tok));
  });
}

export function matchPatientsSimilar(query: string, patients: any[]): any[] {
  const q = (query || '').toLowerCase().trim();
  if (!q) {
    return [];
  }
  const exact = matchPatientsByName(query, patients);
  if (exact.length) {
    return exact;
  }
  const tokens = q.split(/\s+/).filter((t) => t.length >= 2);
  return patients.filter((p) => {
    const parts = patientFullName(p)
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
    return tokens.some((tok) =>
      parts.some(
        (part) =>
          part.includes(tok) ||
          tok.includes(part) ||
          prefixSimilar(part, tok) ||
          part.startsWith(tok.slice(0, Math.min(3, tok.length)))
      )
    );
  });
}

function patientFullNameReversed(p: any): string {
  const first = String(p?.patientFirstName ?? p?.firstName ?? '').trim();
  const second = String(p?.patientSecondName ?? p?.secondName ?? '').trim();
  return `${second} ${first}`.trim();
}

function prefixSimilar(a: string, b: string): boolean {
  if (a.length < 3 || b.length < 3) {
    return false;
  }
  return a.startsWith(b.slice(0, 3)) || b.startsWith(a.slice(0, 3));
}

/** Extract a probable person name from free-form chat text. */
export function extractNameFromMessage(message: string): string | null {
  const quoted = message.match(/["']([^"']+)["']/);
  if (quoted?.[1]?.trim()) {
    return quoted[1].trim();
  }

  let s = message.trim();
  const stripPhrases = [
    /\bany\s+patients?\s+with\s+similar\s+names?\b/gi,
    /\bpatients?\s+with\s+(?:a\s+)?similar\s+names?\b/gi,
    /\bsimilar\s+names?\b/gi,
    /\bcheck\s+for\s+me\b/gi,
    /\bcheck\s+if\b/gi,
    /\bthis\s+patient\s+name\b/gi,
    /\bpatient\s+name\b/gi,
    /\bif\s+exists?\b/gi,
    /\bexists?\b/gi,
    /\bfind\b/gi,
    /\bsearch\b/gi,
    /\blookup\b/gi,
    /\bshow\b/gi,
    /\blist\b/gi,
    /\bpatients?\b/gi,
    /\bfor\s+me\b/gi,
    /\bany\b/gi,
    /\bwith\b/gi,
    /\bnamed\b/gi,
    /\bcalled\b/gi,
    /\bin\s+the\s+(system|registry|database)\b/gi,
    /\bplease\b/gi,
    /\bcan\s+you\b/gi,
    /\bi\s+want\b/gi
  ];
  for (const p of stripPhrases) {
    s = s.replace(p, ' ');
  }
  s = s.replace(/\s+/g, ' ').trim().replace(/^[:\-,\s]+|[?:!.\s]+$/g, '');

  if (s.length >= 2 && s.split(/\s+/).length <= 6 && !/^(summary|help|yes|no|ok)$/i.test(s)) {
    return s;
  }
  return null;
}
