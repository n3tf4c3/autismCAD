import "server-only";
import { and, asc, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { agendaBloqueios, atendimentos } from "@/server/db/schema";
import { AppError } from "@/server/shared/errors";
import type {
  CriarBloqueiosInput,
  ListarBloqueiosInput,
} from "@/server/modules/agenda/bloqueios.schema";

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
  const datas = Array.from(new Set(input.datas));

  // Conflito com atendimento existente do profissional (qualquer sessao).
  const [conflitoAtendimento] = await db
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
  const [conflitoBloqueio] = await db
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

  const inserted = await db
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
