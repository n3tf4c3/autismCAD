import "server-only";
import { drizzle as drizzleHttp } from "drizzle-orm/neon-http";
import { drizzle as drizzleServerless } from "drizzle-orm/neon-serverless";
import { neon } from "@neondatabase/serverless";
import * as schema from "@/server/db/schema";
import { env } from "@/lib/env";

const httpDb = drizzleHttp({ client: neon(env.DATABASE_URL), schema });
type DbClient = typeof httpDb;

export const db: DbClient =
  env.DATABASE_DRIVER === "neon-serverless"
    ? (drizzleServerless(env.DATABASE_URL, { schema }) as unknown as DbClient)
    : httpDb;
