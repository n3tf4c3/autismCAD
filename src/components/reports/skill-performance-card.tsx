import { SkillStackedBar, SKILL_STATUS_SEGMENTS } from "@/components/reports/skill-stacked-bar";
import type { SkillPerformanceRow } from "@/components/reports/report-types";

type SkillPerformanceCardProps = {
  row: SkillPerformanceRow;
};

function dominantStatus(row: SkillPerformanceRow): { label: string; pct: number; surface: string } | null {
  const entries = [
    {
      label: SKILL_STATUS_SEGMENTS[0].label,
      value: row.independente,
      pct: row.pctIndependente,
      surface: SKILL_STATUS_SEGMENTS[0].surface,
    },
    {
      label: SKILL_STATUS_SEGMENTS[1].label,
      value: row.ajuda,
      pct: row.pctAjuda,
      surface: SKILL_STATUS_SEGMENTS[1].surface,
    },
    {
      label: SKILL_STATUS_SEGMENTS[2].label,
      value: row.nao_fez,
      pct: row.pctNaoFez,
      surface: SKILL_STATUS_SEGMENTS[2].surface,
    },
  ].sort((a, b) => b.value - a.value);

  return entries[0]?.value ? entries[0] : null;
}

export function SkillPerformanceCard(props: SkillPerformanceCardProps) {
  const dominant = dominantStatus(props.row);

  return (
    <article className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm transition hover:border-amber-200 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-[var(--marrom)]">{props.row.label}</h3>
          <p className="mt-1 text-sm text-gray-700">{props.row.total} registro(s) avaliados no periodo</p>
        </div>
        {dominant ? (
          <span className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold ${dominant.surface}`}>
            Maior: {dominant.label} {dominant.pct}%
          </span>
        ) : null}
      </div>

      <div className="mt-4">
        <SkillStackedBar row={props.row} />
      </div>
    </article>
  );
}
