import "server-only";

export function isUniqueViolation(error: unknown): boolean {
  const anyErr = error as { code?: string; message?: string };
  if (anyErr?.code === "23505") return true;
  const msg = anyErr?.message ?? "";
  return msg.includes("duplicate key value violates unique constraint");
}
