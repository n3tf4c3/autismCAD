import { SkillPerformanceCard } from "@/components/reports/skill-performance-card";
import type { SkillPerformanceRow } from "@/components/reports/report-types";

type SkillsGridProps = {
  title: string;
  subtitle?: string;
  rows: SkillPerformanceRow[];
  emptyMessage: string;
};

export function SkillsGrid(props: SkillsGridProps) {
  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-[var(--marrom)]">{props.title}</h2>
          {props.subtitle ? <p className="max-w-3xl text-sm text-gray-700">{props.subtitle}</p> : null}
        </div>
        <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-gray-700">
          {props.rows.length} habilidade(s)
        </div>
      </div>

      {props.rows.length ? (
        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {props.rows.map((row) => (
            <SkillPerformanceCard key={row.key} row={row} />
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm text-gray-700">{props.emptyMessage}</p>
      )}
    </section>
  );
}
