/**
 * UGX (shilling) money rules for final payment totals only:
 * - no fractional shillings
 * - amounts not already on a 100 boundary round up to the next 100
 *   e.g. 17120, 17150, 17180 → 17200
 *
 * All other money fields use {@link roundMoney2Decimals} (2 decimal places).
 */
export function roundMoney2Decimals(value: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return 0;
  }
  return Math.round(n * 100) / 100;
}

export function roundMoney2DecimalsOptional(
  value: number | string | null | undefined
): number | null {
  if (value === '' || value === null || value === undefined) {
    return null;
  }
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return null;
  }
  return roundMoney2Decimals(n);
}

export function formatMoney2DecimalsDisplay(
  value: number | string | null | undefined
): string {
  const rounded = roundMoney2DecimalsOptional(value);
  if (rounded == null) {
    return 'N/A';
  }
  return rounded.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Display money as whole shillings with no decimal point. */
export function formatMoneyWholeDisplay(
  value: number | string | null | undefined
): string {
  const rounded = roundMoney2DecimalsOptional(value);
  if (rounded == null) {
    return 'N/A';
  }
  return Math.round(rounded).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export function roundUgxMoney(value: number): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    return 0;
  }

  const whole = Math.round(n);
  if (whole % 100 === 0) {
    return whole;
  }

  return Math.ceil(whole / 100) * 100;
}

export function roundUgxMoneyOptional(
  value: number | string | null | undefined
): number | null {
  if (value === '' || value === null || value === undefined) {
    return null;
  }

  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    return null;
  }

  return roundUgxMoney(n);
}

/** Display a final payment total rounded up to the next 100 shillings. */
export function formatUgxPaymentTotalDisplay(
  value: number | string | null | undefined
): string {
  const rounded = roundUgxMoneyOptional(value);
  if (rounded == null) {
    return 'N/A';
  }

  return rounded.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

/** @deprecated Use formatMoney2DecimalsDisplay for non-payment fields. */
export function formatUgxMoneyDisplay(value: number | null | undefined): string {
  return formatMoney2DecimalsDisplay(value);
}
