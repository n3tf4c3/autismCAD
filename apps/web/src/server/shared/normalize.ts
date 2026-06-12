import "server-only";
import { env } from "@/lib/env";
import {
  normalizeCpf,
  normalizeDateOnlyLoose as normalizeDateOnlyLooseCore,
  normalizeDateOnlyStrict,
  normalizeOptionalText,
  escapeLikePattern,
} from "@autismcad/shared/normalize";

export { normalizeCpf, normalizeOptionalText, normalizeDateOnlyStrict, escapeLikePattern };

export function normalizeDateOnlyLoose(value?: string | null): string | null {
  return normalizeDateOnlyLooseCore(value, env.APP_TIMEZONE);
}
