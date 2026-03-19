import "server-only";
import { and, asc, eq, ilike, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { atendimentos, terapeutas } from "@/server/db/schema";
import { runDbTransaction } from "@/server/db/transaction";
import {
  especialidadesPermitidas,
  SaveTerapeutaInput,
  TerapeutasQueryInput,
} from "@/server/modules/terapeutas/terapeutas.schema";
import { AppError } from "@/server/shared/errors";
import {
  escapeLikePattern,
  normalizeCpf,
  normalizeDateOnlyLoose,
  normalizeOptionalText,
} from "@/server/shared/normalize";

function normalizeCep(value?: string | null): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "").slice(0, 8);
  return digits || null;
}

function normalizeEspecialidade(value: string): string {
  const parsed = value.trim();
  if (especialidadesPermitidas.has(parsed)) return parsed;
  return parsed || "Nao informado";
}

function composeEndereco(input: SaveTerapeutaInput): string | null {
  const joined = [
    normalizeOptionalText(input.logradouro),
    normalizeOptionalText(input.numero),
    normalizeOptionalText(input.bairro),
    normalizeOptionalText(input.cidade),
  ]
    .filter(Boolean)
    .join(", ");
  return joined || normalizeOptionalText(input.endereco);
}

export async function listarTerapeutas(filters: TerapeutasQueryInput) {
  const where = [isNull(terapeutas.deletedAt)];
  if (filters.id) where.push(eq(terapeutas.id, filters.id));
  if (filters.nome) {
    const nomeFiltro = escapeLikePattern(filters.nome.trim());
    if (nomeFiltro) where.push(ilike(terapeutas.nome, `%${nomeFiltro}%`));
  }
  if (filters.cpf) {
    const cpfFiltro = escapeLikePattern(filters.cpf.replace(/\D/g, ""));
    if (cpfFiltro) where.push(ilike(terapeutas.cpf, `%${cpfFiltro}%`));
  }
  if (filters.especialidade) {
    const especialidadeFiltro = escapeLikePattern(filters.especialidade.trim());
    if (especialidadeFiltro) {
      where.push(ilike(terapeutas.especialidade, `%${especialidadeFiltro}%`));
    }
  }

  const rows = await db
    .select({
      id: terapeutas.id,
      nome: terapeutas.nome,
      cpf: terapeutas.cpf,
      data_nascimento: terapeutas.dataNascimento,
      email: terapeutas.email,
      telefone: terapeutas.telefone,
      endereco: terapeutas.endereco,
      logradouro: terapeutas.logradouro,
      numero: terapeutas.numero,
      bairro: terapeutas.bairro,
      cidade: terapeutas.cidade,
      cep: terapeutas.cep,
      especialidade: terapeutas.especialidade,
      ativo: terapeutas.ativo,
    })
    .from(terapeutas)
    .where(and(...where))
    .orderBy(asc(terapeutas.nome));

  return rows.map((row) => ({
    id: row.id,
    nome: row.nome,
    cpf: row.cpf,
    nascimento: row.data_nascimento,
    email: row.email,
    telefone: row.telefone,
    // Compatibilidade: alguns registros antigos ainda populam apenas `endereco`.
    logradouro: row.logradouro || row.endereco,
    numero: row.numero,
    bairro: row.bairro,
    cidade: row.cidade,
    cep: row.cep,
    especialidade: row.especialidade,
    ativo: row.ativo,
  }));
}

export async function obterTerapeutaDetalhe(id: number) {
  const rows = await listarTerapeutas({ id });
  return rows[0] ?? null;
}

