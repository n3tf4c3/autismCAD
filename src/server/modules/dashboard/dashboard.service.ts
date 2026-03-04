import "server-only";
import { and, asc, eq, gte, isNull, lte } from "drizzle-orm";
import { db } from "@/db";
import { atendimentos, pacientes, terapeutas } from "@/server/db/schema";
import { ymNowInClinicTz } from "@/server/shared/clock";

type LoadDashboardAgendaInput = {
  terapeutaId: number | null;
  today: string;
  ym: string;
};

function monthRange(ym: string) {
  const normalizedYm = /^\d{4}-\d{2}$/.test(ym) ? ym : ymNowInClinicTz();
  const [yearRaw, monthRaw] = normalizedYm.split("-");
  const year = Number(yearRaw);
  const month1 = Number(monthRaw);
  const startIso = `${year}-${String(month1).padStart(2, "0")}-01`;
  const lastDay = new Date(Date.UTC(year, month1, 0)).getUTCDate();
  const endIso = `${year}-${String(month1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { startIso, endIso };
}

export async function loadDashboardAgenda(input: LoadDashboardAgendaInput) {
  const { startIso, endIso } = monthRange(input.ym);
  const todayWhere = input.terapeutaId
    ? and(
        eq(atendimentos.data, input.today),
        isNull(atendimentos.deletedAt),
        eq(atendimentos.terapeutaId, input.terapeutaId)
      )
    : and(eq(atendimentos.data, input.today), isNull(atendimentos.deletedAt));
  const monthWhere = input.terapeutaId
    ? and(
        isNull(atendimentos.deletedAt),
        gte(atendimentos.data, startIso),
        lte(atendimentos.data, endIso),
        eq(atendimentos.terapeutaId, input.terapeutaId)
      )
    : and(
        isNull(atendimentos.deletedAt),
        gte(atendimentos.data, startIso),
        lte(atendimentos.data, endIso)
      );

  const [pendentes, monthAtendimentos] = await Promise.all([
    db
      .select({
        id: atendimentos.id,
        data: atendimentos.data,
        hora_inicio: atendimentos.horaInicio,
        hora_fim: atendimentos.horaFim,
        pacienteNome: pacientes.nome,
        terapeutaNome: terapeutas.nome,
        realizado: atendimentos.realizado,
        presenca: atendimentos.presenca,
      })
      .from(atendimentos)
      .innerJoin(pacientes, and(eq(pacientes.id, atendimentos.pacienteId), isNull(pacientes.deletedAt)))
      .leftJoin(terapeutas, eq(terapeutas.id, atendimentos.terapeutaId))
      .where(todayWhere)
      .orderBy(asc(atendimentos.horaInicio), asc(atendimentos.id))
      .limit(60),
    db
      .select({
        id: atendimentos.id,
        data: atendimentos.data,
        hora_inicio: atendimentos.horaInicio,
        hora_fim: atendimentos.horaFim,
        pacienteNome: pacientes.nome,
        terapeutaNome: terapeutas.nome,
        realizado: atendimentos.realizado,
        presenca: atendimentos.presenca,
      })
      .from(atendimentos)
      .innerJoin(pacientes, and(eq(pacientes.id, atendimentos.pacienteId), isNull(pacientes.deletedAt)))
      .leftJoin(terapeutas, eq(terapeutas.id, atendimentos.terapeutaId))
      .where(monthWhere)
      .orderBy(asc(atendimentos.data), asc(atendimentos.horaInicio), asc(atendimentos.id)),
  ]);

  return { pendentes, monthAtendimentos };
}
