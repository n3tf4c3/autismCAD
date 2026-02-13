import "server-only";
import { db } from "@/db";

function isNeonHttpNoTransaction(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("No transactions support in neon-http driver");
}

// drizzle-orm/neon-http does not support transactions. We keep the same code shape
// but run non-transactionally when the driver doesn't support it.
export async function runDbTransaction<T>(
  fn: (tx: typeof db) => Promise<T>
): Promise<T> {
  try {
    return await (db as unknown as { transaction: (cb: (tx: typeof db) => Promise<T>) => Promise<T> })
      .transaction(fn);
  } catch (error) {
    if (isNeonHttpNoTransaction(error)) {
      return await fn(db);
    }
    throw error;
  }
}

