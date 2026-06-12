export type DesempenhoKey = "ajuda" | "nao_fez" | "independente";

type EvolucaoLike = {
  data: string;
  payload?: Record<string, unknown> | null;
};

type DesempenhoByDay = {
  total: number;
  ajuda: number;
  nao_fez: number;
  independente: number;
};

type DesempenhoBySkill = {
  label: string;
  total: number;
  ajuda: number;
  nao_fez: number;
  independente: number;
};

const DESEMPENHO_META: Record<
  DesempenhoKey,
  { label: string; bar: string; track: string; text: string }
> = {
  independente: {
    label: "Independente",
    bar: "bg-green-500",
    track: "bg-green-50",
    text: "text-green-700",
  },
  ajuda: {
    label: "Com ajuda",
    bar: "bg-amber-500",
    track: "bg-amber-50",
    text: "text-amber-700",
  },
  nao_fez: {
    label: "Nao fez",
    bar: "bg-rose-500",
    track: "bg-rose-50",
    text: "text-rose-700",
  },
};

function normalizeDesempenho(value: unknown): DesempenhoKey | null {
  if (typeof value !== "string") return null;
  const v = value.toLowerCase().trim().replace(/\s+/g, "_");
  if (v === "ajuda" || v === "nao_fez" || v === "independente") return v;
  return null;
}

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function pickPerformanceLabel(item: Record<string, unknown>): string {
  const habilidade = String(item.habilidade ?? "").trim();
  if (habilidade) return habilidade;

  const opcao = String(item.opcao ?? item.meta ?? "").trim();
  if (opcao) return opcao;

  const ensino = String(item.ensino ?? "").trim();
  if (ensino) return ensino;

  return "Meta sem identificacao";
}

export function buildDesempenhoResumo(evolucoes?: EvolucaoLike[] | null) {
  const counts: Record<DesempenhoKey, number> = {
    ajuda: 0,
    nao_fez: 0,
    independente: 0,
  };
  const byDay = new Map<string, DesempenhoByDay>();
  const bySkill = new Map<string, DesempenhoBySkill>();

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
      const desempenho = normalizeDesempenho(rec.desempenho ?? rec.performance);
      if (!desempenho) return;

      counts[desempenho] += 1;

      const dateKey = String(evolucao.data || "").slice(0, 10);
      if (dateKey) {
        if (!byDay.has(dateKey)) {
          byDay.set(dateKey, { total: 0, ajuda: 0, nao_fez: 0, independente: 0 });
        }
        const day = byDay.get(dateKey);
        if (day) {
          day.total += 1;
          day[desempenho] += 1;
        }
      }

      const label = pickPerformanceLabel(rec);
      const skillKey = slugify(label) || "meta_sem_identificacao";
      if (!bySkill.has(skillKey)) {
        bySkill.set(skillKey, { label, total: 0, ajuda: 0, nao_fez: 0, independente: 0 });
      }
      const skill = bySkill.get(skillKey);
      if (skill) {
        skill.total += 1;
        skill[desempenho] += 1;
      }
    });
  });

  const total = counts.ajuda + counts.nao_fez + counts.independente;
  const percent = (value: number, totalRef: number) => (totalRef ? Math.round((value / totalRef) * 100) : 0);

  const rows = (["independente", "ajuda", "nao_fez"] as const).map((key) => ({
    key,
    label: DESEMPENHO_META[key].label,
    value: counts[key],
    pct: percent(counts[key], total),
    bar: DESEMPENHO_META[key].bar,
    track: DESEMPENHO_META[key].track,
    text: DESEMPENHO_META[key].text,
  }));

  const rowsByDay = Array.from(byDay.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, day]) => ({
      date,
      total: day.total,
      ajuda: day.ajuda,
      nao_fez: day.nao_fez,
      independente: day.independente,
      pctAjuda: percent(day.ajuda, day.total),
      pctNaoFez: percent(day.nao_fez, day.total),
      pctIndependente: percent(day.independente, day.total),
    }));

  const rowsBySkill = Array.from(bySkill.entries())
    .map(([key, row]) => ({
      key,
      label: row.label,
      total: row.total,
      ajuda: row.ajuda,
      nao_fez: row.nao_fez,
      independente: row.independente,
      pctAjuda: percent(row.ajuda, row.total),
      pctNaoFez: percent(row.nao_fez, row.total),
      pctIndependente: percent(row.independente, row.total),
    }))
    .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, "pt-BR"));

  return {
    total,
    diasComRegistro: rowsByDay.length,
    rows,
    rowsByDay,
    rowsBySkill,
  };
}
