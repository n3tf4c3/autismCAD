type EngagementSlice = {
  key: string;
  label: string;
  value: number;
  pct: number;
  color: string;
};

type EngagementPieProps = {
  rows: EngagementSlice[];
  total: number;
  size?: number;
};

function polarToCartesian(cx: number, cy: number, radius: number, angle: number) {
  const rad = ((angle - 90) * Math.PI) / 180;
  return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
}

function slicePath(cx: number, cy: number, radius: number, start: number, end: number): string {
  const from = polarToCartesian(cx, cy, radius, start);
  const to = polarToCartesian(cx, cy, radius, end);
  const largeArc = end - start > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${from.x} ${from.y} A ${radius} ${radius} 0 ${largeArc} 1 ${to.x} ${to.y} Z`;
}

export function EngagementPie(props: EngagementPieProps) {
  const size = props.size ?? 220;
  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 4;
  const fatias = props.rows.filter((row) => row.value > 0);

  const paths = fatias.reduce<Array<{ row: EngagementSlice; start: number; end: number }>>((acc, row) => {
    const start = acc.length ? acc[acc.length - 1].end : 0;
    return [...acc, { row, start, end: start + (row.value / props.total) * 360 }];
  }, []);

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-6">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={`Distribuicao de engajamento em ${props.total} registro(s)`}
      >
        {paths.length === 1 ? (
          <circle cx={cx} cy={cy} r={radius} fill={paths[0].row.color} />
        ) : (
          paths.map((slice) => (
            <path
              key={slice.row.key}
              d={slicePath(cx, cy, radius, slice.start, slice.end)}
              fill={slice.row.color}
              stroke="#ffffff"
              strokeWidth={1}
            />
          ))
        )}
      </svg>

      <ul className="w-full space-y-2 sm:w-auto">
        {props.rows.map((row) => (
          <li key={row.key} className="flex items-center gap-2 text-sm text-gray-700">
            <span className="h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: row.color }} aria-hidden />
            <span className="font-semibold text-[var(--marrom)]">{row.label}</span>
            <span className="text-gray-600">
              {row.value} ({row.pct}%)
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
