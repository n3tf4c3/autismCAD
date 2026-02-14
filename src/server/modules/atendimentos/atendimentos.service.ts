import "server-only";
import {
  and,
  desc,
  eq,
  gte,
  isNull,
  lte,
  sql,
} from "drizzle-orm";
import { db } from "@/db";
import { atendimentos, pacientes, terapeutas } from "@/server/db/schema";
import {
  AtendimentosQueryInput,
  ExcluirDiaInput,
  presencasPermitidas,
  RecorrenteInput,
  SaveAtendimentoInput,
  turnosPermitidos,
} from "@/server/modules/atendimentos/atendimentos.schema";
import { AppError } from "@/server/shared/errors";

function normalizeTurno(value?: string | null) {
  return value && turnosPermitidos.has(value) ? value : "Matutino";
}

function normalizePresenca(value?: string | null) {
  return value && presencasPermitidas.has(value) ? value : "Nao informado";
}

function normalizeTime(value: string): string {
  // Accept "HH:MM" or "HH:MM:SS"
  const trimmed = value.trim();
  if (/^\d{2}:\d{2}$/.test(trimmed)) return `${trimmed}:00`;
  if (/^\d{2}:\d{2}:\d{2}$/.test(trimmed)) return trimmed;
  throw new AppError("Horario invalido", 400, "INVALID_TIME");
}

function normalizeDate(value: string): string {
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw new AppError("Data invalida", 400, "INVALID_DATE");
  }
  return trimmed;
}

function parseDateOnlyUtc(value: string): Date {
  const trimmed = normalizeDate(value);
  const dt = new Date(`${trimmed}T00:00:00.000Z`);
  if (Number.isNaN(dt.getTime())) {
    throw new AppError("Data invalida", 400, "INVALID_DATE");
  }
  return dt;
}

async function existeConflitoHorario(params: {
  pacienteId: number;
  data: string;
  horaInicio: string;
  horaFim: string;
  ignoreId?: number | null;
}) {
  const where = [
    eq(atendimentos.pacienteId, params.pacienteId),
    eq(atendimentos.data, params.data),
    isNull(atendimentos.deletedAt),
    // overlap: newEnd > start AND newStart < end
    sql`${params.horaFim}::time > ${atendimentos.horaInicio} AND ${params.horaInicio}::time < ${atendimentos.horaFim}`,
  ];
  if (params.ignoreId) {
    where.push(sql`${atendimentos.id} <> ${params.ignoreId}`);
  }

  const [row] = await db
    .select({ id: atendimentos.id })
    .from(atendimentos)
    .where(and(...where))
    .limit(1);

  return Boolean(row);
}

