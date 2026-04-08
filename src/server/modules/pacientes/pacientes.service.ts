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
import { atendimentos, pacienteTerapia, pacientes, terapias } from "@/server/db/schema";
import { runDbTransaction } from "@/server/db/transaction";
import {
  conveniosPermitidos,
  PacientesQueryInput,
  SavePacienteInput,
} from "@/server/modules/pacientes/pacientes.schema";
import { loadUserAccess } from "@/server/auth/access";
import { ADMIN_ROLES } from "@/server/auth/permissions";
import { AppError } from "@/server/shared/errors";
import {
  escapeLikePattern,
  normalizeCpf,
  normalizeDateOnlyLoose,
  normalizeOptionalText,
} from "@/server/shared/normalize";
import { obterProfissionalPorUsuario } from "@/server/modules/profissionais/profissionais.service";
import { getPacientesVinculadosByUserId } from "@/server/modules/pacientes/paciente-vinculos.service";

export type PacienteDetalhe = {
  id: number;
  nome: string;
  cpf: string;
  convenio: string;
  dataNascimento: string | null;
  dataInicio: string | null;
  email: string | null;
  telefone: string | null;
  telefone2: string | null;
  nomeResponsavel: string | null;
  nomeMae: string | null;
  nomePai: string | null;
  sexo: string | null;
  ativo: boolean | number | string | null;
  foto: string | null;
  laudo: string | null;
  documento: string | null;
  terapias: string[];
};

const terapiaCanonicalByNormalized = new Map<string, string>([
  ["convencional", "Convencional"],
  ["intensiva", "Intensiva"],
  ["especial", "Especial"],
  ["intercambio", "Intercambio"],
]);

function normalizeTextForMatch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function normalizeTerapias(input: SavePacienteInput): string[] {
  const fromTerapias = Array.isArray(input.terapias) ? input.terapias : [];
  const normalized: string[] = [];
  const seen = new Set<string>();
  for (const item of fromTerapias) {
    const trimmed = item.trim();
    if (!trimmed) continue;
    const canonical = terapiaCanonicalByNormalized.get(normalizeTextForMatch(trimmed)) ?? trimmed;
    const dedupeKey = normalizeTextForMatch(canonical);
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    normalized.push(canonical);
  }
  return normalized;
}

function normalizeAtivo(value: SavePacienteInput["ativo"]): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value > 0;

  const raw = value.trim().toLowerCase();
  if (["0", "false", "f", "nao", "off", "inativo", "arquivado"].includes(raw)) return false;
  if (["1", "true", "t", "sim", "on", "ativo"].includes(raw)) return true;

  const parsed = Number(raw);
  if (Number.isFinite(parsed)) return parsed > 0;

  throw new AppError("Valor invalido para ativo", 400, "INVALID_INPUT");
}

export async function listarPacientes(
  filters: PacientesQueryInput,
  allowedPacienteIds?: number[] | null
) {
  if (Array.isArray(allowedPacienteIds) && allowedPacienteIds.length === 0) {
    return [];
  }

  const where = [isNull(pacientes.deletedAt)];
  if (Array.isArray(allowedPacienteIds) && allowedPacienteIds.length > 0) {
    where.push(inArray(pacientes.id, allowedPacienteIds));
  }
  if (filters.id) where.push(eq(pacientes.id, filters.id));
  if (filters.nome) {
    const nomeFiltro = escapeLikePattern(filters.nome.trim());
    if (nomeFiltro) where.push(ilike(pacientes.nome, `%${nomeFiltro}%`));
  }
  if (filters.cpf) {
    const cpfFiltro = escapeLikePattern(filters.cpf.replace(/\D/g, ""));
    if (cpfFiltro) where.push(ilike(pacientes.cpf, `%${cpfFiltro}%`));
  }

  const rows = await db
    .select({
      id: pacientes.id,
      nome: pacientes.nome,
      cpf: pacientes.cpf,
      dataNascimento: pacientes.dataNascimento,
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
    id: row.id,
    nome: row.nome,
    cpf: row.cpf,
    dataNascimento: row.dataNascimento,
    convenio: row.convenio,
    email: row.email,
    nomeResponsavel: row.nome_responsavel,
    telefone: row.telefone,
    telefone2: row.telefone2,
    nomeMae: row.nome_mae,
    nomePai: row.nome_pai,
    sexo: row.sexo,
    dataInicio: row.data_inicio,
    foto: row.foto,
    laudo: row.laudo,
    documento: row.documento,
    ativo: row.ativo,
    terapias: terapiasMap.get(row.id) ?? [],
  }));
}

