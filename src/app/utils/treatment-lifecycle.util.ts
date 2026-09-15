/** Shared PD / DSP / ADM flags for treatment-plan and prescription rows. */
export type TreatmentLifecycleFlag = 'paid' | 'dispensed' | 'administered';

export interface TreatmentLifecycleRow {
  status?: string;
  paid?: boolean;
  dispensed?: boolean;
  administered?: boolean;
  given?: boolean;
}

export function applyTreatmentLifecycleFlags<T extends TreatmentLifecycleRow>(row: T): T {
  if (!row) {
    return row;
  }
  const status = String(row.status ?? '').toLowerCase();
  const dispensedFromStatus = status === 'given' || status === 'dispensed';
  row.paid = row.paid !== false;
  row.dispensed = row.dispensed === true || dispensedFromStatus;
  row.administered = row.administered === true;
  row.given = row.paid !== false;
  return row;
}

export function isTreatmentDispensed(row: TreatmentLifecycleRow | null | undefined): boolean {
  if (!row) {
    return false;
  }
  if (row.dispensed === true) {
    return true;
  }
  const status = String(row.status ?? '').toLowerCase();
  return status === 'given' || status === 'dispensed';
}

export function treatmentLifecyclePatch(
  flag: TreatmentLifecycleFlag,
  checked: boolean
): { paid?: boolean; dispensed?: boolean; administered?: boolean; status?: string } {
  if (flag === 'paid') {
    return { paid: checked };
  }
  if (flag === 'administered') {
    return { administered: checked };
  }
  return {
    dispensed: checked,
    status: checked ? 'dispensed' : 'pending',
    paid: checked ? true : undefined,
  };
}
