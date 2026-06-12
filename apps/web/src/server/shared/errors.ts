import { env } from "@/lib/env";
import { AppError, toAppError as toAppErrorCore } from "@autismcad/shared/errors";

export { AppError };

export function toAppError(error: unknown): AppError {
  return toAppErrorCore(error, { exposeMessage: env.NODE_ENV !== "production" });
}
