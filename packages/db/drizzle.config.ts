import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";
import { resolve } from "node:path";

// O .env.local/.env do app vive em apps/web/; resolvemos relativo a ESTE arquivo,
// nao ao cwd, para o config carregar de qualquer diretorio (achado 107).
const webEnvDir = resolve(__dirname, "../../apps/web");
config({ path: resolve(webEnvDir, ".env.local") });
config({ path: resolve(webEnvDir, ".env") });

// Achado 107: sem fallback silencioso para localhost. Faltando DATABASE_URL o comando
// falha em vez de mascarar erro de configuracao; o banco local de sandbox exige
// opt-in explicito via DB_LOCAL_FALLBACK=1.
const LOCAL_SANDBOX_URL = "postgresql://postgres:postgres@localhost:5432/autismcad";

function resolveDatabaseUrl(): string {
  const url = process.env.DATABASE_URL?.trim();
  if (url) return url;
  if (process.env.DB_LOCAL_FALLBACK === "1") return LOCAL_SANDBOX_URL;
  throw new Error(
    "DATABASE_URL ausente. Defina DATABASE_URL ou, para o banco local de sandbox, exporte DB_LOCAL_FALLBACK=1."
  );
}

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./src/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: resolveDatabaseUrl(),
  },
});
