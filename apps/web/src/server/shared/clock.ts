import "server-only";

import { env } from "@/lib/env";

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

export function ymdNowInClinicTz(date = new Date()): string {
  const { year, month, day } = partsFromDateInTz(date, env.APP_TIMEZONE);
  return `${year}-${month}-${day}`;
}

export function ymNowInClinicTz(date = new Date()): string {
  const { year, month } = partsFromDateInTz(date, env.APP_TIMEZONE);
  return `${year}-${month}`;
}

export function ymdMinusDaysInClinicTz(days: number, date = new Date()): string {
  const currentYmd = ymdNowInClinicTz(date);
  const base = new Date(`${currentYmd}T00:00:00.000Z`);
  base.setUTCDate(base.getUTCDate() - days);
  return base.toISOString().slice(0, 10);
}
