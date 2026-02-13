import { ZodError } from "zod";
import { env } from "@/lib/env";

export class AppError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 500, code = "INTERNAL_ERROR") {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
  }
}

export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (error instanceof ZodError) {
    return new AppError("Payload invalido", 400, "VALIDATION_ERROR");
  }
  // Log unexpected errors so we can debug in Vercel/Node logs.
  console.error(error);

  // In development/test, surface the underlying message to speed up debugging.
  if (env.NODE_ENV !== "production" && error instanceof Error && error.message) {
    return new AppError(error.message, 500, "INTERNAL_ERROR");
  }

  return new AppError("Erro interno", 500, "INTERNAL_ERROR");
}
