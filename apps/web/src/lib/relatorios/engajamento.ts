export type EngajamentoKey = "sim" | "nao" | "outros";

type EvolucaoLike = {
  data: string;
  payload?: Record<string, unknown> | null;
};

const ENGAJAMENTO_META: Record<EngajamentoKey, { label: string; color: string; text: string }> = {
  sim: { label: "Sim", color: "#3b82f6", text: "text-blue-700" },
  nao: { label: "Nao", color: "#f97316", text: "text-orange-700" },
  outros: { label: "Outros", color: "#94a3b8", text: "text-slate-700" },
};

function normalizeEngajamentoValue(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function classifyEngajamento(normalized: string): EngajamentoKey {
  if (normalized === "sim" || normalized === "s") return "sim";
  if (normalized === "nao" || normalized === "n") return "nao";
  return "outros";
}

export function buildEngajamentoResumo(evolucoes?: EvolucaoLike[] | null) {
  const counts: Record<EngajamentoKey, number> = { sim: 0, nao: 0, outros: 0 };
  const outrosMap = new Map<string, { label: string; value: number }>();

  (evolucoes || []).forEach((evolucao) => {
    const payload = evolucao?.payload;
    if (!payload || typeof payload !== "object") return;

    const itensRaw = Array.isArray(payload.itensDesempenho)
      ? payload.itensDesempenho
      : Array.isArray(payload.itens)
        ? payload.itens
        : [];

    itensRaw.forEach((item) => {
      if (!item || typeof item !== "object") return;
      const rec = item as Record<string, unknown>;
      const normalized = normalizeEngajamentoValue(rec.opcao);
      if (!normalized) return;

      const key = classifyEngajamento(normalized);
      counts[key] += 1;

      if (key !== "outros") return;
      const atual = outrosMap.get(normalized);
      if (atual) {
        atual.value += 1;
        return;
      }
      outrosMap.set(normalized, { label: String(rec.opcao ?? "").trim(), value: 1 });
    });
  });

  const total = counts.sim + counts.nao + counts.outros;
  const percent = (value: number) => (total ? Math.round((value / total) * 100) : 0);

  const rows = (["sim", "nao", "outros"] as const)
    .filter((key) => key !== "outros" || counts.outros > 0)
    .map((key) => ({
      key,
      label: ENGAJAMENTO_META[key].label,
      value: counts[key],
      pct: percent(counts[key]),
      color: ENGAJAMENTO_META[key].color,
      text: ENGAJAMENTO_META[key].text,
    }));

  const rowsOutros = Array.from(outrosMap.values()).sort(
    (a, b) => b.value - a.value || a.label.localeCompare(b.label, "pt-BR"),
  );

  return { total, rows, rowsOutros };
}
