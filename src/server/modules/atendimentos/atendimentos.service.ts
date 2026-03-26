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
import { runDbTransaction } from "@/server/db/transaction";
import { atendimentos, pacientes, terapeutas as profissionaisTabela } from "@/server/db/schema";
import {
  AtendimentosQueryInput,
  ExcluirDiaInput,
  presencasPermitidas,
  RecorrenteInput,
  SaveAtendimentoInput,
  turnosPermitidos,
} from "@/server/modules/atendimentos/atendimentos.schema";
import { AppError } from "@/server/shared/errors";
import { normalizeDateOnlyStrict } from "@/server/shared/normalize";

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

function normalizeDateRequired(value: string): string {
  const normalized = normalizeDateOnlyStrict(value);
  if (!normalized) {
    throw new AppError("Data invalida", 400, "INVALID_DATE");
  }
  return normalized;
}

function parseDateOnlyUtc(value: string): Date {
  const trimmed = normalizeDateRequired(value);
  const dt = new Date(`${trimmed}T00:00:00.000Z`);
  if (Number.isNaN(dt.getTime())) {
    throw new AppError("Data invalida", 400, "INVALID_DATE");
  }
  return dt;
}

function resolveProfissionalId(input: { profissionalId?: number | null }) {
  const id = input.profissionalId ?? null;
  if (!id) {
    throw new AppError("Profissional obrigatorio", 400, "INVALID_INPUT");
  }
  return Number(id);
}

type DbExecutor = typeof db;

async function acquireAtendimentoScheduleLock(executor: DbExecutor, params: {
  pacienteId: number;
  profissionalId: number;
  data: string;
  isGrupo: boolean;
}) {
  await executor.execute(
    sql`select pg_advisory_xact_lock(${params.pacienteId}, hashtext(${`paciente:${params.data}`}))`
  );
  if (!params.isGrupo) {
    await executor.execute(
      sql`select pg_advisory_xact_lock(${params.profissionalId}, hashtext(${`profissional:${params.data}`}))`
    );
  }
}

async function existeConflitoHorario(executor: DbExecutor, params: {
  pacienteId: number;
  profissionalId: number;
  data: string;
  horaInicio: string;
  horaFim: string;
  isGrupo: boolean;
  ignoreId?: number | null;
}) {
  const wherePaciente = [
    eq(atendimentos.pacienteId, params.pacienteId),
    eq(atendimentos.data, params.data),
    isNull(atendimentos.deletedAt),
    // overlap: newEnd > start AND newStart < end
    sql`${params.horaFim}::time > ${atendimentos.horaInicio} AND ${params.horaInicio}::time < ${atendimentos.horaFim}`,
  ];
  if (params.ignoreId) {
    wherePaciente.push(sql`${atendimentos.id} <> ${params.ignoreId}`);
  }

  const [conflitoPaciente] = await executor
    .select({ id: atendimentos.id })
    .from(atendimentos)
    .where(and(...wherePaciente))
    .limit(1);
  if (conflitoPaciente) return "paciente" as const;

  if (params.isGrupo) return null;

  const whereProfissional = [
    eq(atendimentos.profissionalId, params.profissionalId),
    eq(atendimentos.data, params.data),
    isNull(atendimentos.deletedAt),
    sql`${params.horaFim}::time > ${atendimentos.horaInicio} AND ${params.horaInicio}::time < ${atendimentos.horaFim}`,
  ];
  if (params.ignoreId) {
    whereProfissional.push(sql`${atendimentos.id} <> ${params.ignoreId}`);
  }

  const [conflitoProfissional] = await executor
    .select({ id: atendimentos.id })
    .from(atendimentos)
    .where(and(...whereProfissional))
    .limit(1);
  if (conflitoProfissional) return "profissional" as const;

  return null;
}

