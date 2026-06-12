import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// O .env.local/.env do app continua em apps/web/; este config roda com cwd=packages/db.
config({ path: "../../apps/web/.env.local" });
config({ path: "../../apps/web/.env" });

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./src/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      "postgresql://postgres:postgres@localhost:5432/autismcad",
  },
});
