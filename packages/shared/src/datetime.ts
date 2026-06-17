function partsFromDateInTz(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  if (!year || !month || !day) {
    throw new Error(`Nao foi possivel calcular data para timezone ${timeZone}`);
  }
  return { year, month, day };
}

export function ymdInTz(date: Date, timeZone: string): string {
  const { year, month, day } = partsFromDateInTz(date, timeZone);
  return `${year}-${month}-${day}`;
}

// Achado 109: YYYY-MM-DD como data de calendario real (rejeita 2026-02-31). Gemeo do
// isCalendarDate em @autismcad/validators/common/datetime; centralizar e refactor futuro.
export function isCalendarDate(value: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return false;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function ymInTz(date: Date, timeZone: string): string {
  const { year, month } = partsFromDateInTz(date, timeZone);
  return `${year}-${month}`;
}

export function ymdMinusDaysInTz(days: number, date: Date, timeZone: string): string {
  const currentYmd = ymdInTz(date, timeZone);
  const base = new Date(`${currentYmd}T00:00:00.000Z`);
  base.setUTCDate(base.getUTCDate() - days);
  return base.toISOString().slice(0, 10);
}
