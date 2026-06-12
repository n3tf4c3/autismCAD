import "server-only";
import { z } from "zod";
import { AppError } from "@/server/shared/errors";

const sessionUserIdSchema = z.coerce.number().int().positive();

export function parseSessionUserId(value: unknown): number {
  const parsed = sessionUserIdSchema.safeParse(value);
  if (!parsed.success) {
    throw new AppError("Sessao invalida", 401, "UNAUTHORIZED");
  }
  return parsed.data;
}