export async function salvarTerapeuta(input: SaveTerapeutaInput, id?: number | null) {
  const nome = input.nome.trim();
  const cpf = normalizeCpf(input.cpf);
  if (!nome || !cpf || cpf.length !== 11) {
    throw new AppError("Nome, CPF e especialidade sao obrigatorios", 400, "INVALID_INPUT");
  }

  const payload = {
    nome,
    cpf,
    dataNascimento: normalizeDateOnlyLoose(input.nascimento),
    email: normalizeOptionalText(input.email),
    telefone: normalizeOptionalText(input.telefone),
    endereco: composeEndereco(input),
    logradouro: normalizeOptionalText(input.logradouro),
    numero: normalizeOptionalText(input.numero),
    bairro: normalizeOptionalText(input.bairro),
    cidade: normalizeOptionalText(input.cidade),
    cep: normalizeCep(input.cep),
    especialidade: normalizeEspecialidade(input.especialidade),
    updatedAt: sql`now()`,
  };

  return runDbTransaction(
    async (tx) => {
      if (id) {
        const [updated] = await tx
          .update(terapeutas)
          .set(payload)
          .where(and(eq(terapeutas.id, id), isNull(terapeutas.deletedAt)))
          .returning({ id: terapeutas.id });
        if (!updated) {
          throw new AppError("Terapeuta nao encontrado", 404, "NOT_FOUND");
        }
        return updated.id;
      }

      const [saved] = await tx
        .insert(terapeutas)
        .values(payload)
        .returning({ id: terapeutas.id });
      return saved.id;
    },
    { operation: "terapeutas.salvarTerapeuta", mode: "required" }
  );
}

export async function obterTerapeutaPorUsuario(userId: number) {
  if (!userId) return null;
  const [row] = await db
    .select({ id: terapeutas.id, nome: terapeutas.nome })
    .from(terapeutas)
    .where(and(eq(terapeutas.usuarioId, userId), isNull(terapeutas.deletedAt)))
    .limit(1);
  return row ?? null;
}

export async function terapeutaAtendePaciente(pacienteId: number, terapeutaId: number) {
  if (!pacienteId || !terapeutaId) return false;
  const [row] = await db
    .select({ one: atendimentos.id })
    .from(atendimentos)
    .where(
      and(
        eq(atendimentos.pacienteId, pacienteId),
        eq(atendimentos.terapeutaId, terapeutaId),
        isNull(atendimentos.deletedAt)
      )
    )
    .limit(1);
  return !!row;
}

export async function deleteTerapeuta(id: number, deletedByUserId?: number | null) {
  const [row] = await db
    .select({ id: terapeutas.id, ativo: terapeutas.ativo })
    .from(terapeutas)
    .where(and(eq(terapeutas.id, id), isNull(terapeutas.deletedAt)))
    .limit(1);
  if (!row) {
    throw new AppError("Terapeuta nao encontrado", 404, "NOT_FOUND");
  }
  if (row.ativo) {
    throw new AppError(
      "Arquive o terapeuta antes de excluir",
      409,
      "THERAPIST_MUST_BE_ARCHIVED_FIRST"
    );
  }

  const [deleted] = await runDbTransaction(
    async (tx) => {
      return tx
        .update(terapeutas)
        .set({
          ativo: false,
          deletedAt: sql`now()`,
          deletedByUserId: deletedByUserId ?? null,
          updatedAt: sql`now()`,
        })
        .where(and(eq(terapeutas.id, id), isNull(terapeutas.deletedAt)))
        .returning({ id: terapeutas.id });
    },
    { operation: "terapeutas.deleteTerapeuta", mode: "required" }
  );

  if (!deleted) {
    throw new AppError("Terapeuta nao encontrado", 404, "NOT_FOUND");
  }

  return { id: deleted.id };
}

export async function setTerapeutaAtivo(id: number, ativo: boolean) {
  return runDbTransaction(
    async (tx) => {
      const [result] = await tx
        .update(terapeutas)
        .set({ ativo, updatedAt: sql`now()` })
        .where(and(eq(terapeutas.id, id), isNull(terapeutas.deletedAt)))
        .returning({ id: terapeutas.id, ativo: terapeutas.ativo });

      if (!result) {
        throw new AppError("Terapeuta nao encontrado", 404, "NOT_FOUND");
      }

      return result;
    },
    { operation: "terapeutas.setTerapeutaAtivo", mode: "required" }
  );
}
