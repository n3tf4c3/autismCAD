import "server-only";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
import * as schema from "@/server/db/schema";
import { env } from "@/lib/env";

config({ path: ".env.local" });
config({ path: ".env" });

const sql = neon(env.DATABASE_URL);
export const db = drizzle({ client: sql, schema });
