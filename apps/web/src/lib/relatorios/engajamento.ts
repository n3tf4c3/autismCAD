import {
  type EngajamentoValue,
  normalizeEngajamento,
} from "@autismcad/validators/prontuario/engajamento";

type EvolucaoLike = {
  data: string;
  payload?: Record<string, unknown> | null;
};

const ENGAJAMENTO_META: Record<EngajamentoValue, { label: string; color: string }> = {
  sim: { label: "Sim", color: "#3b82f6" },
  nao: { label: "Nao", color: "#f97316" },
};

export function buildEngajamentoResumo(evolucoes?: EvolucaoLike[] | null) {
  const counts: Record<EngajamentoValue, number> = { sim: 0, nao: 0 };
  // Registros anteriores ao rename do campo guardam o antigo "Alvo" (texto livre)
  // no mesmo `opcao`. Nao sao engajamento, entao ficam fora da contagem.
  let ignorados = 0;

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
      if (!String(rec.opcao ?? "").trim()) return;

      const valor = normalizeEngajamento(rec.opcao);
      if (!valor) {
        ignorados += 1;
        return;
      }
      counts[valor] += 1;
    });
  });

  const total = counts.sim + counts.nao;
  const percent = (value: number) => (total ? Math.round((value / total) * 100) : 0);

  const rows = (["sim", "nao"] as const).map((key) => ({
    key,
    label: ENGAJAMENTO_META[key].label,
    value: counts[key],
    pct: percent(counts[key]),
    color: ENGAJAMENTO_META[key].color,
  }));

  return { total, rows, ignorados };
}
