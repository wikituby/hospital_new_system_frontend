export type BatchSellingModel = {
  id: number;
  name: string;
  unitSellingPrice: number;
};

export type BatchLinePricing = {
  unitCost: number;
  sellingModels: BatchSellingModel[];
};

export function normalizeUnitSellingModels(raw: unknown): BatchSellingModel[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .map((model) => ({
      id: Number((model as { id?: unknown })?.id) || 0,
      name: String((model as { name?: unknown })?.name ?? '').trim(),
      unitSellingPrice: Number((model as { unitSellingPrice?: unknown })?.unitSellingPrice) || 0,
    }))
    .filter((model) => model.name.length > 0);
}

/** Unit cost and all sell models from the first in-stock distribution (or first row). */
export function extractBatchLinePricing(distributions: any[] | null | undefined): BatchLinePricing {
  const rows = Array.isArray(distributions) ? distributions : [];
  const row =
    rows.find((entry) => Number(entry?.stockAtHand ?? 0) > 0) ?? rows[0] ?? null;
  if (!row) {
    return { unitCost: 0, sellingModels: [] };
  }
  const unitCost =
    Number(row.costPrice ?? row.unitCostPrice ?? row.buyPrice ?? 0) || 0;
  const sellingModels = normalizeUnitSellingModels(
    row.unitSellingModels ?? row.unit_selling_models
  );
  return { unitCost, sellingModels };
}
