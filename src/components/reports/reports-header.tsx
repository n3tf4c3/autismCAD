import type { ReactNode } from "react";

type ReportsHeaderProps = {
  title: string;
  subtitle?: string;
  modeToggle?: ReactNode;
  actions?: ReactNode;
  patientSlot?: ReactNode;
  secondarySlot?: ReactNode;
};

export function ReportsHeader(props: ReportsHeaderProps) {
  return (
    <section className="overflow-hidden rounded-[28px] border border-amber-100 bg-white shadow-sm">
      <div className="bg-[radial-gradient(circle_at_top_left,_rgba(247,169,40,0.18),_transparent_45%),linear-gradient(135deg,_rgba(255,250,235,0.95),_rgba(255,255,255,1)_55%)] p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-3xl space-y-2">
            <span className="inline-flex rounded-full border border-amber-200 bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--laranja)]">
              Relatórios
            </span>
            <div className="space-y-1">
              <h1 className="text-xl font-semibold text-[var(--marrom)] sm:text-3xl">{props.title}</h1>
              {props.subtitle ? <p className="hidden max-w-2xl text-sm leading-6 text-gray-700 sm:block">{props.subtitle}</p> : null}
            </div>
          </div>

          {(props.modeToggle || props.actions) ? (
            <div className="flex w-full flex-wrap items-center justify-between gap-3 sm:w-auto sm:justify-end">
              {props.modeToggle}
              {props.actions}
            </div>
          ) : null}
        </div>

        {(props.patientSlot || props.secondarySlot) ? (
          <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
            {props.patientSlot ? (
              <div className="rounded-2xl border border-white/80 bg-white/80 p-3 shadow-sm backdrop-blur sm:p-4">
                {props.patientSlot}
              </div>
            ) : null}
            {props.secondarySlot ? (
              <div className="rounded-2xl border border-white/80 bg-white/80 p-3 shadow-sm backdrop-blur sm:p-4">
                {props.secondarySlot}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

