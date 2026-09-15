export type PrescribingPeriodBasis = 'DAY' | 'WEEK' | 'MONTH' | 'BODY_WEIGHT' | '';

export type PrescribingFrequencyMode = 'FIXED_INTERVAL' | 'CUSTOM_HOURS' | '';

export interface PrescribingDosageLine {
  enabled: boolean;
  dose: string;
  unit: string;
  notes: string;
}

export interface PrescribingDosageProfiles {
  bodyWeight: PrescribingDosageLine;
  neonate: PrescribingDosageLine;
  pediatric: PrescribingDosageLine;
  adult: PrescribingDosageLine;
}

export const PRESCRIBING_PERIOD_BASIS_OPTIONS: { value: PrescribingPeriodBasis; label: string }[] = [
  { value: 'DAY', label: 'By day' },
  { value: 'WEEK', label: 'By week' },
  { value: 'MONTH', label: 'By month' },
  { value: 'BODY_WEIGHT', label: 'Per body weight' },
];

export const PRESCRIBING_FREQUENCY_FIXED_OPTIONS: { value: string; label: string }[] = [
  { value: 'OD', label: 'Once daily (OD)' },
  { value: 'BD', label: 'Twice daily (BD)' },
  { value: 'TDS', label: 'Three times daily (TDS)' },
  { value: 'QID', label: 'Four times daily (QID)' },
  { value: 'QHS', label: 'At bedtime (QHS)' },
  { value: 'PRN', label: 'As needed (PRN)' },
];

export const PRESCRIBING_DOSAGE_PROFILE_LABELS: { key: keyof PrescribingDosageProfiles; label: string; hint: string }[] = [
  { key: 'bodyWeight', label: 'Per body weight', hint: 'e.g. 10 mg/kg' },
  { key: 'neonate', label: 'Neonate dosage', hint: 'e.g. 5 mg' },
  { key: 'pediatric', label: 'Pediatric dosage', hint: 'e.g. 125 mg' },
  { key: 'adult', label: 'Adult dosage', hint: 'e.g. 500 mg' },
];

export function defaultPrescribingDosageLine(): PrescribingDosageLine {
  return { enabled: false, dose: '', unit: '', notes: '' };
}

export function defaultPrescribingDosageProfiles(): PrescribingDosageProfiles {
  return {
    bodyWeight: { ...defaultPrescribingDosageLine(), unit: 'mg/kg' },
    neonate: defaultPrescribingDosageLine(),
    pediatric: defaultPrescribingDosageLine(),
    adult: defaultPrescribingDosageLine(),
  };
}

export function parsePrescribingDosageJson(raw: unknown): PrescribingDosageProfiles {
  const base = defaultPrescribingDosageProfiles();
  if (!raw || typeof raw !== 'string' || !raw.trim()) {
    return base;
  }
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return base;
    }
    for (const key of Object.keys(base) as (keyof PrescribingDosageProfiles)[]) {
      const row = parsed[key];
      if (row && typeof row === 'object') {
        base[key] = {
          enabled: !!row.enabled,
          dose: row.dose != null ? String(row.dose) : '',
          unit: row.unit != null ? String(row.unit) : base[key].unit,
          notes: row.notes != null ? String(row.notes) : '',
        };
      }
    }
  } catch {
    return base;
  }
  return base;
}

export function serializePrescribingDosageProfiles(profiles: PrescribingDosageProfiles): string {
  return JSON.stringify(profiles);
}

export function parseCustomFrequencyHours(raw: unknown): number[] {
  if (raw == null || raw === '') {
    return [];
  }
  const text = Array.isArray(raw) ? raw.join(',') : String(raw);
  return text
    .split(/[,;\s]+/)
    .map((part) => Number(part.trim()))
    .filter((n) => Number.isFinite(n) && n >= 0 && n <= 24);
}

export function serializeCustomFrequencyHours(hours: number[]): string {
  return hours
    .filter((h) => Number.isFinite(h) && h >= 0 && h <= 24)
    .sort((a, b) => a - b)
    .join(',');
}

export function formatPrescribingPeriodBasisLabel(value: string | null | undefined): string {
  const match = PRESCRIBING_PERIOD_BASIS_OPTIONS.find((o) => o.value === value);
  return match?.label || value || '—';
}

export function formatPrescribingFrequencyLabel(
  mode: string | null | undefined,
  fixed: string | null | undefined,
  customHours: string | null | undefined
): string {
  if (mode === 'CUSTOM_HOURS') {
    const hours = parseCustomFrequencyHours(customHours);
    if (!hours.length) {
      return 'Custom hours (not set)';
    }
    return `At ${hours.map((h) => `${h}h`).join(', ')}`;
  }
  const match = PRESCRIBING_FREQUENCY_FIXED_OPTIONS.find((o) => o.value === fixed);
  return match?.label || fixed || '—';
}
