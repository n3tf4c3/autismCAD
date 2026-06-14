// Agregacoes puras da devolutiva, espelhando a logica da web
// (apps/web/.../devolutiva-dia.client.tsx e lib/relatorios/desempenho.ts) sem classes de
// estilo. Os rotulos de comportamento reusam BEHAVIOR_OPTIONS de ./evolucao.

import { BEHAVIOR_OPTIONS } from "./evolucao";

type EvolucaoLike = {
  data?: string;
  payload?: Record<string, unknown> | null;
};

type DesempenhoKey = "independente" | "ajuda" | "nao_fez";

const DESEMPENHO_LABEL: Record<DesempenhoKey, string> = {
  independente: "Independente",
  ajuda: "Com ajuda",
  nao_fez: "Nao fez",
};

const BEHAVIOR_LABELS: Record<string, string> = Object.fromEntries(
  [...BEHAVIOR_OPTIONS.negativo, ...BEHAVIOR_OPTIONS.positivo].map((o) => [o.value, o.label])
);

function pct(value: number, totalRef: number): number {
  return totalRef ? Math.round((value / totalRef) * 100) : 0;
}

function normKey(value: string): string {
  return value.toLowerCase().trim().replace(/\s+/g, "_");
}

function normDesempenho(value: unknown): DesempenhoKey | null {
  if (typeof value !== "string") return null;
  const v = normKey(value);
  return v === "ajuda" || v === "nao_fez" || v === "independente" ? v : null;
}

function normResultado(value: unknown): "negativo" | "positivo" | "parcial" | null {
  if (typeof value !== "string") return null;
  const v = normKey(value);
  return v === "negativo" || v === "positivo" || v === "parcial" ? v : null;
}

function asPositiveInt(value: unknown, fallback = 1): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.trunc(n);
}

function pickStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item ?? "").trim()).filter(Boolean);
}

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function behaviorLabel(value: string): string {
  const key = normKey(value);
  if (BEHAVIOR_LABELS[key]) return BEHAVIOR_LABELS[key];
  const clean = value.trim().replace(/_/g, " ");
  if (!clean) return "-";
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

export type SkillRow = {
  key: string;
  label: string;
  total: number;
  independente: number;
  ajuda: number;
  nao_fez: number;
  pctIndependente: number;
  pctAjuda: number;
  pctNaoFez: number;
};

export type DesempenhoResumo = {
  total: number;
  rows: { key: DesempenhoKey; label: string; value: number; pct: number }[];
  rowsBySkill: SkillRow[];
};

export function buildDesempenhoResumo(evolucoes?: EvolucaoLike[] | null): DesempenhoResumo {
  const counts: Record<DesempenhoKey, number> = { independente: 0, ajuda: 0, nao_fez: 0 };
  const bySkill = new Map<string, { label: string } & Record<DesempenhoKey, number> & { total: number }>();

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
      const desempenho = normDesempenho(rec.desempenho ?? rec.performance);
      if (!desempenho) return;
      counts[desempenho] += 1;

      const label =
        String(rec.habilidade ?? "").trim() ||
        String(rec.opcao ?? rec.meta ?? "").trim() ||
        String(rec.ensino ?? "").trim() ||
        "Meta sem identificacao";
      const skillKey = slugify(label) || "meta_sem_identificacao";
      let skill = bySkill.get(skillKey);
      if (!skill) {
        skill = { label, total: 0, independente: 0, ajuda: 0, nao_fez: 0 };
        bySkill.set(skillKey, skill);
      }
      skill.total += 1;
      skill[desempenho] += 1;
    });
  });

  const total = counts.independente + counts.ajuda + counts.nao_fez;

  const rows = (["independente", "ajuda", "nao_fez"] as const).map((key) => ({
    key,
    label: DESEMPENHO_LABEL[key],
    value: counts[key],
    pct: pct(counts[key], total),
  }));

  const rowsBySkill = Array.from(bySkill.entries())
    .map(([key, row]) => ({
      key,
      label: row.label,
      total: row.total,
      independente: row.independente,
      ajuda: row.ajuda,
      nao_fez: row.nao_fez,
      pctIndependente: pct(row.independente, row.total),
      pctAjuda: pct(row.ajuda, row.total),
      pctNaoFez: pct(row.nao_fez, row.total),
    }))
    .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, "pt-BR"));

  return { total, rows, rowsBySkill };
}

export type ComportamentoRow = { key: string; label: string; value: number; pct: number };

export type ComportamentoResumo = {
  total: number;
  totalNegativo: number;
  totalPositivo: number;
  pctNegativo: number;
  pctPositivo: number;
  resultado: { negativo: number; positivo: number; parcial: number };
  rowsNegativo: ComportamentoRow[];
  rowsPositivo: ComportamentoRow[];
};

export function buildComportamentoResumo(evolucoes?: EvolucaoLike[] | null): ComportamentoResumo {
  const resultado = { negativo: 0, positivo: 0, parcial: 0 };
  const mapNeg = new Map<string, { label: string; value: number }>();
  const mapPos = new Map<string, { label: string; value: number }>();

  const addItem = (map: Map<string, { label: string; value: number }>, rawValue: string, qty: number) => {
    const key = normKey(rawValue);
    if (!key) return;
    const current = map.get(key);
    if (current) {
      current.value += qty;
      return;
    }
    map.set(key, { label: behaviorLabel(rawValue), value: qty });
  };

  (evolucoes || []).forEach((e) => {
    const payload = e?.payload;
    if (!payload || typeof payload !== "object") return;
    const compRaw = payload.comportamentos ?? payload.comportamento;
    if (!compRaw || typeof compRaw !== "object") return;
    const comp = compRaw as Record<string, unknown>;

    const r = normResultado(comp.resultado);
    if (r) resultado[r] += 1;

    const quantidades =
      comp.quantidades && typeof comp.quantidades === "object"
        ? (comp.quantidades as Record<string, unknown>)
        : null;
    const qtyNeg =
      quantidades?.negativo && typeof quantidades.negativo === "object"
        ? (quantidades.negativo as Record<string, unknown>)
        : null;
    const qtyPos =
      quantidades?.positivo && typeof quantidades.positivo === "object"
        ? (quantidades.positivo as Record<string, unknown>)
        : null;

    pickStringList(comp.negativos).forEach((item) => {
      const qty = asPositiveInt((qtyNeg?.[item] ?? qtyNeg?.[normKey(item)]) as unknown, 1);
      addItem(mapNeg, item, qty);
    });
    pickStringList(comp.positivos).forEach((item) => {
      const qty = asPositiveInt((qtyPos?.[item] ?? qtyPos?.[normKey(item)]) as unknown, 1);
      addItem(mapPos, item, qty);
    });
  });

  const totalNegativo = Array.from(mapNeg.values()).reduce((acc, item) => acc + item.value, 0);
  const totalPositivo = Array.from(mapPos.values()).reduce((acc, item) => acc + item.value, 0);
  const total = totalNegativo + totalPositivo;

  const toRows = (map: Map<string, { label: string; value: number }>, totalRef: number): ComportamentoRow[] =>
    Array.from(map.entries())
      .map(([key, item]) => ({ key, label: item.label, value: item.value, pct: pct(item.value, totalRef) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

  return {
    total,
    totalNegativo,
    totalPositivo,
    pctNegativo: pct(totalNegativo, total),
    pctPositivo: pct(totalPositivo, total),
    resultado,
    rowsNegativo: toRows(mapNeg, totalNegativo),
    rowsPositivo: toRows(mapPos, totalPositivo),
  };
}
