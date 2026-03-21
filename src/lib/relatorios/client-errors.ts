type ActionErrorLike = {
  ok: false;
  error?: string | null;
};

type ActionResultLike<T> =
  | {
      ok: true;
      data: T;
    }
  | ActionErrorLike;

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function mapRelatorioErrorMessage(message: string, fallback: string): string {
  const msg = String(message || "").trim();
  if (!msg) return fallback;

  const key = normalizeText(msg);
  if (key.includes("quadro administrativo")) {
    return "Este profissional faz parte do quadro administrativo e nao pode ser usado em relatorios clinicos.";
  }

  return msg;
}

export function normalizeRelatorioApiError(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    return mapRelatorioErrorMessage(error.message, fallback);
  }
  if (typeof error === "string") {
    return mapRelatorioErrorMessage(error, fallback);
  }
  return fallback;
}

export function unwrapRelatorioAction<T>(result: ActionResultLike<T>, fallback: string): T {
  if (result.ok) return result.data;
  const mapped = mapRelatorioErrorMessage(String(result.error || fallback), fallback);
  throw new Error(mapped);
}
