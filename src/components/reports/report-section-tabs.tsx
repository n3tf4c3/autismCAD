import type { ReportSectionTabItem } from "@/components/reports/report-types";

type ReportSectionTabsProps = {
  items: ReportSectionTabItem[];
};

export function ReportSectionTabs(props: ReportSectionTabsProps) {
  return (
    <nav className="sticky top-2 z-10 -mx-1 overflow-x-auto px-1 pb-1">
      <div className="inline-flex min-w-full gap-2 rounded-full border border-slate-200 bg-white/95 p-1 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/80">
        {props.items.map((item) => (
          <a
            key={item.id}
            href={`#${item.id}`}
            className="inline-flex shrink-0 items-center gap-2 rounded-full border border-transparent px-3 py-2 text-xs font-semibold text-gray-700 transition hover:border-amber-200 hover:bg-amber-50 hover:text-[var(--marrom)] sm:text-sm"
          >
            <span>{item.label}</span>
            {item.badge !== undefined ? (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-gray-600 sm:text-xs">{item.badge}</span>
            ) : null}
          </a>
        ))}
      </div>
    </nav>
  );
}
