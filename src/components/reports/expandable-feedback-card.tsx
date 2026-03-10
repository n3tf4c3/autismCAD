"use client";

import { useMemo, useState } from "react";
import type { RecentFeedbackItem } from "@/components/reports/report-types";

type ExpandableFeedbackCardProps = {
  item: RecentFeedbackItem;
  previewLength?: number;
};

export function ExpandableFeedbackCard(props: ExpandableFeedbackCardProps) {
  const [expanded, setExpanded] = useState(false);

  const preview = useMemo(() => {
    const clean = props.item.text.replace(/\s+/g, " ").trim();
    if (clean.length <= (props.previewLength ?? 180)) return clean;
    return `${clean.slice(0, props.previewLength ?? 180).trimEnd()}...`;
  }, [props.item.text, props.previewLength]);

  const isExpandable = preview !== props.item.text.replace(/\s+/g, " ").trim();

  return (
    <article className="rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-600">
        <span>{props.item.dateLabel}</span>
        <span className="hidden h-1 w-1 rounded-full bg-gray-300 sm:inline-block" />
        <span>{props.item.professional}</span>
        <span className="hidden h-1 w-1 rounded-full bg-gray-300 sm:inline-block" />
        <span>{props.item.origin}</span>
      </div>

      <p className="mt-2 text-sm leading-6 text-gray-800">{expanded ? props.item.text : preview}</p>

      {isExpandable ? (
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className="mt-3 text-sm font-semibold text-[var(--laranja)]"
        >
          {expanded ? "Ver menos" : "Ver mais"}
        </button>
      ) : null}
    </article>
  );
}
