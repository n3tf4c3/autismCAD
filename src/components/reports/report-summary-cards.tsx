import type { ReportSummaryCardItem, ReportSummaryTone } from "@/components/reports/report-types";

type ReportSummaryCardsProps = {
  items: ReportSummaryCardItem[];
};

const TONE_STYLES: Record<ReportSummaryTone, string> = {
  neutral: "border-slate-200 bg-slate-50 text-slate-700",
  brand: "border-amber-200 bg-amber-50 text-[var(--marrom)]",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  danger: "border-rose-200 bg-rose-50 text-rose-700",
};

export function ReportSummaryCards(props: ReportSummaryCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {props.items.map((item) => {
        const tone = item.tone ?? "neutral";
        return (
          <article
            key={`${item.label}-${item.value}`}
            className={`rounded-2xl border p-4 shadow-sm transition ${TONE_STYLES[tone]}`}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] opacity-80">{item.label}</p>
            <p className="mt-3 text-2xl font-semibold">{item.value}</p>
            {item.description ? <p className="mt-2 text-sm leading-5 text-gray-700">{item.description}</p> : null}
          </article>
        );
      })}
    </div>
  );
}
