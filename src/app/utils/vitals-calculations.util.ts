/** Parse systolic/diastolic from vital fields or bloodPressure label (e.g. "120/80"). */
export function parseBloodPressureParts(vital: any): { systolic: number | null; diastolic: number | null } {
  let sys = Number(vital?.systolic);
  let dia = Number(vital?.diastolic);
  const hasSys = Number.isFinite(sys) && sys > 0;
  const hasDia = Number.isFinite(dia) && dia > 0;
  if (hasSys && hasDia) {
    return { systolic: sys, diastolic: dia };
  }

  const bp = vital?.bloodPressure;
  if (bp != null && String(bp).trim() !== '') {
    const match = String(bp).trim().match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/);
    if (match) {
      sys = Number(match[1]);
      dia = Number(match[2]);
      if (Number.isFinite(sys) && sys > 0 && Number.isFinite(dia) && dia > 0) {
        return { systolic: sys, diastolic: dia };
      }
    }
  }

  return {
    systolic: hasSys ? sys : null,
    diastolic: hasDia ? dia : null,
  };
}

/** Pulse pressure (mmHg) = systolic − diastolic. */
export function computePulsePressure(vital: any): number | null {
  const stored = Number(vital?.pulsePressure);
  if (Number.isFinite(stored)) {
    return Math.round(stored);
  }

  const { systolic, diastolic } = parseBloodPressureParts(vital);
  if (systolic == null || diastolic == null) {
    return null;
  }
  const pp = systolic - diastolic;
  return Number.isFinite(pp) ? Math.round(pp) : null;
}

export function formatPulsePressureDisplay(vitalOrValue: any): string {
  if (vitalOrValue != null && typeof vitalOrValue === 'object') {
    const pp = computePulsePressure(vitalOrValue);
    return pp == null ? '—' : String(pp);
  }
  const n = Number(vitalOrValue);
  return Number.isFinite(n) ? String(Math.round(n)) : '—';
}
