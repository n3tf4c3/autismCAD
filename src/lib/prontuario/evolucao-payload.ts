function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function pickString(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function sanitizeItem(item: unknown): { item: Record<string, unknown>; changed: boolean } | null {
  if (!isRecord(item)) return null;

  const next: Record<string, unknown> = {};
  let changed = false;

  Object.entries(item).forEach(([key, value]) => {
    if (key === "recurso" || key === "tempo") {
      changed = true;
      return;
    }
    next[key] = value;
  });

  return { item: next, changed };
}

function sanitizeItemsArray(value: unknown): { items: Record<string, unknown>[]; changed: boolean } | null {
  if (!Array.isArray(value)) return null;

  let changed = false;
  const items = value.flatMap((entry) => {
    const sanitized = sanitizeItem(entry);
    if (!sanitized) {
      changed = true;
      return [];
    }
    if (sanitized.changed) changed = true;
    return [sanitized.item];
  });

  return { items, changed };
}

function deriveMetasFromItems(items: Record<string, unknown>[]): string[] {
  return items
    .map((item) => pickString(item.opcao ?? item.meta ?? item.habilidade).trim())
    .filter(Boolean);
}

export function sanitizeEvolucaoPayload(payload: unknown): {
  payload: Record<string, unknown>;
  changed: boolean;
} {
  const source = isRecord(payload) ? payload : {};
  const next: Record<string, unknown> = { ...source };
  let changed = !isRecord(payload);

  const itensDesempenho = sanitizeItemsArray(source.itensDesempenho);
  const itens = sanitizeItemsArray(source.itens);

  if (itensDesempenho) {
    next.itensDesempenho = itensDesempenho.items;
    changed = changed || itensDesempenho.changed;
  }

  if (itens) {
    next.itens = itens.items;
    changed = changed || itens.changed;
  }

  const baseItems = itensDesempenho?.items ?? itens?.items ?? null;
  if (baseItems) {
    const metas = deriveMetasFromItems(baseItems);
    const prevMetas = Array.isArray(source.metas)
      ? source.metas.map((value) => pickString(value).trim()).filter(Boolean)
      : [];
    if (JSON.stringify(prevMetas) !== JSON.stringify(metas)) changed = true;
    next.metas = metas;
  }

  return { payload: next, changed };
}
