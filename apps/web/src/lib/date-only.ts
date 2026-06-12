function isIsoDateOnlyString(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function isIsoDateOnly(value?: string | null): boolean {
  if (!value) return false;
  return isIsoDateOnlyString(String(value).trim());
}

export function formatDateBr(value?: string | null): string {
  if (!value) return "-";
  const s = String(value).trim();

  // Avoid timezone shifts for date-only values like "2026-02-14"
  if (isIsoDateOnlyString(s)) {
    const y = s.slice(0, 4);
    const m = s.slice(5, 7);
    const d = s.slice(8, 10);
    return `${d}/${m}/${y}`;
  }

  const dt = new Date(s);
  if (Number.isNaN(dt.getTime())) return s;
  return dt.toLocaleDateString("pt-BR");
}

// Returns an ISO date-only key (YYYY-MM-DD) in local time for comparisons/filters.
export function toLocalDateKey(value?: string | null): string | null {
  if (!value) return null;
  const s = String(value).trim();
  if (isIsoDateOnlyString(s)) return s;

  const dt = new Date(s);
  if (Number.isNaN(dt.getTime())) return null;
  const y = dt.getFullYear();
  const m = dt.getMonth() + 1;
  const d = dt.getDate();
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

