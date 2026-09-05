import { z } from "zod";

const count = z.preprocess(
  (value) => typeof value === "string" ? (value.trim() || null) : value,
  z.union([z.number(), z.string().regex(/^\d+$/, "Informe uma contagem inteira").transform(Number)])
    .pipe(z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)).nullable().optional(),
);

// Somente contratos de escrita usam a transformacao; leitores historicos ficam intactos.
export function normalizeClinicalCounts<T extends Record<string, unknown>>(payload: T, ctx: z.RefinementCtx): T {
  const next = structuredClone(payload);
  function normalize(record: Record<string, unknown>, key: string, path: (string | number)[]) {
    if (!Object.hasOwn(record, key)) return;
    const parsed = count.safeParse(record[key]);
    if (parsed.success) record[key] = parsed.data;
    else ctx.addIssue({ code: "custom", path: [...path, key], message: "Informe um inteiro finito maior ou igual a zero" });
  }
  for (const collection of ["itensDesempenho", "itens"]) {
    const items = next[collection];
    if (!Array.isArray(items)) continue;
    items.forEach((item, index) => {
      if (!item || typeof item !== "object") return;
      const path = [collection, index];
      for (const key of ["tentativas", "tentativa", "acertos"]) normalize(item, key, path);
      const attempts = item.tentativas ?? item.tentativa;
      if (typeof attempts === "number" && typeof item.acertos === "number" && item.acertos > attempts) {
        ctx.addIssue({ code: "custom", path: [...path, "acertos"], message: "Acertos nao pode exceder tentativas" });
      }
    });
  }
  for (const key of ["comportamentos", "comportamento"]) {
    const behavior = next[key];
    if (!behavior || typeof behavior !== "object" || !("quantidades" in behavior)) continue;
    const quantities = behavior.quantidades;
    if (!quantities || typeof quantities !== "object") continue;
    for (const direction of ["negativo", "positivo"]) {
      const values = (quantities as Record<string, unknown>)[direction];
      if (!values || typeof values !== "object") continue;
      for (const name of Object.keys(values)) normalize(values as Record<string, unknown>, name, [key, "quantidades", direction]);
    }
  }
  return next;
}
