import "server-only";
import { db } from "@/db";
import { env } from "@/lib/env";
import { AppError } from "@/server/shared/errors";

function isNeonHttpNoTransaction(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("No transactions support in neon-http driver");
}

type DbTransactionMode = "allow-fallback" | "required";

type DbTransactionOptions = {
  mode?: DbTransactionMode;
  operation?: string;
};

const warnedFallbackOperations = new Set<string>();

export async function runDbTransaction<T>(
  fn: (tx: typeof db) => Promise<T>,
  options?: DbTransactionOptions
): Promise<T> {
  const mode = options?.mode ?? "required";
  const operation = options?.operation ?? "db.transaction";
  const requiresAtomicity = mode === "required" || env.REQUIRE_DB_TRANSACTIONS === 1;

  if (env.DATABASE_DRIVER === "neon-http") {
    if (requiresAtomicity) {
      throw new AppError(
        `Transacao obrigatoria indisponivel para ${operation}. Configure DATABASE_DRIVER=neon-serverless.`,
        503,
        "TRANSACTION_UNSUPPORTED"
      );
    }

    if (!warnedFallbackOperations.has(operation)) {
      warnedFallbackOperations.add(operation);
      console.warn(
        `[db] Fallback sem transacao para ${operation}. Configure DATABASE_DRIVER=neon-serverless e REQUIRE_DB_TRANSACTIONS=1 para atomicidade obrigatoria.`
      );
    }

    return await fn(db);
  }

  try {
    return await (db as unknown as { transaction: (cb: (tx: typeof db) => Promise<T>) => Promise<T> })
      .transaction(fn);
  } catch (error) {
    if (isNeonHttpNoTransaction(error)) {
      if (requiresAtomicity) {
        throw new AppError(
          `Transacao obrigatoria indisponivel para ${operation}. Configure DATABASE_DRIVER=neon-serverless.`,
          503,
          "TRANSACTION_UNSUPPORTED"
        );
      }

      if (!warnedFallbackOperations.has(operation)) {
        warnedFallbackOperations.add(operation);
        console.warn(
          `[db] Fallback sem transacao para ${operation}. Configure DATABASE_DRIVER=neon-serverless e REQUIRE_DB_TRANSACTIONS=1 para atomicidade obrigatoria.`
        );
      }

      return await fn(db);
    }
    throw error;
  }
}
