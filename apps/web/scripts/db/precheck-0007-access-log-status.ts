import "./_load-env";
import { neon } from "@neondatabase/serverless";
import { maskDbTarget } from "./_cleanup-safety";

// Achado 121: a migration 0007 adiciona CHECK (status in ('SUCESSO','FALHA')) em
// access_logs. Falha se ja houver status fora desse dominio. Precheck read-only.

function readEnv(key: string): string | undefined {
  const value = process.env[key];
  return value && value.trim() ? value.trim() : undefined;
}

async function main() {
  const databaseUrl = readEnv("DATABASE_URL");
  if (!databaseUrl) throw new Error("DATABASE_URL nao configurado.");
  console.log(`[precheck-0007] alvo: ${maskDbTarget(databaseUrl)}`);

  const sql = neon(databaseUrl);

  const foraDoDominio = await sql`
    select status, count(*)::int as total from access_logs
    where status not in ('SUCESSO', 'FALHA')
    group by status limit 50
  `;

  const total = foraDoDominio.reduce((acc, row) => acc + Number(row.total ?? 0), 0);
  console.log(
    JSON.stringify(
      {
        violacoes: { access_logs_status_fora_dominio: total },
        amostras: { foraDoDominio },
        pronto_para_migrar: total === 0,
      },
      null,
      2
    )
  );

  if (total > 0) {
    console.error("\nHa status fora de ('SUCESSO','FALHA'). Saneie antes de `db:migrate`.");
    process.exit(2);
  }
  console.log("\nSem violacoes. Seguro aplicar `npm run db:migrate`.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
