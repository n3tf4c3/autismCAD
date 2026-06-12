import type { DailyDistributionRow } from "@/components/reports/report-types";

type DailyTimelineProps = {
  rows: DailyDistributionRow[];
  emptyMessage: string;
  formatDate: (value: string) => string;
};

export function DailyTimeline(props: DailyTimelineProps) {
  if (!props.rows.length) {
    return <p className="mt-3 text-sm text-gray-700">{props.emptyMessage}</p>;
  }

  return (
    <>
      <div className="space-y-3 lg:hidden">
        {props.rows.map((row) => (
          <article key={row.date} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[var(--marrom)]">{props.formatDate(row.date)}</p>
                <p className="mt-1 text-xs text-gray-600">{row.total} registro(s) no dia</p>
              </div>
              <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-700">
                Total {row.total}
              </span>
            </div>

            <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-gray-100">
              <div className="h-full bg-green-500" style={{ width: `${row.pctIndependente}%` }} />
              <div className="h-full bg-amber-500" style={{ width: `${row.pctAjuda}%` }} />
              <div className="h-full bg-rose-500" style={{ width: `${row.pctNaoFez}%` }} />
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2">
              <div className="rounded-xl bg-emerald-50 px-2.5 py-2 text-[11px] text-emerald-700">
                <p className="font-semibold">Indep.</p>
                <p className="mt-1">
                  {row.independente} ({row.pctIndependente}%)
                </p>
              </div>
              <div className="rounded-xl bg-amber-50 px-2.5 py-2 text-[11px] text-amber-700">
                <p className="font-semibold">Ajuda</p>
                <p className="mt-1">
                  {row.ajuda} ({row.pctAjuda}%)
                </p>
              </div>
              <div className="rounded-xl bg-rose-50 px-2.5 py-2 text-[11px] text-rose-700">
                <p className="font-semibold">Nao fez</p>
                <p className="mt-1">
                  {row.nao_fez} ({row.pctNaoFez}%)
                </p>
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 lg:block">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left">Dia</th>
              <th className="px-3 py-2 text-left">Total</th>
              <th className="px-3 py-2 text-left">Distribuicao</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {props.rows.map((row) => (
              <tr key={row.date}>
                <td className="px-3 py-2">{props.formatDate(row.date)}</td>
                <td className="px-3 py-2">{row.total}</td>
                <td className="px-3 py-2">
                  <div className="mb-1 flex h-2 overflow-hidden rounded-full bg-gray-100">
                    <div className="h-full bg-green-500" style={{ width: `${row.pctIndependente}%` }} />
                    <div className="h-full bg-amber-500" style={{ width: `${row.pctAjuda}%` }} />
                    <div className="h-full bg-rose-500" style={{ width: `${row.pctNaoFez}%` }} />
                  </div>
                  <p className="text-xs text-gray-700">
                    Indep: {row.independente} ({row.pctIndependente}%) | Ajuda: {row.ajuda} ({row.pctAjuda}%) | Nao fez:{" "}
                    {row.nao_fez} ({row.pctNaoFez}%)
                  </p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
