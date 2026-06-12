import "server-only";

type PgLikeError = {
  code?: string;
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
