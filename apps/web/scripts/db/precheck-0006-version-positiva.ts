import "./_load-env";
import { neon } from "@neondatabase/serverless";
import { maskDbTarget } from "./_cleanup-safety";

// Achado 120: a migration 0006 adiciona CHECK (version > 0) em anamnese_versions e
// prontuario_documentos. Falha se ja houver version <= 0. Este precheck (read-only)
// reporta as linhas violadoras ANTES do `db:migrate`. (As FKs restrict da mesma
// migration nao validam dados existentes; so os checks.)

function readEnv(key: string): string | undefined {
  const value = process.env[key];
  return value && value.trim() ? value.trim() : undefined;
}

async function main() {
  const databaseUrl = readEnv("DATABASE_URL");
  if (!databaseUrl) throw new Error("DATABASE_URL nao configurado.");
  console.log(`[precheck-0006] alvo: ${maskDbTarget(databaseUrl)}`);

  const sql = neon(databaseUrl);

  const anamneseVersions = await sql`
    select id, version from anamnese_versions where version <= 0 limit 50
  `;
  const documentos = await sql`
    select id, version from prontuario_documentos where version <= 0 limit 50
  `;

  const total = anamneseVersions.length + documentos.length;
  console.log(
    JSON.stringify(
      {
        violacoes: {
          anamnese_versions_version_pos: anamneseVersions.length,
          prontuario_documentos_version_pos: documentos.length,
        },
        amostras: { anamneseVersions, documentos },
        pronto_para_migrar: total === 0,
      },
      null,
      2
    )
  );

  if (total > 0) {
    console.error("\nHa versoes <= 0. Saneie antes de `db:migrate`.");
    process.exit(2);
  }
  console.log("\nSem violacoes. Seguro aplicar `npm run db:migrate`.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
