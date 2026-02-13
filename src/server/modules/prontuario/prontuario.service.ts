import "server-only";

import { and, desc, eq, isNull, max, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  evolucoes,
  prontuarioDocumentos,
  terapeutas,
  users,
} from "@/server/db/schema";
import { canonicalRoleName } from "@/server/auth/permissions";
import { AppError } from "@/server/shared/errors";
import {
  AtualizarEvolucaoInput,
  CriarEvolucaoInput,
  DOC_STATUS,
  DOC_TYPES,
  SalvarDocumentoInput,
} from "@/server/modules/prontuario/prontuario.schema";
import { obterTerapeutaPorUsuario } from "@/server/modules/terapeutas/terapeutas.service";

function isUniqueViolation(error: unknown): boolean {
  const anyErr = error as { code?: string; message?: string };
  if (anyErr?.code === "23505") return true; // Postgres unique violation
  const msg = anyErr?.message ?? "";
  return msg.includes("duplicate key value violates unique constraint");
}

function toIsoDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new AppError("Data invalida", 400, "INVALID_INPUT");
  }
  return d.toISOString().slice(0, 10);
}

export async function listarDocumentos(pacienteId: number, tipo?: string | null) {
  const where = [eq(prontuarioDocumentos.pacienteId, pacienteId), isNull(prontuarioDocumentos.deletedAt)];
  if (tipo) where.push(eq(prontuarioDocumentos.tipo, tipo));

  return db
    .select({
      id: prontuarioDocumentos.id,
      paciente_id: prontuarioDocumentos.pacienteId,
      tipo: prontuarioDocumentos.tipo,
      version: prontuarioDocumentos.version,
      status: prontuarioDocumentos.status,
      titulo: prontuarioDocumentos.titulo,
      payload: prontuarioDocumentos.payload,
      created_by_user_id: prontuarioDocumentos.createdByUserId,
      created_by_role: prontuarioDocumentos.createdByRole,
      created_at: prontuarioDocumentos.createdAt,
      autor_nome: users.nome,
    })
    .from(prontuarioDocumentos)
    .leftJoin(users, eq(users.id, prontuarioDocumentos.createdByUserId))
    .where(and(...where))
    .orderBy(desc(prontuarioDocumentos.version), desc(prontuarioDocumentos.createdAt));
}

export async function obterDocumento(id: number) {
  const [row] = await db
    .select({
      id: prontuarioDocumentos.id,
      paciente_id: prontuarioDocumentos.pacienteId,
      tipo: prontuarioDocumentos.tipo,
      version: prontuarioDocumentos.version,
      status: prontuarioDocumentos.status,
      titulo: prontuarioDocumentos.titulo,
      payload: prontuarioDocumentos.payload,
      created_by_user_id: prontuarioDocumentos.createdByUserId,
      created_by_role: prontuarioDocumentos.createdByRole,
      created_at: prontuarioDocumentos.createdAt,
      autor_nome: users.nome,
    })
    .from(prontuarioDocumentos)
    .leftJoin(users, eq(users.id, prontuarioDocumentos.createdByUserId))
    .where(and(eq(prontuarioDocumentos.id, id), isNull(prontuarioDocumentos.deletedAt)))
    .limit(1);
  return row ?? null;
}

export async function salvarDocumento(
  pacienteId: number,
  input: SalvarDocumentoInput,
  user?: { id: number | string; role?: string | null } | null
) {
  const tipo = input.tipo.toUpperCase().trim();
  if (!DOC_TYPES.includes(tipo as (typeof DOC_TYPES)[number])) {
    throw new AppError("Tipo de documento invalido", 400, "INVALID_INPUT");
  }
  const statusVal = DOC_STATUS.includes((input.status ?? "Rascunho") as (typeof DOC_STATUS)[number])
    ? (input.status ?? "Rascunho")
    : "Rascunho";

  const titulo = (input.titulo ?? tipo).toString().trim() || tipo;
  const payload = input.payload ?? {};

  const userId = user?.id ? Number(user.id) : null;
  const userRole = user?.role ?? null;

  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    try {
      const created = await db.transaction(async (tx) => {
        const [row] = await tx
          .select({ ver: max(prontuarioDocumentos.version).as("ver") })
          .from(prontuarioDocumentos)
          .where(and(eq(prontuarioDocumentos.pacienteId, pacienteId), eq(prontuarioDocumentos.tipo, tipo)));

        const nextVersion = Number(row?.ver ?? 0) + 1;
        const [saved] = await tx
          .insert(prontuarioDocumentos)
          .values({
            pacienteId,
            tipo,
            version: nextVersion,
            status: statusVal,
            titulo,
            payload,
            createdByUserId: userId,
            createdByRole: userRole,
          })
          .returning({ id: prontuarioDocumentos.id, version: prontuarioDocumentos.version });
        return saved;
      });

      return created;
    } catch (error) {
      if (isUniqueViolation(error) && attempt < maxRetries) continue;
      throw error;
    }
  }
  throw new AppError("Falha ao salvar documento", 500, "INTERNAL");
}