async function salvarAtendimentoDb(
  executor: DbExecutor,
  input: SaveAtendimentoInput,
  id?: number | null
) {
  const profissionalId = resolveProfissionalId(input);
  const data = normalizeDateRequired(input.data);
  const horaInicio = normalizeTime(input.horaInicio);
  const horaFim = normalizeTime(input.horaFim);
  const isGrupo = Boolean(input.isGrupo);
  const turno = normalizeTurno(input.turno);
  const presenca = normalizePresenca(input.presenca);

  if (presenca === "Ausente" && !input.motivo?.trim()) {
    throw new AppError("Motivo e obrigatorio quando ausente", 400, "MOTIVO_REQUIRED");
  }

  await acquireAtendimentoScheduleLock(executor, {
    pacienteId: input.pacienteId,
    profissionalId,
    data,
    isGrupo,
  });

  const conflito = await existeConflitoHorario(executor, {
    pacienteId: input.pacienteId,
    profissionalId,
    data,
    horaInicio,
    horaFim,
    isGrupo,
    ignoreId: id ?? null,
  });
  if (conflito === "paciente") {
    throw new AppError("Conflito de horario para este paciente", 409, "SCHEDULE_CONFLICT");
  }
  if (conflito === "profissional") {
    throw new AppError("Conflito de horario para este profissional", 409, "SCHEDULE_CONFLICT");
  }

  const realizado = presenca === "Presente";

  if (id) {
    const [existing] = await executor
      .select({ id: atendimentos.id })
      .from(atendimentos)
      .where(and(eq(atendimentos.id, id), isNull(atendimentos.deletedAt)))
      .limit(1);
    if (!existing) {
      throw new AppError("Atendimento nao encontrado", 404, "NOT_FOUND");
    }

    const [updated] = await executor
      .update(atendimentos)
      .set({
        pacienteId: input.pacienteId,
        profissionalId,
        data,
        horaInicio,
        horaFim,
        isGrupo,
        turno,
        periodoInicio: input.periodoInicio ? normalizeDateRequired(input.periodoInicio) : null,
        periodoFim: input.periodoFim ? normalizeDateRequired(input.periodoFim) : null,
        presenca,
        realizado,
        motivo: input.motivo?.trim() || null,
        observacoes: input.observacoes?.trim() || null,
        updatedAt: sql`now()`,
      })
      .where(and(eq(atendimentos.id, id), isNull(atendimentos.deletedAt)))
      .returning({ id: atendimentos.id });
    if (!updated) {
      throw new AppError("Atendimento nao encontrado", 404, "NOT_FOUND");
    }
    return id;
  }

  const [saved] = await executor
    .insert(atendimentos)
    .values({
      pacienteId: input.pacienteId,
      profissionalId,
      data,
      horaInicio,
      horaFim,
      isGrupo,
      turno,
      periodoInicio: input.periodoInicio ? normalizeDateRequired(input.periodoInicio) : null,
      periodoFim: input.periodoFim ? normalizeDateRequired(input.periodoFim) : null,
      presenca,
      realizado,
      motivo: input.motivo?.trim() || null,
      observacoes: input.observacoes?.trim() || null,
    })
    .returning({ id: atendimentos.id });

  return saved.id;
}

