import "server-only";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXTAUTH_URL: z.string().url().optional(),
  AUTH_SECRET: z.string().min(32).default("dev_only_change_me_32_chars_minimum"),
  DATABASE_URL: z
    .string()
    .url()
    .default("postgresql://postgres:postgres@localhost:5432/autismcad"),
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

export const env = parsed.data;
