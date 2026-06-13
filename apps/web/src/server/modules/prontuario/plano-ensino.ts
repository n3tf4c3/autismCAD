import "server-only";

import { env } from "@/lib/env";
import {
  getPlanoEnsinoTitulo,
  sanitizePlanoEnsinoPayload as sanitizePlanoEnsinoPayloadCore,
  type PlanoEnsinoBloco,
  type PlanoEnsinoPayload,
} from "@autismcad/shared/plano-ensino";

export { getPlanoEnsinoTitulo };
export type { PlanoEnsinoBloco, PlanoEnsinoPayload };

export function sanitizePlanoEnsinoPayload(input: unknown): PlanoEnsinoPayload {
  return sanitizePlanoEnsinoPayloadCore(input, env.APP_TIMEZONE);
}
