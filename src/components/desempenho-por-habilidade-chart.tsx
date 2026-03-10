"use client";

import type { DesempenhoKey } from "@/lib/relatorios/desempenho";

type SkillRow = {
  key: string;
  label: string;
  total: number;
  ajuda: number;
  nao_fez: number;
  independente: number;
  pctAjuda: number;
  pctNaoFez: number;
  pctIndependente: number;
};

const SERIES: Array<{
  key: DesempenhoKey;
  label: string;
  bar: string;
  valueKey: keyof Pick<SkillRow, "ajuda" | "nao_fez" | "independente">;
  pctKey: keyof Pick<SkillRow, "pctAjuda" | "pctNaoFez" | "pctIndependente">;
}> = [
  {
    key: "independente",
    label: "Independente",
    bar: "bg-green-500",
    valueKey: "independente",
    pctKey: "pctIndependente",
  },
  {
    key: "ajuda",
    label: "Com ajuda",
    bar: "bg-amber-500",
    valueKey: "ajuda",
    pctKey: "pctAjuda",
  },
  {
    key: "nao_fez",
    label: "Nao fez",
    bar: "bg-rose-500",
    valueKey: "nao_fez",
    pctKey: "pctNaoFez",
  },
];

const trackStyle = {
  backgroundImage:
    "linear-gradient(to right, rgba(148, 163, 184, 0.22) 1px, transparent 1px)",
  backgroundSize: "25% 100%",
};

export function DesempenhoPorHabilidadeChart(props: {
  rows: SkillRow[];
  title?: string;
  subtitle?: string;
  emptyMessage: string;
}) {
  if (!props.rows.length) {
    return <p className="mt-3 text-sm text-gray-600">{props.emptyMessage}</p>;
  }

  return (
    <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[var(--marrom)]">{props.title ?? "Desempenho por habilidade"}</h3>
          {props.subtitle ? <p className="mt-1 text-xs text-gray-600">{props.subtitle}</p> : null}
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-gray-600">
          {SERIES.map((series) => (
            <span key={series.key} className="inline-flex items-center gap-1.5">
              <span className={`h-2.5 w-2.5 rounded-full ${series.bar}`} />
              {series.label}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {props.rows.map((row) => (
          <div key={row.key} className="rounded-xl border border-white bg-white/90 p-3 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-[var(--marrom)]">{row.label}</p>
              <p className="text-xs font-medium text-gray-500">{row.total} registro(s)</p>
            </div>

            <div className="space-y-2">
              {SERIES.map((series) => {
                const value = row[series.valueKey];
                const pct = row[series.pctKey];
                return (
                  <div key={series.key} className="grid grid-cols-[88px_minmax(0,1fr)_70px] items-center gap-2">
                    <span className="text-xs text-gray-600">{series.label}</span>
                    <div className="h-2.5 overflow-hidden rounded-full bg-slate-100" style={trackStyle}>
                      <div className={`h-full rounded-full ${series.bar}`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-right text-xs font-semibold text-gray-700">
                      {value} ({pct}%)
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
