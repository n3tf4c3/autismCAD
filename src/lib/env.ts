import "server-only";
import { z } from "zod";

const DEV_AUTH_SECRET = "dev_only_change_me_32_chars_minimum";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_DRIVER: z.enum(["neon-http", "neon-serverless"]).default("neon-serverless"),
  REQUIRE_DB_TRANSACTIONS: z.coerce.number().int().min(0).max(1).optional(),
  APP_TIMEZONE: z.string().min(1).default("America/Sao_Paulo"),
  NEXTAUTH_URL: z.string().url().optional(),
  NEXTAUTH_SECRET: z.string().min(32).optional(),
  AUTH_SECRET: z.string().min(32).optional(),
  DATABASE_URL: z
    .string()
    .url()
    .default("postgresql://postgres:postgres@localhost:5432/autismcad"),
  DATABASE_URL_UNPOOLED: z.string().url().optional(),
  BCRYPT_COST: z.coerce.number().int().min(8).max(15).default(12),

  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  // Optional: Cloudflare dashboard API token (not required for S3-compatible SDK).
  R2_API_TOKEN: z.string().optional(),
  R2_BUCKET: z.string().optional(),
  R2_REGION: z.string().default("auto"),
  R2_ENDPOINT: z.string().url().optional(),
  R2_PUBLIC_BASE_URL: z.string().url().optional(),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  throw new Error(`Invalid environment variables: ${parsed.error.message}`);
}

const authSecret = parsed.data.AUTH_SECRET ?? parsed.data.NEXTAUTH_SECRET ?? DEV_AUTH_SECRET;

if (parsed.data.NODE_ENV === "production" && authSecret === DEV_AUTH_SECRET) {
  throw new Error("Invalid environment variables: AUTH_SECRET deve ser definido com valor seguro em producao.");
}

const requireDbTransactions =
  parsed.data.REQUIRE_DB_TRANSACTIONS ?? (parsed.data.NODE_ENV === "production" ? 1 : 0);

export const env = {
  ...parsed.data,
  AUTH_SECRET: authSecret,
  REQUIRE_DB_TRANSACTIONS: requireDbTransactions,
};
