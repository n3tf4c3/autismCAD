import { env } from "@/lib/env";
import { AppError, describeErrorForLog, toAppError as toAppErrorCore } from "@autismcad/shared/errors";

export { AppError, describeErrorForLog };

export function toAppError(error: unknown): AppError {
  return toAppErrorCore(error, { exposeMessage: env.NODE_ENV !== "production" });
}