export async function listarPacientesPorUsuario(userId: number, filters: PacientesQueryInput) {
  if (!Number.isFinite(userId) || userId <= 0) return [];

  const access = await loadUserAccess(userId);
  if (!access.exists) return [];
  const roleCanon = access.canonicalRole ?? access.role;

  if (roleCanon && (ADMIN_ROLES.has(roleCanon) || roleCanon === "RECEPCAO")) {
    return listarPacientes(filters);
  }

  if (roleCanon === "PROFISSIONAL") {
    const profissional = await obterProfissionalPorUsuario(userId);
    if (!profissional?.id) return [];
    const rows = await db
      .select({ pacienteId: atendimentos.pacienteId })
      .from(atendimentos)
      .where(
        and(
          eq(atendimentos.profissionalId, profissional.id),
          isNull(atendimentos.deletedAt)
        )
      )
      .groupBy(atendimentos.pacienteId);
    const allowedIds = rows
      .map((row) => Number(row.pacienteId))
      .filter((id) => Number.isFinite(id) && id > 0);
    return listarPacientes(filters, allowedIds);
  }

  if (roleCanon === "RESPONSAVEL") {
    const vinculados = await getPacientesVinculadosByUserId(userId);
    const allowedIds = vinculados
      .map((item) => Number(item.id))
      .filter((id) => Number.isFinite(id) && id > 0);
    return listarPacientes(filters, allowedIds);
  }

  return [];
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

export async function obterPacienteDetalhe(id: number): Promise<PacienteDetalhe | null> {
  const [paciente] = await db
    .select({
      id: pacientes.id,
      nome: pacientes.nome,
      cpf: pacientes.cpf,
      convenio: pacientes.convenio,
      dataNascimento: pacientes.dataNascimento,
      dataInicio: pacientes.dataInicio,
      email: pacientes.email,
      telefone: pacientes.telefone,
      telefone2: pacientes.telefone2,
      nomeResponsavel: pacientes.nomeResponsavel,
      nomeMae: pacientes.nomeMae,
      nomePai: pacientes.nomePai,
      sexo: pacientes.sexo,
      ativo: pacientes.ativo,
      foto: pacientes.foto,
      laudo: pacientes.laudo,
      documento: pacientes.documento,
    })
    .from(pacientes)
    .where(and(eq(pacientes.id, id), isNull(pacientes.deletedAt)))
    .limit(1);

  if (!paciente) return null;

  const terapiaRows = await db
    .select({ nome: terapias.nome })
    .from(pacienteTerapia)
    .innerJoin(terapias, eq(terapias.id, pacienteTerapia.terapiaId))
    .where(eq(pacienteTerapia.pacienteId, paciente.id));

  return {
    ...paciente,
    terapias: terapiaRows
      .map((row) => row.nome)
      .filter(Boolean)
      .sort((a, b) => String(a).localeCompare(String(b))),
  };
}

export async function salvarPaciente(input: SavePacienteInput, id?: number | null) {
  const nome = input.nome.trim();
  const cpf = normalizeCpf(input.cpf);
  if (!nome || !cpf || cpf.length !== 11) {
    throw new AppError("Nome e CPF sao obrigatorios", 400, "INVALID_INPUT");
  }

  const convenioParsed = normalizeOptionalText(input.convenio) ?? "Particular";
  if (!conveniosPermitidos.has(convenioParsed)) {
    throw new AppError("Convenio invalido", 400, "INVALID_INPUT");
  }
  const convenio = convenioParsed;

  const ativo = normalizeAtivo(input.ativo);
  const terapiaNomes = normalizeTerapias(input);

  return runDbTransaction(
    async (tx) => {
      let pacienteId = id ?? null;

      if (pacienteId) {
        const [updated] = await tx
          .update(pacientes)
          .set({
            nome,
            cpf,
            dataNascimento: normalizeDateOnlyLoose(input.nascimento),
            convenio,
            email: normalizeOptionalText(input.email),
            nomeResponsavel: normalizeOptionalText(input.nomeResponsavel),
            telefone: normalizeOptionalText(input.telefone),
            telefone2: normalizeOptionalText(input.telefone2),
            nomeMae: normalizeOptionalText(input.nomeMae),
            nomePai: normalizeOptionalText(input.nomePai),
            sexo: normalizeOptionalText(input.sexo),
            dataInicio: normalizeDateOnlyLoose(input.dataInicio),
            foto: normalizeOptionalText(input.fotoAtual),
            laudo: normalizeOptionalText(input.laudoAtual),
            documento: normalizeOptionalText(input.documentoAtual),
            ativo,
            updatedAt: sql`now()`,
          })
          .where(and(eq(pacientes.id, pacienteId), isNull(pacientes.deletedAt)))
          .returning({ id: pacientes.id });

        if (!updated) {
          throw new AppError("Paciente nao encontrado", 404, "NOT_FOUND");
        }

        await tx
          .delete(pacienteTerapia)
          .where(eq(pacienteTerapia.pacienteId, pacienteId));
      } else {
        const [saved] = await tx
          .insert(pacientes)
          .values({
            nome,
            cpf,
            dataNascimento: normalizeDateOnlyLoose(input.nascimento),
            convenio,
            email: normalizeOptionalText(input.email),
            nomeResponsavel: normalizeOptionalText(input.nomeResponsavel),
            telefone: normalizeOptionalText(input.telefone),
            telefone2: normalizeOptionalText(input.telefone2),
            nomeMae: normalizeOptionalText(input.nomeMae),
            nomePai: normalizeOptionalText(input.nomePai),
            sexo: normalizeOptionalText(input.sexo),
            dataInicio: normalizeDateOnlyLoose(input.dataInicio),
            foto: normalizeOptionalText(input.fotoAtual),
            laudo: normalizeOptionalText(input.laudoAtual),
            documento: normalizeOptionalText(input.documentoAtual),
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
    },
    { operation: "pacientes.salvarPaciente", mode: "required" }
  );
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

  return runDbTransaction(
    async (tx) => {
      const [result] = await tx
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
    },
    { operation: "pacientes.softDeletePaciente", mode: "required" }
  );
}

export async function setPacienteAtivo(id: number, ativo: boolean) {
  return runDbTransaction(
    async (tx) => {
      const [result] = await tx
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
    },
    { operation: "pacientes.setPacienteAtivo", mode: "required" }
  );
}
