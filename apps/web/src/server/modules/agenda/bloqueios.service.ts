import "server-only";
import { and, asc, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { runDbTransaction } from "@/server/db/transaction";
import { agendaBloqueios, atendimentos, terapeutas } from "@/server/db/schema";
import { AppError } from "@/server/shared/errors";

function advisoryLockHash64(value: string) {
  return sql`(('x' || substr(md5(${value}), 1, 16))::bit(64)::bigint)`;
}
import type {
  CriarBloqueiosInput,
  ListarBloqueiosInput,
} from "@autismcad/validators/agenda/bloqueios.schema";

function toDto(row: {
  id: number;
  profissionalId: number;
  data: string;
  horaInicio: string;
  horaFim: string;
  observacoes: string | null;
}) {
  return {
    id: Number(row.id),
    profissionalId: Number(row.profissionalId),
    data: String(row.data).slice(0, 10),
    horaInicio: String(row.horaInicio).slice(0, 5),
    horaFim: String(row.horaFim).slice(0, 5),
    observacoes: row.observacoes ?? null,
  };
}

export async function listarBloqueios(input: ListarBloqueiosInput) {
  const where = [eq(agendaBloqueios.profissionalId, input.profissionalId)];
  if (input.dataIni) where.push(gte(agendaBloqueios.data, input.dataIni));
  if (input.dataFim) where.push(lte(agendaBloqueios.data, input.dataFim));

  const rows = await db
    .select({
      id: agendaBloqueios.id,
      profissionalId: agendaBloqueios.profissionalId,
      data: agendaBloqueios.data,
      horaInicio: agendaBloqueios.horaInicio,
      horaFim: agendaBloqueios.horaFim,
      observacoes: agendaBloqueios.observacoes,
    })
    .from(agendaBloqueios)
    .where(and(...where))
    .orderBy(asc(agendaBloqueios.data), asc(agendaBloqueios.horaInicio));

  return rows.map(toDto);
}

export async function criarBloqueios(input: CriarBloqueiosInput, createdByUserId: number) {
  // Achado 55: ordena as datas para que requisicoes concorrentes adquiram os
  // advisory locks sempre na mesma ordem, evitando deadlock por ordem de entrada.
  const datas = Array.from(new Set(input.datas)).sort();

  // Achado 45: checagem de conflito e insert correm na mesma transacao, com
  // advisory lock por profissional+data, evitando corrida entre validacao e gravacao
  // (inclusive contra a criacao de atendimentos, que usa o mesmo padrao de lock).
  return runDbTransaction(
    async (tx) => {
      // Achado 46: garante que o profissional existe, esta ativo e nao foi deletado.
      const [prof] = await tx
        .select({ id: terapeutas.id })
        .from(terapeutas)
        .where(
          and(
            eq(terapeutas.id, input.profissionalId),
            eq(terapeutas.ativo, true),
            isNull(terapeutas.deletedAt)
          )
        )
        .limit(1);
      if (!prof) {
        throw new AppError("Profissional inativo ou removido", 409, "PROFISSIONAL_INATIVO");
      }

      for (const data of datas) {
        const lockKey = `atendimentos:profissional:${input.profissionalId}:${data}`;
        await tx.execute(sql`select pg_advisory_xact_lock(${advisoryLockHash64(lockKey)})`);
      }

      // Conflito com atendimento existente do profissional (qualquer sessao).
      const [conflitoAtendimento] = await tx
        .select({ data: atendimentos.data })
        .from(atendimentos)
        .where(
          and(
            eq(atendimentos.profissionalId, input.profissionalId),
            inArray(atendimentos.data, datas),
            isNull(atendimentos.deletedAt),
            sql`${input.horaFim}::time > ${atendimentos.horaInicio} AND ${input.horaInicio}::time < ${atendimentos.horaFim}`
          )
        )
        .limit(1);
      if (conflitoAtendimento) {
        throw new AppError(
          `Ja existe atendimento neste horario em ${String(conflitoAtendimento.data).slice(0, 10)}`,
          409,
          "SCHEDULE_CONFLICT"
        );
      }

      // Conflito com bloqueio existente.
      const [conflitoBloqueio] = await tx
        .select({ data: agendaBloqueios.data })
        .from(agendaBloqueios)
        .where(
          and(
            eq(agendaBloqueios.profissionalId, input.profissionalId),
            inArray(agendaBloqueios.data, datas),
            sql`${input.horaFim}::time > ${agendaBloqueios.horaInicio} AND ${input.horaInicio}::time < ${agendaBloqueios.horaFim}`
          )
        )
        .limit(1);
      if (conflitoBloqueio) {
        throw new AppError(
          `Ja existe bloqueio neste horario em ${String(conflitoBloqueio.data).slice(0, 10)}`,
          409,
          "SCHEDULE_CONFLICT"
        );
      }

      const inserted = await tx
        .insert(agendaBloqueios)
        .values(
          datas.map((data) => ({
            profissionalId: input.profissionalId,
            data,
            horaInicio: input.horaInicio,
            horaFim: input.horaFim,
            observacoes: input.observacoes?.trim() || null,
            createdByUserId,
          }))
        )
        .returning({ id: agendaBloqueios.id });

      return { criados: inserted.length };
    },
    { operation: "agenda.criarBloqueios", mode: "required" }
  );
}

export async function excluirBloqueio(id: number) {
  const [removed] = await db
    .delete(agendaBloqueios)
    .where(eq(agendaBloqueios.id, id))
    .returning({ id: agendaBloqueios.id });
  if (!removed) {
    throw new AppError("Bloqueio nao encontrado", 404, "NOT_FOUND");
  }
  return { id: Number(removed.id) };
}
