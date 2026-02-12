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
  return new AppError("Erro interno", 500, "INTERNAL_ERROR");
}
