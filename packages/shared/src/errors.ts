import { ZodError } from "zod";

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

export type ErrorLogEntry = {
  errorClass: string[];
  code?: string;
  constraint?: string;
  stack?: string[];
};

const LOGGABLE_CODE = /^[A-Z0-9_]{2,40}$/;
const LOGGABLE_IDENTIFIER = /^[a-z0-9_]{1,63}$/i;

// Achado 158: erros de banco (DrizzleQueryError, NeonDbError) carregam query, params,
// detail e mensagem com valores do payload clinico/pessoal. Para o log vai so o que e
// metadado: classes da cadeia de causas, codigo (SQLSTATE/errno), nome da constraint e
// as linhas "at" da stack. Mensagens, params, detail e o objeto original nunca saem.
export function describeErrorForLog(error: unknown): ErrorLogEntry {
  const entry: ErrorLogEntry = { errorClass: [] };
  const seen = new Set<unknown>();
  let current: unknown = error;

  while (current && typeof current === "object" && !seen.has(current) && seen.size < 5) {
    seen.add(current);
    const item = current as { name?: unknown; code?: unknown; constraint?: unknown; cause?: unknown };
    // `name` sobrevive a minificacao; classes que nao o definem (DrizzleQueryError)
    // ficam com "Error" e caem no nome do construtor.
    const name = typeof item.name === "string" && LOGGABLE_IDENTIFIER.test(item.name) ? item.name : null;
    const ctor = current.constructor?.name;
    entry.errorClass.push(
      name && name !== "Error" ? name : ctor && LOGGABLE_IDENTIFIER.test(ctor) ? ctor : (name ?? "Object")
    );
    if (!entry.code && typeof item.code === "string" && LOGGABLE_CODE.test(item.code)) {
      entry.code = item.code;
    }
    if (!entry.constraint && typeof item.constraint === "string" && LOGGABLE_IDENTIFIER.test(item.constraint)) {
      entry.constraint = item.constraint;
    }
    current = item.cause;
  }
  if (!entry.errorClass.length) entry.errorClass.push(typeof error);

  if (error instanceof Error && typeof error.stack === "string") {
    const frames = error.stack
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.startsWith("at "))
      .slice(0, 10);
    if (frames.length) entry.stack = frames;
  }

  return entry;
}

export function toAppError(error: unknown, options?: { exposeMessage?: boolean }): AppError {
  if (error instanceof AppError) return error;
  if (error instanceof ZodError) {
    return new AppError("Payload invalido", 400, "VALIDATION_ERROR");
  }
  // Log unexpected errors so we can debug in Vercel/Node logs, sem dados do payload.
  console.error("Erro inesperado", describeErrorForLog(error));

  // When enabled (development/test), surface the underlying message to speed up debugging.
  if (options?.exposeMessage && error instanceof Error && error.message) {
    return new AppError(error.message, 500, "INTERNAL_ERROR");
  }

  return new AppError("Erro interno", 500, "INTERNAL_ERROR");
}
