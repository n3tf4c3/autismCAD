type ReportFiltersProps = {
  title: string;
  description?: string;
  label: string;
  type: "date" | "month";
  value: string;
  onChange: (value: string) => void;
  buttonLabel: string;
  onSubmit: () => void;
  loading?: boolean;
  compact?: boolean;
};

export function ReportFilters(props: ReportFiltersProps) {
  const compact = props.compact ?? false;

  return (
    <section className={`rounded-[24px] border border-slate-200 bg-white shadow-sm ${compact ? "p-3 sm:p-4" : "p-4 sm:p-5"}`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <h2 className={`${compact ? "text-sm uppercase tracking-[0.18em] text-gray-600" : "text-lg text-[var(--marrom)]"} font-semibold`}>
            {props.title}
          </h2>
          {props.description ? (
            <p className={`text-gray-700 ${compact ? "hidden text-sm sm:block" : "text-sm"}`}>{props.description}</p>
          ) : null}
        </div>

        <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto lg:items-end">
          <label className="flex min-w-[180px] flex-1 flex-col gap-1.5">
            <span className="text-sm font-semibold text-[var(--marrom)]">{props.label}</span>
            <input
              type={props.type}
              value={props.value}
              onChange={(event) => props.onChange(event.target.value)}
              className={`rounded-xl border border-gray-200 bg-white text-sm text-gray-700 outline-none transition focus:border-[var(--laranja)] focus:ring-2 focus:ring-amber-100 ${compact ? "px-3 py-2" : "px-3 py-2.5"}`}
            />
          </label>
          <button
            type="button"
            onClick={props.onSubmit}
            disabled={props.loading}
            className={`rounded-xl bg-[var(--laranja)] px-4 text-sm font-semibold text-white transition hover:bg-[#e6961f] disabled:cursor-not-allowed disabled:opacity-60 ${compact ? "min-h-10 py-2" : "min-h-11 py-2"}`}
          >
            {props.buttonLabel}
          </button>
        </div>
      </div>
    </section>
  );
}
