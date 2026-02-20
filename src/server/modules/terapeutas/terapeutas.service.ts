import "server-only";
import { and, asc, eq, ilike, isNull } from "drizzle-orm";
import { db } from "@/db";
import { atendimentos, evolucoes, terapeutas } from "@/server/db/schema";
import {
  especialidadesPermitidas,
  SaveTerapeutaInput,
  TerapeutasQueryInput,
} from "@/server/modules/terapeutas/terapeutas.schema";
import { AppError } from "@/server/shared/errors";

function normalizeCpf(value: string): string {
  return value.replace(/\D/g, "").slice(0, 11);
}

function normalizeCep(value?: string | null): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "").slice(0, 8);
  return digits || null;
}

function normalizeOptional(value?: string | null): string | null {
  if (!value) return null;
  const parsed = value.trim();
  return parsed ? parsed : null;
}

function normalizeDate(value?: string | null): string | null {
  if (!value) return null;
  const parsed = value.trim();
  if (!parsed) return null;
  const date = new Date(parsed);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function normalizeEspecialidade(value: string): string {
  const parsed = value.trim();
  if (especialidadesPermitidas.has(parsed)) return parsed;
  return parsed || "Nao informado";
}

function composeEndereco(input: SaveTerapeutaInput): string | null {
  const joined = [
    normalizeOptional(input.logradouro),
    normalizeOptional(input.numero),
    normalizeOptional(input.bairro),
    normalizeOptional(input.cidade),
  ]
    .filter(Boolean)
    .join(", ");
  return joined || normalizeOptional(input.endereco);
}

export async function listarTerapeutas(filters: TerapeutasQueryInput) {
  const where = [];
  if (filters.id) where.push(eq(terapeutas.id, filters.id));
  if (filters.nome) where.push(ilike(terapeutas.nome, `%${filters.nome}%`));
  if (filters.cpf) where.push(ilike(terapeutas.cpf, `%${filters.cpf.replace(/\D/g, "")}%`));
  if (filters.especialidade) {
    where.push(ilike(terapeutas.especialidade, `%${filters.especialidade}%`));
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
    })
    .from(terapeutas)
    .where(where.length ? and(...where) : undefined)
    .orderBy(asc(terapeutas.nome));

  return rows.map((row) => ({
    ...row,
    nascimento: row.data_nascimento,
    logradouro: row.logradouro || row.endereco,
  }));
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
    dataNascimento: normalizeDate(input.nascimento),
    email: normalizeOptional(input.email),
    telefone: normalizeOptional(input.telefone),
    endereco: composeEndereco(input),
    logradouro: normalizeOptional(input.logradouro),
    numero: normalizeOptional(input.numero),
    bairro: normalizeOptional(input.bairro),
    cidade: normalizeOptional(input.cidade),
    cep: normalizeCep(input.cep),
    especialidade: normalizeEspecialidade(input.especialidade),
    updatedAt: new Date(),
  };

  if (id) {
    await db.update(terapeutas).set(payload).where(eq(terapeutas.id, id));
    return id;
  }

  const [saved] = await db
    .insert(terapeutas)
    .values(payload)
    .returning({ id: terapeutas.id });
  return saved.id;
}

export async function obterTerapeutaPorUsuario(userId: number) {
  if (!userId) return null;
  const [row] = await db
    .select({ id: terapeutas.id, nome: terapeutas.nome })
    .from(terapeutas)
    .where(eq(terapeutas.usuarioId, userId))
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

export async function deleteTerapeuta(id: number) {
  const [row] = await db
    .select({ id: terapeutas.id })
    .from(terapeutas)
    .where(eq(terapeutas.id, id))
    .limit(1);
  if (!row) {
    throw new AppError("Terapeuta nao encontrado", 404, "NOT_FOUND");
  }

  const [hasEvolucao] = await db
    .select({ id: evolucoes.id })
    .from(evolucoes)
    .where(eq(evolucoes.terapeutaId, id))
    .limit(1);
  if (hasEvolucao) {
    throw new AppError(
      "Nao e possivel excluir terapeuta com evolucoes vinculadas",
      409,
      "THERAPIST_HAS_EVOLUCOES"
    );
  }

  await db.transaction(async (tx) => {
    await tx
      .update(atendimentos)
      .set({ terapeutaId: null, updatedAt: new Date() })
      .where(eq(atendimentos.terapeutaId, id));
    await tx.delete(terapeutas).where(eq(terapeutas.id, id));
  });

  return { id };
}
