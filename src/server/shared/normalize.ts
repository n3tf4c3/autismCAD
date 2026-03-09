import "server-only";
import { ymdNowInClinicTz } from "@/server/shared/clock";

export function normalizeCpf(value: string): string {
  return value.replace(/\D/g, "").slice(0, 11);
}

export function normalizeOptionalText(value?: string | null): string | null {
  if (!value) return null;
  const parsed = value.trim();
  return parsed ? parsed : null;
}

export function normalizeDateOnlyLoose(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return null;
  return ymdNowInClinicTz(date);
}

export function normalizeDateOnlyStrict(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
}

export function escapeLikePattern(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}
