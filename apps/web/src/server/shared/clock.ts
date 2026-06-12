import "server-only";

import { env } from "@/lib/env";
import { ymdInTz, ymInTz, ymdMinusDaysInTz } from "@autismcad/shared/datetime";

export function ymdNowInClinicTz(date = new Date()): string {
  return ymdInTz(date, env.APP_TIMEZONE);
}

export function ymNowInClinicTz(date = new Date()): string {
  return ymInTz(date, env.APP_TIMEZONE);
}

export function ymdMinusDaysInClinicTz(days: number, date = new Date()): string {
  return ymdMinusDaysInTz(days, date, env.APP_TIMEZONE);
}
