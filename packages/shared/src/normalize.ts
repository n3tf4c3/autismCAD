import { isCalendarDate, ymdInTz } from "./datetime";

export function normalizeCpf(value: string): string {
  return value.replace(/\D/g, "").slice(0, 11);
}

export function normalizeOptionalText(value?: string | null): string | null {
  if (!value) return null;
  const parsed = value.trim();
  return parsed ? parsed : null;
}

export function normalizeDateOnlyLoose(
  value: string | null | undefined,
  timeZone: string,
): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  // Achado 109: entrada date-only so passa se for data de calendario real; invalida
  // (ex.: 2026-02-31) vira null em vez de rolar para 2026-03-03 via new Date().
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return isCalendarDate(trimmed) ? trimmed : null;
  }
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return null;
  return ymdInTz(date, timeZone);
}

export function normalizeDateOnlyStrict(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  // Achado 109: exige data de calendario real, nao so o formato YYYY-MM-DD.
  return isCalendarDate(trimmed) ? trimmed : null;
}

export function escapeLikePattern(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}
