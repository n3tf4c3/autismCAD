import "./_load-env";
import { neon } from "@neondatabase/serverless";
import { maskDbTarget } from "./_cleanup-safety";

// Achado 86/87/100: a migration 0003 adiciona CHECK constraints que FALHAM se houver
// dados existentes que as violem. Este precheck (read-only) reporta linhas violadoras
// ANTES do `db:migrate`, evitando aplicacao parcial. Rodar e exigir zero antes de migrar.

function readEnv(key: string): string | undefined {
  const value = process.env[key];
  return value && value.trim() ? value.trim() : undefined;
}

async function main() {
  const databaseUrl = readEnv("DATABASE_URL");
  if (!databaseUrl) throw new Error("DATABASE_URL nao configurado.");
  console.log(`[precheck-0003] alvo: ${maskDbTarget(databaseUrl)}`);

  const sql = neon(databaseUrl);

  const atendimentos = await sql`
    select id, hora_inicio, hora_fim from atendimentos where hora_fim <= hora_inicio limit 50
  `;
  const bloqueios = await sql`
    select id, hora_inicio, hora_fim from agenda_bloqueios where hora_fim <= hora_inicio limit 50
  `;
  const documentos = await sql`
    select id, tipo from prontuario_documentos
    where tipo not in ('ANAMNESE','PLANO_TERAPEUTICO','PLANO_ENSINO','RELATORIO_MULTIPROFISSIONAL','OUTRO')
    limit 50
  `;

  const total = atendimentos.length + bloqueios.length + documentos.length;
  console.log(
    JSON.stringify(
      {
        violacoes: {
          atendimentos_hora_ordem: atendimentos.length,
          agenda_bloqueios_hora_ordem: bloqueios.length,
          prontuario_documentos_tipo: documentos.length,
        },
        amostras: { atendimentos, bloqueios, documentos },
        pronto_para_migrar: total === 0,
      },
      null,
      2
    )
  );

  if (total > 0) {
    console.error(
      "\nHa dados que violam as constraints da migration 0003. Saneie antes de `db:migrate`."
    );
    process.exit(2);
  }
  console.log("\nSem violacoes. Seguro aplicar `npm run db:migrate`.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
