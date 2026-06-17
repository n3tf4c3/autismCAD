import "./_load-env";
import { neon } from "@neondatabase/serverless";
import { maskDbTarget } from "./_cleanup-safety";

// Achado 104: a migration 0005 adiciona a FK composta evolucoes (atendimento_id,
// paciente_id, profissional_id) -> atendimentos. A ADD CONSTRAINT FALHA se houver
// evolucao cujo paciente/profissional nao coincida com o atendimento referenciado.
// Este precheck (read-only) reporta as linhas violadoras ANTES do `db:migrate`.

function readEnv(key: string): string | undefined {
  const value = process.env[key];
  return value && value.trim() ? value.trim() : undefined;
}

async function main() {
  const databaseUrl = readEnv("DATABASE_URL");
  if (!databaseUrl) throw new Error("DATABASE_URL nao configurado.");
  console.log(`[precheck-0005] alvo: ${maskDbTarget(databaseUrl)}`);

  const sql = neon(databaseUrl);

  const divergentes = await sql`
    select e.id, e.atendimento_id,
           e.paciente_id as evo_paciente, a.paciente_id as atend_paciente,
           e.profissional_id as evo_prof, a.profissional_id as atend_prof
    from evolucoes e
    join atendimentos a on a.id = e.atendimento_id
    where e.atendimento_id is not null
      and (e.paciente_id <> a.paciente_id or e.profissional_id <> a.profissional_id)
    limit 50
  `;

  console.log(
    JSON.stringify(
      {
        violacoes: { evolucao_atendimento_divergente: divergentes.length },
        amostras: { divergentes },
        pronto_para_migrar: divergentes.length === 0,
      },
      null,
      2
    )
  );

  if (divergentes.length > 0) {
    console.error(
      "\nHa evolucoes com paciente/profissional divergente do atendimento. Saneie antes de `db:migrate`."
    );
    process.exit(2);
  }
  console.log("\nSem violacoes. Seguro aplicar `npm run db:migrate`.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