export async function listarEvolucoesPorPaciente(pacienteId: number) {
  const rows = await db
    .select({
      id: evolucoes.id,
      paciente_id: evolucoes.pacienteId,
      terapeuta_id: evolucoes.terapeutaId,
      atendimento_id: evolucoes.atendimentoId,
      data: evolucoes.data,
      payload: evolucoes.payload,
      created_at: evolucoes.createdAt,
      terapeuta_nome: terapeutas.nome,
    })
    .from(evolucoes)
    .leftJoin(terapeutas, eq(terapeutas.id, evolucoes.terapeutaId))
    .where(and(eq(evolucoes.pacienteId, pacienteId), isNull(evolucoes.deletedAt)))
    .orderBy(desc(evolucoes.data), desc(evolucoes.createdAt));

  return rows.map((row) => ({
    ...row,
    data: row.data ? String(row.data).slice(0, 10) : row.data,
    created_at: row.created_at ? String(row.created_at) : row.created_at,
  }));
}

export async function criarEvolucao(
  pacienteId: number,
  input: CriarEvolucaoInput,
  user?: { id: number | string; role?: string | null } | null
) {
  const dataVal = toIsoDate(input.data ?? new Date().toISOString().slice(0, 10));
  const payload = input.payload ?? {};

  let terapeutaId = input.terapeutaId ? Number(input.terapeutaId) : null;
  const roleCanon = canonicalRoleName(user?.role ?? null) ?? user?.role ?? null;
  if (roleCanon === "TERAPEUTA") {
    const terapeuta = await obterTerapeutaPorUsuario(Number(user?.id));
    if (!terapeuta) throw new AppError("Terapeuta nao encontrado", 403, "FORBIDDEN");
    terapeutaId = terapeuta.id;
  }
  if (!terapeutaId) {
    throw new AppError("Terapeuta obrigatorio para evolucao", 400, "INVALID_INPUT");
  }

  const atendimentoId = input.atendimentoId ? Number(input.atendimentoId) : null;

  try {
    const [saved] = await db
      .insert(evolucoes)
      .values({
        pacienteId,
        terapeutaId,
        atendimentoId,
        data: dataVal,
        payload,
      })
      .returning({ id: evolucoes.id, data: evolucoes.data });
    return { id: saved.id, data: String(saved.data).slice(0, 10) };
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError("Ja existe evolucao para este dia/terapeuta", 409, "CONFLICT");
    }
    throw error;
  }
}

export async function obterEvolucaoPorId(id: number) {
  const [row] = await db
    .select({
      id: evolucoes.id,
      paciente_id: evolucoes.pacienteId,
      terapeuta_id: evolucoes.terapeutaId,
      atendimento_id: evolucoes.atendimentoId,
      data: evolucoes.data,
      payload: evolucoes.payload,
      created_at: evolucoes.createdAt,
      terapeuta_nome: terapeutas.nome,
    })
    .from(evolucoes)
    .leftJoin(terapeutas, eq(terapeutas.id, evolucoes.terapeutaId))
    .where(and(eq(evolucoes.id, id), isNull(evolucoes.deletedAt)))
    .limit(1);

  if (!row) return null;
  return {
    ...row,
    data: row.data ? String(row.data).slice(0, 10) : row.data,
    created_at: row.created_at ? String(row.created_at).slice(0, 10) : row.created_at,
  };
}

