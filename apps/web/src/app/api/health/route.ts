import { sql } from "drizzle-orm";
import { db } from "@/db";
import { withErrorHandlingNoContext } from "@/server/shared/http";

export const GET = withErrorHandlingNoContext(async () => {
  await db.execute(sql`select 1`);
  return Response.json({ ok: true, service: "autismcad-api" });
});
