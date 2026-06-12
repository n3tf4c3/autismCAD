import { SkillPerformanceCard } from "@/components/reports/skill-performance-card";
import type { SkillPerformanceRow } from "@/components/reports/report-types";
import type { ReactNode } from "react";

type SkillsGridProps = {
  sectionId?: string;
  title: string;
  subtitle?: string;
  rows: SkillPerformanceRow[];
  emptyMessage: string;
  compact?: boolean;
  action?: ReactNode;
};

export function SkillsGrid(props: SkillsGridProps) {
  const compact = props.compact ?? false;

  return (
    <section
      id={props.sectionId}
      className={`scroll-mt-24 rounded-[28px] border border-slate-200 bg-white shadow-sm ${compact ? "p-3 sm:p-5" : "p-4 sm:p-5"}`}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <h2 className={`${compact ? "text-base sm:text-lg" : "text-lg"} font-semibold text-[var(--marrom)]`}>{props.title}</h2>
          {props.subtitle ? (
            <p className={`max-w-3xl text-gray-700 ${compact ? "hidden text-sm sm:block" : "text-sm"}`}>{props.subtitle}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {props.action}
          <div className={`rounded-full border border-slate-200 bg-slate-50 font-medium text-gray-700 ${compact ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm"}`}>
            {props.rows.length} habilidade(s)
          </div>
        </div>
      </div>

      {props.rows.length ? (
        <div className={`grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 ${compact ? "mt-4 gap-3" : "mt-5 gap-4"}`}>
          {props.rows.map((row) => (
            <SkillPerformanceCard key={row.key} row={row} compact={compact} />
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm text-gray-700">{props.emptyMessage}</p>
      )}
    </section>
  );
}
