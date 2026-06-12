import type { SkillPerformanceRow } from "@/components/reports/report-types";

type SkillSegmentKey = "independente" | "ajuda" | "nao_fez";

type SkillSegment = {
  key: SkillSegmentKey;
  label: string;
  value: number;
  pct: number;
  color: string;
  surface: string;
};

type SkillStackedBarProps = {
  row: SkillPerformanceRow;
  compact?: boolean;
};

export const SKILL_STATUS_SEGMENTS: SkillSegment[] = [
  {
    key: "independente",
    label: "Independente",
    value: 0,
    pct: 0,
    color: "bg-emerald-500",
    surface: "bg-emerald-50 text-emerald-700",
  },
  {
    key: "ajuda",
    label: "Com ajuda",
    value: 0,
    pct: 0,
    color: "bg-amber-500",
    surface: "bg-amber-50 text-amber-700",
  },
  {
    key: "nao_fez",
    label: "Nao fez",
    value: 0,
    pct: 0,
    color: "bg-rose-500",
    surface: "bg-rose-50 text-rose-700",
  },
];

function buildSegments(row: SkillPerformanceRow): SkillSegment[] {
  return [
    {
      ...SKILL_STATUS_SEGMENTS[0],
      value: row.independente,
      pct: row.pctIndependente,
    },
    {
      ...SKILL_STATUS_SEGMENTS[1],
      value: row.ajuda,
      pct: row.pctAjuda,
    },
    {
      ...SKILL_STATUS_SEGMENTS[2],
      value: row.nao_fez,
      pct: row.pctNaoFez,
    },
  ];
}

export function SkillStackedBar(props: SkillStackedBarProps) {
  const segments = buildSegments(props.row);
  const visibleSegments = segments.filter((segment) => segment.value > 0);
  const compact = props.compact ?? false;

  return (
    <div className={compact ? "space-y-2.5" : "space-y-3"}>
      <div className={`flex overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200/80 ${compact ? "h-2.5" : "h-3"}`}>
        {visibleSegments.length ? (
          visibleSegments.map((segment) => (
            <div
              key={segment.key}
              className={`${segment.color} transition-all`}
              style={{ flexGrow: segment.value, flexBasis: 0 }}
              title={`${segment.label}: ${segment.value} (${segment.pct}%)`}
            />
          ))
        ) : (
          <div className="h-full w-full bg-slate-200" />
        )}
      </div>
      <div className={`grid grid-cols-3 ${compact ? "gap-1.5" : "gap-2"}`}>
        {segments.map((segment) => (
          <div key={segment.key} className={`rounded-xl ${compact ? "px-2 py-1.5 text-[10px] sm:text-xs" : "px-3 py-2 text-xs"} ${segment.surface}`}>
            <p className="font-semibold leading-tight">{segment.label}</p>
            <p className="mt-1 font-medium leading-tight">
              {segment.value} <span className="opacity-70">({segment.pct}%)</span>
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
