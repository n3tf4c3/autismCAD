import { EngagementPie } from "@/components/reports/engagement-pie";

type EngagementRow = {
  key: string;
  label: string;
  value: number;
  pct: number;
  color: string;
};

type EngagementSectionProps = {
  sectionId?: string;
  subtitle: string;
  emptyMessage: string;
  total: number;
  rows: EngagementRow[];
  ignorados: number;
};

export function EngagementSection(props: EngagementSectionProps) {
  return (
    <section
      id={props.sectionId}
      className="scroll-mt-24 rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-[var(--marrom)] sm:text-lg">Nível de Engajamento</h2>
          <p className="max-w-3xl text-sm text-gray-700">{props.subtitle}</p>
        </div>
        <div className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-gray-700">
          {props.total} registro(s)
        </div>
      </div>

      {props.total ? (
        <div className="mt-4">
          <EngagementPie rows={props.rows} total={props.total} />
        </div>
      ) : (
        <p className="mt-4 text-sm text-gray-700">{props.emptyMessage}</p>
      )}

      {props.ignorados ? (
        <p className="mt-3 text-xs text-gray-600">
          {props.ignorados} registro(s) fora do padrão Sim/Não foram desconsiderados — são metas antigas, de
          quando este campo se chamava &quot;Alvo&quot;.
        </p>
      ) : null}
    </section>
  );
}
