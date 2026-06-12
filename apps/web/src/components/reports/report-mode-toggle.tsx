import Link from "next/link";

type ReportMode = "daily" | "monthly";

type ReportModeToggleProps = {
  mode: ReportMode;
  dailyHref: string;
  monthlyHref: string;
};

function getLinkClass(active: boolean): string {
  if (active) {
    return "bg-[var(--laranja)] text-white shadow-sm";
  }

  return "text-gray-700 hover:bg-white hover:text-[var(--marrom)]";
}

export function ReportModeToggle(props: ReportModeToggleProps) {
  return (
    <div className="inline-flex rounded-full border border-amber-100 bg-amber-50/80 p-1">
      <Link
        href={props.dailyHref}
        className={`rounded-full px-4 py-2 text-sm font-semibold transition ${getLinkClass(props.mode === "daily")}`}
      >
        Diario
      </Link>
      <Link
        href={props.monthlyHref}
        className={`rounded-full px-4 py-2 text-sm font-semibold transition ${getLinkClass(props.mode === "monthly")}`}
      >
        Mensal
      </Link>
    </div>
  );
}