export async function listarAtendimentos(filters: AtendimentosQueryInput) {
  const where = [isNull(atendimentos.deletedAt)];
  if (filters.pacienteId) where.push(eq(atendimentos.pacienteId, filters.pacienteId));
  const profissionalId = filters.profissionalId ?? null;
  if (profissionalId) where.push(eq(atendimentos.profissionalId, profissionalId));
  if (filters.dataIni) where.push(gte(atendimentos.data, filters.dataIni));
  if (filters.dataFim) where.push(lte(atendimentos.data, filters.dataFim));

  const rows = await db
    .select({
      id: atendimentos.id,
      pacienteId: atendimentos.pacienteId,
      profissionalId: atendimentos.profissionalId,
      data: atendimentos.data,
      horaInicio: atendimentos.horaInicio,
      horaFim: atendimentos.horaFim,
      isGrupo: atendimentos.isGrupo,
      turno: atendimentos.turno,
      periodoInicio: atendimentos.periodoInicio,
      periodoFim: atendimentos.periodoFim,
      presenca: atendimentos.presenca,
      realizado: atendimentos.realizado,
      statusRepasse: atendimentos.statusRepasse,
      resumoRepasse: atendimentos.resumoRepasse,
      motivo: atendimentos.motivo,
      observacoes: atendimentos.observacoes,
      createdAt: atendimentos.createdAt,
      updatedAt: atendimentos.updatedAt,
      pacienteNome: pacientes.nome,
      profissionalNome: profissionaisTabela.nome,
    })
    .from(atendimentos)
    .innerJoin(pacientes, and(eq(pacientes.id, atendimentos.pacienteId), isNull(pacientes.deletedAt)))
    .leftJoin(profissionaisTabela, eq(profissionaisTabela.id, atendimentos.profissionalId))
    .where(and(...where))
    .orderBy(desc(atendimentos.data), desc(atendimentos.horaInicio), desc(atendimentos.id));

  return rows.map((row) => ({
    id: row.id,
    pacienteId: row.pacienteId,
    profissionalId: row.profissionalId,
    pacienteNome: row.pacienteNome,
    profissionalNome: row.profissionalNome,
    data: row.data,
    horaInicio: row.horaInicio,
    horaFim: row.horaFim,
    isGrupo: row.isGrupo,
    turno: row.turno,
    periodoInicio: row.periodoInicio,
    periodoFim: row.periodoFim,
    presenca: row.presenca,
    realizado: row.realizado,
    statusRepasse: row.statusRepasse,
    resumoRepasse: row.resumoRepasse,
    motivo: row.motivo,
    observacoes: row.observacoes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));
}

export async function salvarAtendimento(input: SaveAtendimentoInput, id?: number | null) {
  return runDbTransaction(
    async (tx) => salvarAtendimentoDb(tx, input, id),
    { operation: "atendimentos.salvarAtendimento", mode: "required" }
  );
}

export async function softDeleteAtendimento(id: number, deletedByUserId?: number | null) {
  return runDbTransaction(
    async (tx) => {
      const [row] = await tx
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
    },
    { operation: "atendimentos.softDeleteAtendimento", mode: "required" }
  );
}

export async function criarRecorrentes(payload: RecorrenteInput) {
  const profissionalId = resolveProfissionalId(payload);
  const inicio = parseDateOnlyUtc(payload.periodoInicio);
  const fim = parseDateOnlyUtc(payload.periodoFim);
  if (inicio > fim) {
    throw new AppError("Data inicial maior que final", 400, "INVALID_PERIOD");
  }

  const dias = new Set(payload.diasSemana);
  return runDbTransaction(
    async (tx) => {
      const results: { id: number; data: string }[] = [];
      let total = 0;

      // Use UTC to avoid timezone-dependent getDay() behavior for date-only strings.
      for (let dt = new Date(inicio); dt <= fim; dt.setUTCDate(dt.getUTCDate() + 1)) {
        const dow = dt.getUTCDay(); // 0..6 (Sun..Sat) matches Postgres extract(dow)
        if (!dias.has(dow)) continue;
        total += 1;
        if (total > 400) {
          throw new AppError(
            "Intervalo muito grande. Limite de 400 atendimentos por lote.",
            400,
            "TOO_LARGE"
          );
        }
        const data = dt.toISOString().slice(0, 10);
        const id = await salvarAtendimentoDb(
          tx,
          {
            pacienteId: payload.pacienteId,
            profissionalId,
            data,
            horaInicio: payload.horaInicio,
            horaFim: payload.horaFim,
            isGrupo: payload.isGrupo,
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
    },
    { operation: "atendimentos.criarRecorrentes", mode: "required" }
  );
}

export async function excluirDia(payload: ExcluirDiaInput, deletedByUserId?: number | null) {
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
  const profissionalId = payload.profissionalId ?? null;
  if (profissionalId) where.push(eq(atendimentos.profissionalId, profissionalId));

  const removed = await runDbTransaction(
    async (tx) =>
      tx
        .update(atendimentos)
        .set({
          deletedAt: sql`now()`,
          deletedByUserId: deletedByUserId ?? null,
          updatedAt: sql`now()`,
        })
        .where(and(...where))
        .returning({ id: atendimentos.id }),
    { operation: "atendimentos.excluirDia", mode: "required" }
  );

  return { removidos: removed.length };
}
