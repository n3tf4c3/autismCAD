import "server-only";
import { and, asc, eq, ilike, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { atendimentos, terapeutas as profissionaisTabela } from "@/server/db/schema";
import { runDbTransaction } from "@/server/db/transaction";
import {
  especialidadesPermitidas,
  SaveProfissionalInput,
  ProfissionaisQueryInput,
} from "@/server/modules/profissionais/profissionais.schema";
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

function composeEndereco(input: SaveProfissionalInput): string | null {
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

export async function listarProfissionais(filters: ProfissionaisQueryInput) {
  const where = [isNull(profissionaisTabela.deletedAt)];
  if (filters.id) where.push(eq(profissionaisTabela.id, filters.id));
  if (filters.nome) {
    const nomeFiltro = escapeLikePattern(filters.nome.trim());
    if (nomeFiltro) where.push(ilike(profissionaisTabela.nome, `%${nomeFiltro}%`));
  }
  if (filters.cpf) {
    const cpfFiltro = escapeLikePattern(filters.cpf.replace(/\D/g, ""));
    if (cpfFiltro) where.push(ilike(profissionaisTabela.cpf, `%${cpfFiltro}%`));
  }
  if (filters.especialidade) {
    const especialidadeFiltro = escapeLikePattern(filters.especialidade.trim());
    if (especialidadeFiltro) {
      where.push(ilike(profissionaisTabela.especialidade, `%${especialidadeFiltro}%`));
    }
  }

  const rows = await db
    .select({
      id: profissionaisTabela.id,
      nome: profissionaisTabela.nome,
      cpf: profissionaisTabela.cpf,
      data_nascimento: profissionaisTabela.dataNascimento,
      email: profissionaisTabela.email,
      telefone: profissionaisTabela.telefone,
      endereco: profissionaisTabela.endereco,
      logradouro: profissionaisTabela.logradouro,
      numero: profissionaisTabela.numero,
      bairro: profissionaisTabela.bairro,
      cidade: profissionaisTabela.cidade,
      cep: profissionaisTabela.cep,
      especialidade: profissionaisTabela.especialidade,
      ativo: profissionaisTabela.ativo,
    })
    .from(profissionaisTabela)
    .where(and(...where))
    .orderBy(asc(profissionaisTabela.nome));

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

export async function obterProfissionalDetalhe(id: number) {
  const rows = await listarProfissionais({ id });
  return rows[0] ?? null;
}

export async function salvarProfissional(input: SaveProfissionalInput, id?: number | null) {
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
          .update(profissionaisTabela)
          .set(payload)
          .where(and(eq(profissionaisTabela.id, id), isNull(profissionaisTabela.deletedAt)))
          .returning({ id: profissionaisTabela.id });
        if (!updated) {
          throw new AppError("Profissional nao encontrado", 404, "NOT_FOUND");
        }
        return updated.id;
      }

      const [saved] = await tx
        .insert(profissionaisTabela)
        .values(payload)
        .returning({ id: profissionaisTabela.id });
      return saved.id;
    },
    { operation: "profissionais.salvarProfissional", mode: "required" }
  );
}

export async function obterProfissionalPorUsuario(userId: number) {
  if (!userId) return null;
  const [row] = await db
    .select({ id: profissionaisTabela.id, nome: profissionaisTabela.nome })
    .from(profissionaisTabela)
    .where(and(eq(profissionaisTabela.usuarioId, userId), isNull(profissionaisTabela.deletedAt)))
    .limit(1);
  return row ?? null;
}

export async function profissionalAtendePaciente(pacienteId: number, profissionalId: number) {
  if (!pacienteId || !profissionalId) return false;
  const [row] = await db
    .select({ one: atendimentos.id })
    .from(atendimentos)
    .where(
      and(
        eq(atendimentos.pacienteId, pacienteId),
        eq(atendimentos.profissionalId, profissionalId),
        isNull(atendimentos.deletedAt)
      )
    )
    .limit(1);
  return !!row;
}

export async function deleteProfissional(id: number, deletedByUserId?: number | null) {
  const [row] = await db
    .select({ id: profissionaisTabela.id, ativo: profissionaisTabela.ativo })
    .from(profissionaisTabela)
    .where(and(eq(profissionaisTabela.id, id), isNull(profissionaisTabela.deletedAt)))
    .limit(1);
  if (!row) {
    throw new AppError("Profissional nao encontrado", 404, "NOT_FOUND");
  }
  if (row.ativo) {
    throw new AppError(
      "Arquive o profissional antes de excluir",
      409,
      "PROFESSIONAL_MUST_BE_ARCHIVED_FIRST"
    );
  }

  const [deleted] = await runDbTransaction(
    async (tx) => {
      return tx
        .update(profissionaisTabela)
        .set({
          ativo: false,
          deletedAt: sql`now()`,
          deletedByUserId: deletedByUserId ?? null,
          updatedAt: sql`now()`,
        })
        .where(and(eq(profissionaisTabela.id, id), isNull(profissionaisTabela.deletedAt)))
        .returning({ id: profissionaisTabela.id });
    },
    { operation: "profissionais.deleteProfissional", mode: "required" }
  );

  if (!deleted) {
    throw new AppError("Profissional nao encontrado", 404, "NOT_FOUND");
  }

  return { id: deleted.id };
}

export async function setProfissionalAtivo(id: number, ativo: boolean) {
  return runDbTransaction(
    async (tx) => {
      const [result] = await tx
        .update(profissionaisTabela)
        .set({ ativo, updatedAt: sql`now()` })
        .where(and(eq(profissionaisTabela.id, id), isNull(profissionaisTabela.deletedAt)))
        .returning({ id: profissionaisTabela.id, ativo: profissionaisTabela.ativo });

      if (!result) {
        throw new AppError("Profissional nao encontrado", 404, "NOT_FOUND");
      }

      return result;
    },
    { operation: "profissionais.setProfissionalAtivo", mode: "required" }
  );
}

// Backward compatibility aliases.
export const listarTerapeutas = listarProfissionais;
export const obterTerapeutaDetalhe = obterProfissionalDetalhe;
export const salvarTerapeuta = salvarProfissional;
export const obterTerapeutaPorUsuario = obterProfissionalPorUsuario;
export const terapeutaAtendePaciente = profissionalAtendePaciente;
export const deleteTerapeuta = deleteProfissional;
export const setTerapeutaAtivo = setProfissionalAtivo;
