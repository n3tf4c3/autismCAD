// Reconhecimento de erros do Postgres pela forma do objeto. Fica no shared (sem
// `server-only`) para ser testavel; o app importa via `@/server/shared/pg-errors`.

type PgLikeError = {
  code?: string;
  constraint?: string;
  message?: string;
  cause?: unknown;
};

function collectErrorChain(error: unknown): PgLikeError[] {
  const chain: PgLikeError[] = [];
  const seen = new Set<unknown>();
  let current: unknown = error;

  while (current && !seen.has(current)) {
    seen.add(current);
    if (typeof current === "object") {
      const item = current as PgLikeError;
      chain.push(item);
      current = item.cause;
      continue;
    }
    break;
  }

  return chain;
}

export function isUniqueViolation(error: unknown): boolean {
  const chain = collectErrorChain(error);
  if (!chain.length) return false;

  return chain.some((item) => {
    if (item.code === "23505") return true;
    const msg = item.message ?? "";
    return msg.includes("duplicate key value violates unique constraint");
  });
}

// Violacao de FK (23503). O nome da constraint permite distinguir qual vinculo
// travou, para virar mensagem util em vez de "Erro interno".
export function isForeignKeyViolation(error: unknown, constraintName?: string): boolean {
  const chain = collectErrorChain(error);
  if (!chain.length) return false;

  return chain.some((item) => {
    const msg = item.message ?? "";
    const isFk = item.code === "23503" || msg.includes("violates foreign key constraint");
    if (!isFk) return false;
    if (!constraintName) return true;
    return item.constraint === constraintName || msg.includes(constraintName);
  });
}
