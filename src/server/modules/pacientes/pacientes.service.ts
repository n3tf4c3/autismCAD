import "server-only";
import {
  and,
  asc,
  eq,
  ilike,
  inArray,
  isNull,
  sql,
} from "drizzle-orm";
import { db } from "@/db";
import { pacienteTerapia, pacientes, terapias } from "@/server/db/schema";
import { runDbTransaction } from "@/server/db/transaction";
import {
  conveniosPermitidos,
  PacientesQueryInput,
  SavePacienteInput,
} from "@/server/modules/pacientes/pacientes.schema";
import { AppError } from "@/server/shared/errors";

function normalizeCpf(value: string): string {
  return value.replace(/\D/g, "").slice(0, 11);
}

function normalizeOptional(value?: string | null): string | null {
  if (!value) return null;
  const parsed = value.trim();
  return parsed ? parsed : null;
}

function normalizeDate(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function normalizeTerapias(input: SavePacienteInput): string[] {
  const fromTerapias = Array.isArray(input.terapias) ? input.terapias : [];
  const fromTerapia = Array.isArray(input.terapia)
    ? input.terapia
    : input.terapia
      ? [input.terapia]
      : [];
  return Array.from(
    new Set(
      [...fromTerapias, ...fromTerapia]
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}

export async function listarPacientes(filters: PacientesQueryInput) {
  const where = [isNull(pacientes.deletedAt)];
  if (filters.id) where.push(eq(pacientes.id, filters.id));
  if (filters.nome) where.push(ilike(pacientes.nome, `%${filters.nome}%`));
  if (filters.cpf) where.push(ilike(pacientes.cpf, `%${filters.cpf.replace(/\D/g, "")}%`));

  const rows = await db
    .select({
      id: pacientes.id,
      nome: pacientes.nome,
      cpf: pacientes.cpf,
      data_nascimento: pacientes.dataNascimento,
      convenio: pacientes.convenio,
      email: pacientes.email,
      nome_responsavel: pacientes.nomeResponsavel,
      telefone: pacientes.telefone,
      telefone2: pacientes.telefone2,
      nome_mae: pacientes.nomeMae,
      nome_pai: pacientes.nomePai,
      sexo: pacientes.sexo,
      data_inicio: pacientes.dataInicio,
      foto: pacientes.foto,
      laudo: pacientes.laudo,
      documento: pacientes.documento,
      ativo: pacientes.ativo,
    })
    .from(pacientes)
    .where(and(...where))
    .orderBy(asc(pacientes.nome));

  if (!rows.length) return [];

  const ids = rows.map((row) => row.id);
  const terapiaRows = await db
    .select({
      pacienteId: pacienteTerapia.pacienteId,
      nome: terapias.nome,
    })
    .from(pacienteTerapia)
    .innerJoin(terapias, eq(terapias.id, pacienteTerapia.terapiaId))
    .where(inArray(pacienteTerapia.pacienteId, ids));

  const terapiasMap = new Map<number, string[]>();
  for (const row of terapiaRows) {
    const current = terapiasMap.get(row.pacienteId) ?? [];
    current.push(row.nome);
    terapiasMap.set(row.pacienteId, current);
  }

  return rows.map((row) => ({
    ...row,
    nascimento: row.data_nascimento,
    nomeResponsavel: row.nome_responsavel,
    nomeMae: row.nome_mae,
    nomePai: row.nome_pai,
    dataInicio: row.data_inicio,
    ativo: row.ativo ? 1 : 0,
    terapias: terapiasMap.get(row.id) ?? [],
  }));
}

export async function findPacienteByCpfAtivo(cpf: string) {
  const normalizedCpf = normalizeCpf(cpf);
  if (!normalizedCpf) return null;
  const [row] = await db
    .select({ id: pacientes.id })
    .from(pacientes)
    .where(and(eq(pacientes.cpf, normalizedCpf), isNull(pacientes.deletedAt)))
    .limit(1);
  return row ?? null;
}

export async function salvarPaciente(input: SavePacienteInput, id?: number | null) {
  const nome = input.nome.trim();
  const cpf = normalizeCpf(input.cpf);
  if (!nome || !cpf || cpf.length !== 11) {
    throw new AppError("Nome e CPF sao obrigatorios", 400, "INVALID_INPUT");
  }

  const convenioParsed = normalizeOptional(input.convenio) ?? "Particular";
  const convenio = conveniosPermitidos.has(convenioParsed)
    ? convenioParsed
    : "Particular";

  const ativo =
    String(input.ativo ?? "1") === "0" || input.ativo === false ? false : true;
  const terapiaNomes = normalizeTerapias(input);

  return runDbTransaction(async (tx) => {
    let pacienteId = id ?? null;

    if (pacienteId) {
      await tx
        .update(pacientes)
        .set({
          nome,
          cpf,
          dataNascimento: normalizeDate(input.nascimento),
          convenio,
          email: normalizeOptional(input.email),
          nomeResponsavel: normalizeOptional(input.nomeResponsavel),
          telefone: normalizeOptional(input.telefone),
          telefone2: normalizeOptional(input.telefone2),
          nomeMae: normalizeOptional(input.nomeMae),
          nomePai: normalizeOptional(input.nomePai),
          sexo: normalizeOptional(input.sexo),
          dataInicio: normalizeDate(input.dataInicio),
          foto: normalizeOptional(input.fotoAtual),
          laudo: normalizeOptional(input.laudoAtual),
          documento: normalizeOptional(input.documentoAtual),
          ativo,
          deletedAt: null,
          deletedByUserId: null,
          updatedAt: sql`now()`,
        })
        .where(eq(pacientes.id, pacienteId));

      await tx
        .delete(pacienteTerapia)
        .where(eq(pacienteTerapia.pacienteId, pacienteId));
    } else {
      const [saved] = await tx
        .insert(pacientes)
        .values({
          nome,
          cpf,
          dataNascimento: normalizeDate(input.nascimento),
          convenio,
          email: normalizeOptional(input.email),
          nomeResponsavel: normalizeOptional(input.nomeResponsavel),
          telefone: normalizeOptional(input.telefone),
          telefone2: normalizeOptional(input.telefone2),
          nomeMae: normalizeOptional(input.nomeMae),
          nomePai: normalizeOptional(input.nomePai),
          sexo: normalizeOptional(input.sexo),
          dataInicio: normalizeDate(input.dataInicio),
          foto: normalizeOptional(input.fotoAtual),
          laudo: normalizeOptional(input.laudoAtual),
          documento: normalizeOptional(input.documentoAtual),
          ativo,
        })
        .returning({ id: pacientes.id });
      pacienteId = saved.id;
    }

    if (terapiaNomes.length) {
      await tx
        .insert(terapias)
        .values(terapiaNomes.map((nomeTerapia) => ({ nome: nomeTerapia })))
        .onConflictDoNothing();

      const terapiaRows = await tx
        .select({ id: terapias.id })
        .from(terapias)
        .where(inArray(terapias.nome, terapiaNomes));

      if (terapiaRows.length) {
        await tx
          .insert(pacienteTerapia)
          .values(
            terapiaRows.map((item) => ({
              pacienteId: pacienteId!,
              terapiaId: item.id,
            }))
          )
          .onConflictDoNothing();
      }
    }

    return pacienteId!;
  });
}

export async function softDeletePaciente(id: number, deletedByUserId?: number | null) {
  const [existing] = await db
    .select({ id: pacientes.id, ativo: pacientes.ativo })
    .from(pacientes)
    .where(and(eq(pacientes.id, id), isNull(pacientes.deletedAt)))
    .limit(1);

  if (!existing) {
    throw new AppError("Paciente nao encontrado", 404, "NOT_FOUND");
  }

  if (existing.ativo) {
    throw new AppError(
      "Arquive o paciente antes de excluir",
      409,
      "PATIENT_MUST_BE_ARCHIVED_FIRST"
    );
  }

  const [result] = await db
    .update(pacientes)
    .set({
      ativo: false,
      deletedAt: sql`now()`,
      deletedByUserId: deletedByUserId ?? null,
      updatedAt: sql`now()`,
    })
    .where(and(eq(pacientes.id, id), isNull(pacientes.deletedAt)))
    .returning({ id: pacientes.id });

  if (!result) throw new AppError("Paciente nao encontrado", 404, "NOT_FOUND");
  return result;
}

export async function setPacienteAtivo(id: number, ativo: boolean) {
  const [result] = await db
    .update(pacientes)
    .set({
      ativo,
      updatedAt: sql`now()`,
    })
    .where(and(eq(pacientes.id, id), isNull(pacientes.deletedAt)))
    .returning({ id: pacientes.id, ativo: pacientes.ativo });

  if (!result) {
    throw new AppError("Paciente nao encontrado", 404, "NOT_FOUND");
  }
  return result;
}
