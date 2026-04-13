import { env } from "@/lib/env";
import { AppError } from "@/server/shared/errors";
import { withErrorHandlingNoContext } from "@/server/shared/http";
import { cleanupTempObjectsInR2 } from "@/server/storage/r2";

export const runtime = "nodejs";

function assertCronAuthorized(request: Request) {
  const configuredSecret = env.CRON_SECRET?.trim();
  if (!configuredSecret) {
    throw new AppError("CRON_SECRET nao configurado", 500, "CRON_NOT_CONFIGURED");
  }

  const authHeader = request.headers.get("authorization") || "";
  const bearerPrefix = "Bearer ";
  const providedSecret = authHeader.startsWith(bearerPrefix)
    ? authHeader.slice(bearerPrefix.length).trim()
    : null;

  if (providedSecret !== configuredSecret) {
    throw new AppError("Nao autorizado", 401, "UNAUTHORIZED");
  }
}

async function handleCleanup(request: Request) {
  assertCronAuthorized(request);

  const result = await cleanupTempObjectsInR2({
    prefix: "pacientes/temp/",
    retentionHours: env.R2_TEMP_UPLOAD_RETENTION_HOURS,
    batchSize: env.R2_TEMP_UPLOAD_CLEANUP_BATCH_SIZE,
  });

  return Response.json({
    ok: true,
    ...result,
  });
}

export const GET = withErrorHandlingNoContext(handleCleanup);
export const POST = withErrorHandlingNoContext(handleCleanup);
