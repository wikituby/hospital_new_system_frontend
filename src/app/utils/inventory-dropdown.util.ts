/** Extract id from common hospital inventory API create/update responses. */
export function extractCreatedEntityId(response: any): number | string | null {
  if (!response) {
    return null;
  }

  const nested = response.data?.data ?? response.data ?? response;
  const direct =
    nested?.id ??
    nested?.brandId ??
    nested?.categoryId ??
    nested?.manufacturerId ??
    nested?.supplierId ??
    nested?.formulationId ??
    nested?.storeId ??
    response.id ??
    response.brandId ??
    response.categoryId;

  if (direct != null && direct !== '') {
    return direct;
  }

  if (Array.isArray(response.data) && response.data.length > 0) {
    const first = response.data[0];
    if (first?.id != null) {
      return first.id;
    }
  }

  return null;
}

export function getEntityId(item: any): number | string | null {
  if (!item) {
    return null;
  }

  return (
    item.id ??
    item.brandId ??
    item.categoryId ??
    item.manufacturerId ??
    item.supplierId ??
    item.formulationId ??
    item.storeId ??
    null
  );
}

export function getEntityLabel(item: any): string {
  return (
    item?.name ??
    item?.title ??
    item?.supplierName ??
    item?.stockItemName ??
    item?.genericName ??
    ''
  )
    .toString()
    .trim();
}

/** Find a list row for a freshly created entity (by response id, edit id, or name). */
export function findCreatedInList(
  list: any[],
  options: {
    response?: any;
    editingId?: number | string | null;
    requestedName?: string;
  }
): any | null {
  const rows = Array.isArray(list) ? list : [];
  const responseId = extractCreatedEntityId(options.response);

  if (responseId != null) {
    const byId = rows.find((item) => Number(getEntityId(item)) === Number(responseId));
    if (byId) {
      return byId;
    }
  }

  if (options.editingId != null && options.editingId !== '') {
    const byEdit = rows.find((item) => Number(getEntityId(item)) === Number(options.editingId));
    if (byEdit) {
      return byEdit;
    }
  }

  const normalizedName = (options.requestedName ?? '').trim().toLowerCase();
  if (normalizedName) {
    const byName = rows.find((item) => getEntityLabel(item).toLowerCase() === normalizedName);
    if (byName) {
      return byName;
    }
  }

  const nested = options.response?.data?.data ?? options.response?.data ?? options.response;
  if (nested && getEntityId(nested)) {
    return nested;
  }

  return null;
}