export async function listarAtendimentos(filters: AtendimentosQueryInput) {
  const where = [isNull(atendimentos.deletedAt)];
  if (filters.pacienteId) where.push(eq(atendimentos.pacienteId, filters.pacienteId));
  if (filters.terapeutaId) where.push(eq(atendimentos.terapeutaId, filters.terapeutaId));
  if (filters.dataIni) where.push(gte(atendimentos.data, filters.dataIni));
  if (filters.dataFim) where.push(lte(atendimentos.data, filters.dataFim));

  const rows = await db
    .select({
      id: atendimentos.id,
      paciente_id: atendimentos.pacienteId,
      terapeuta_id: atendimentos.terapeutaId,
      data: atendimentos.data,
      hora_inicio: atendimentos.horaInicio,
      hora_fim: atendimentos.horaFim,
      turno: atendimentos.turno,
      periodo_inicio: atendimentos.periodoInicio,
      periodo_fim: atendimentos.periodoFim,
      presenca: atendimentos.presenca,
      realizado: atendimentos.realizado,
      motivo: atendimentos.motivo,
      observacoes: atendimentos.observacoes,
      created_at: atendimentos.createdAt,
      updated_at: atendimentos.updatedAt,
      paciente_nome: pacientes.nome,
      terapeuta_nome: terapeutas.nome,
    })
    .from(atendimentos)
    .innerJoin(pacientes, and(eq(pacientes.id, atendimentos.pacienteId), isNull(pacientes.deletedAt)))
    .leftJoin(terapeutas, eq(terapeutas.id, atendimentos.terapeutaId))
    .where(and(...where))
    .orderBy(desc(atendimentos.data), desc(atendimentos.horaInicio), desc(atendimentos.id));

  return rows.map((row) => ({
    id: row.id,
    paciente_id: row.paciente_id,
    terapeuta_id: row.terapeuta_id,
    pacienteNome: row.paciente_nome,
    terapeutaNome: row.terapeuta_nome,
    data: row.data,
    hora_inicio: row.hora_inicio,
    hora_fim: row.hora_fim,
    turno: row.turno,
    periodo_inicio: row.periodo_inicio,
    periodo_fim: row.periodo_fim,
    presenca: row.presenca,
    realizado: row.realizado ? 1 : 0,
    motivo: row.motivo,
    observacoes: row.observacoes,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
}

export async function salvarAtendimento(input: SaveAtendimentoInput, id?: number | null) {
  const data = normalizeDate(input.data);
  const horaInicio = normalizeTime(input.horaInicio);
  const horaFim = normalizeTime(input.horaFim);
  const turno = normalizeTurno(input.turno);
  const presenca = normalizePresenca(input.presenca);

  if (presenca === "Ausente" && !input.motivo?.trim()) {
    throw new AppError("Motivo e obrigatorio quando ausente", 400, "MOTIVO_REQUIRED");
  }

  const conflito = await existeConflitoHorario({
    pacienteId: input.pacienteId,
    data,
    horaInicio,
    horaFim,
    ignoreId: id ?? null,
  });
  if (conflito) {
    throw new AppError("Conflito de horario para este paciente", 409, "SCHEDULE_CONFLICT");
  }

  const realizado = presenca === "Presente";

  if (id) {
    const [existing] = await db
      .select({ id: atendimentos.id })
      .from(atendimentos)
      .where(eq(atendimentos.id, id))
      .limit(1);
    if (!existing) {
      throw new AppError("Atendimento nao encontrado", 404, "NOT_FOUND");
    }

    await db
      .update(atendimentos)
      .set({
        pacienteId: input.pacienteId,
        terapeutaId: input.terapeutaId,
        data,
        horaInicio,
        horaFim,
        turno,
        periodoInicio: input.periodoInicio ? normalizeDate(input.periodoInicio) : null,
        periodoFim: input.periodoFim ? normalizeDate(input.periodoFim) : null,
        presenca,
        realizado,
        motivo: input.motivo?.trim() || null,
        observacoes: input.observacoes?.trim() || null,
        updatedAt: sql`now()`,
      })
      .where(eq(atendimentos.id, id));
    return id;
  }

  const [saved] = await db
    .insert(atendimentos)
    .values({
      pacienteId: input.pacienteId,
      terapeutaId: input.terapeutaId,
      data,
      horaInicio,
      horaFim,
      turno,
      periodoInicio: input.periodoInicio ? normalizeDate(input.periodoInicio) : null,
      periodoFim: input.periodoFim ? normalizeDate(input.periodoFim) : null,
      presenca,
      realizado,
      motivo: input.motivo?.trim() || null,
      observacoes: input.observacoes?.trim() || null,
    })
    .returning({ id: atendimentos.id });

  return saved.id;
}

export async function softDeleteAtendimento(id: number, deletedByUserId?: number | null) {
  const [row] = await db
    .update(atendimentos)
    .set({
      deletedAt: sql`now()`,
      deletedByUserId: deletedByUserId ?? null,
      updatedAt: sql`now()`,
    })
    .where(and(eq(atendimentos.id, id), isNull(atendimentos.deletedAt)))
    .returning({ id: atendimentos.id });

  if (!row) {
    throw new AppError("Atendimento nao encontrado", 404, "NOT_FOUND");
  }
  return row;
}

export async function criarRecorrentes(payload: RecorrenteInput) {
  const inicio = parseDateOnlyUtc(payload.periodoInicio);
  const fim = parseDateOnlyUtc(payload.periodoFim);
  if (inicio > fim) {
    throw new AppError("Data inicial maior que final", 400, "INVALID_PERIOD");
  }

  const dias = new Set(payload.diasSemana);
  const results: { id: number; data: string }[] = [];
  let total = 0;

  // Use UTC to avoid timezone-dependent getDay() behavior for date-only strings.
  for (let dt = new Date(inicio); dt <= fim; dt.setUTCDate(dt.getUTCDate() + 1)) {
    const dow = dt.getUTCDay(); // 0..6 (Sun..Sat) matches Postgres extract(dow)
    if (!dias.has(dow)) continue;
    total += 1;
    if (total > 400) {
      throw new AppError("Intervalo muito grande. Limite de 400 atendimentos por lote.", 400, "TOO_LARGE");
    }
    const data = dt.toISOString().slice(0, 10);
    const id = await salvarAtendimento(
      {
        pacienteId: payload.pacienteId,
        terapeutaId: payload.terapeutaId,
        data,
        horaInicio: payload.horaInicio,
        horaFim: payload.horaFim,
        turno: payload.turno,
        periodoInicio: payload.periodoInicio,
        periodoFim: payload.periodoFim,
        presenca: payload.presenca,
        motivo: payload.motivo,
        observacoes: payload.observacoes,
      },
      null
    );
    results.push({ id, data });
  }

  if (!results.length) {
    throw new AppError(
      "Nenhum atendimento gerado para o periodo e dias selecionados",
      400,
      "NO_MATCH"
    );
  }

  return { criados: results.length, atendimentos: results };
}

export async function excluirDia(payload: ExcluirDiaInput) {
  const inicio = parseDateOnlyUtc(payload.periodoInicio);
  const fim = parseDateOnlyUtc(payload.periodoFim);
  if (inicio > fim) {
    throw new AppError("Data inicial maior que final", 400, "INVALID_PERIOD");
  }

  const turno = normalizeTurno(payload.turno);
  const horaInicio = normalizeTime(payload.horaInicio);
  const horaFim = normalizeTime(payload.horaFim);

  // Remove only planned, not absent, not done.
  const where = [
    eq(atendimentos.pacienteId, payload.pacienteId),
    eq(atendimentos.horaInicio, horaInicio),
    eq(atendimentos.horaFim, horaFim),
    eq(atendimentos.turno, turno),
    gte(atendimentos.data, payload.periodoInicio),
    lte(atendimentos.data, payload.periodoFim),
    isNull(atendimentos.deletedAt),
    sql`extract(dow from ${atendimentos.data}) = ${payload.diaSemana}`,
    sql`${atendimentos.presenca} <> 'Ausente'`,
    eq(atendimentos.realizado, false),
  ];
  if (payload.terapeutaId) where.push(eq(atendimentos.terapeutaId, payload.terapeutaId));

  const removed = await db
    .delete(atendimentos)
    .where(and(...where))
    .returning({ id: atendimentos.id });

  return { removidos: removed.length };
}
