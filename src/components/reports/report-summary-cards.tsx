import type { ReportSummaryCardItem, ReportSummaryTone } from "@/components/reports/report-types";

type ReportSummaryCardsProps = {
  items: ReportSummaryCardItem[];
  compact?: boolean;
  columns?: 2 | 3 | 4;
};

const TONE_STYLES: Record<ReportSummaryTone, string> = {
  neutral: "border-slate-200 bg-slate-50 text-slate-700",
  brand: "border-amber-200 bg-amber-50 text-[var(--marrom)]",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  danger: "border-rose-200 bg-rose-50 text-rose-700",
};

function gridClass(columns: 2 | 3 | 4 | undefined): string {
  if (columns === 3) return "grid-cols-3";
  if (columns === 2) return "grid-cols-2";
  return "grid-cols-2 xl:grid-cols-4";
}

export function ReportSummaryCards(props: ReportSummaryCardsProps) {
  const compact = props.compact ?? false;

  return (
    <div className={`grid gap-3 ${gridClass(props.columns)} ${!props.columns ? "sm:grid-cols-2" : ""}`}>
      {props.items.map((item) => {
        const tone = item.tone ?? "neutral";
        return (
          <article
            key={`${item.label}-${item.value}`}
            className={`rounded-2xl border shadow-sm transition ${compact ? "p-3 sm:p-4" : "p-4"} ${TONE_STYLES[tone]}`}
          >
            <p className={`${compact ? "text-[10px]" : "text-[11px]"} font-semibold uppercase tracking-[0.18em] opacity-80`}>
              {item.label}
            </p>
            <p className={`${compact ? "mt-2 text-lg sm:text-2xl" : "mt-3 text-2xl"} font-semibold`}>{item.value}</p>
            {item.description ? (
              <p className={`${compact ? "mt-1 hidden text-xs leading-4 sm:block" : "mt-2 text-sm leading-5"} text-gray-700`}>
                {item.description}
              </p>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