export async function atualizarEvolucao(
  id: number,
  input: AtualizarEvolucaoInput,
  user?: { id: number | string; role?: string | null } | null,
  evolucaoAtual?: { paciente_id: number; terapeuta_id: number; data: string } | null
) {
  const current =
    evolucaoAtual ??
    (await obterEvolucaoPorId(id)) ??
    null;
  if (!current) throw new AppError("Evolucao nao encontrada", 404, "NOT_FOUND");

  const dataVal = toIsoDate(input.data ?? current.data ?? new Date().toISOString().slice(0, 10));
  const payload = (input.payload ?? (current as { payload?: unknown }).payload ?? {}) as Record<
    string,
    unknown
  >;

  let terapeutaId = input.terapeutaId ? Number(input.terapeutaId) : Number(current.terapeuta_id);
  const roleCanon = canonicalRoleName(user?.role ?? null) ?? user?.role ?? null;
  if (roleCanon === "TERAPEUTA") {
    const terapeuta = await obterTerapeutaPorUsuario(Number(user?.id));
    if (!terapeuta) throw new AppError("Terapeuta nao encontrado", 403, "FORBIDDEN");
    terapeutaId = terapeuta.id;
  }
  if (!terapeutaId) {
    throw new AppError("Terapeuta obrigatorio para evolucao", 400, "INVALID_INPUT");
  }

  const atendimentoId = input.atendimentoId
    ? Number(input.atendimentoId)
    : ((current as { atendimento_id?: number | null }).atendimento_id ?? null);

  try {
    await db
      .update(evolucoes)
      .set({
        data: dataVal,
        payload,
        atendimentoId,
        terapeutaId,
        updatedAt: sql`now()`,
      })
      .where(eq(evolucoes.id, id));
    return { id, data: dataVal };
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError("Ja existe evolucao para este dia/terapeuta", 409, "CONFLICT");
    }
    throw error;
  }
}

export async function excluirEvolucao(id: number, userId?: number | null) {
  const [row] = await db
    .update(evolucoes)
    .set({ deletedAt: sql`now()`, deletedByUserId: userId ?? null, updatedAt: sql`now()` })
    .where(and(eq(evolucoes.id, id), isNull(evolucoes.deletedAt)))
    .returning({ id: evolucoes.id });
  return !!row;
}

export async function finalizarDocumento(id: number) {
  const [row] = await db
    .update(prontuarioDocumentos)
    .set({ status: "Finalizado" })
    .where(and(eq(prontuarioDocumentos.id, id), isNull(prontuarioDocumentos.deletedAt)))
    .returning({ id: prontuarioDocumentos.id, status: prontuarioDocumentos.status });
  return row ?? null;
}

export async function excluirDocumento(id: number, userId?: number | null) {
  const [row] = await db
    .update(prontuarioDocumentos)
    .set({ deletedAt: sql`now()`, deletedByUserId: userId ?? null })
    .where(and(eq(prontuarioDocumentos.id, id), isNull(prontuarioDocumentos.deletedAt)))
    .returning({ id: prontuarioDocumentos.id });
  return !!row;
}

export async function obterTimelineProntuario(pacienteId: number) {
  const [docs, evols] = await Promise.all([
    listarDocumentos(pacienteId),
    listarEvolucoesPorPaciente(pacienteId),
  ]);

  const mappedDocs = docs.map((d) => ({
    kind: "documento" as const,
    id: d.id,
    tipo: d.tipo,
    titulo: d.titulo || d.tipo,
    status: d.status,
    version: d.version,
    data: d.created_at ? String(d.created_at) : "",
    profissional: d.autor_nome || d.created_by_role || "Usuario",
  }));

  const mappedEvols = evols.map((e) => {
    const payload = (e.payload ?? {}) as Record<string, unknown>;
    const isComportamento = !!payload.comportamentos;
    return {
      kind: "evolucao" as const,
      id: e.id,
      tipo: isComportamento ? "COMPORTAMENTO" : "EVOLUCAO",
      titulo:
        (payload.titulo as string | undefined) ||
        (isComportamento ? "Registro de comportamento" : "Evolucao clinica"),
      status: "-",
      version: null as number | null,
      data: e.data || e.created_at,
      profissional: e.terapeuta_nome || "Terapeuta",
    };
  });

  const items = [...mappedDocs, ...mappedEvols];
  items.sort((a, b) => new Date(String(b.data)).getTime() - new Date(String(a.data)).getTime());
  return items;
}
