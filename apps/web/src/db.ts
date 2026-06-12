import "server-only";
import { drizzle as drizzleHttp } from "drizzle-orm/neon-http";
import { drizzle as drizzleServerless } from "drizzle-orm/neon-serverless";
import { neon } from "@neondatabase/serverless";
import * as schema from "@/server/db/schema";
import { env } from "@/lib/env";

const httpDb = drizzleHttp({ client: neon(env.DATABASE_URL), schema });
type DbClient = typeof httpDb;
const serverlessUrl = env.DATABASE_URL_UNPOOLED ?? env.DATABASE_URL;

if (
  env.DATABASE_DRIVER === "neon-serverless" &&
  !env.DATABASE_URL_UNPOOLED &&
  env.DATABASE_URL.includes("-pooler.")
) {
  console.warn(
    "[db] DATABASE_DRIVER=neon-serverless com URL pooler. Defina DATABASE_URL_UNPOOLED para reduzir falhas de WebSocket (ErrorEvent)."
  );
}

export const db: DbClient =
  env.DATABASE_DRIVER === "neon-serverless"
    ? (drizzleServerless(serverlessUrl, { schema }) as unknown as DbClient)
    : httpDb;
