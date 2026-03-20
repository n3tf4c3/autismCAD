import "server-only";

import { and, desc, eq, isNull, max, sql } from "drizzle-orm";
import { db } from "@/db";
import { getDocumentoTipoLabel } from "@/lib/prontuario/document-meta";
import { runDbTransaction } from "@/server/db/transaction";
import {
  atendimentos,
  evolucoes,
  prontuarioDocumentos,
  terapeutas as profissionaisTabela,
  users,
} from "@/server/db/schema";
import { canonicalRoleName } from "@/server/auth/permissions";
import { AppError } from "@/server/shared/errors";
import { isUniqueViolation } from "@/server/shared/pg-errors";
import { normalizeDateOnlyLoose } from "@/server/shared/normalize";
import { ymdNowInClinicTz } from "@/server/shared/clock";
import {
  AtualizarEvolucaoInput,
  CriarEvolucaoInput,
  DOC_STATUS,
  DOC_TYPES,
  SalvarDocumentoInput,
} from "@/server/modules/prontuario/prontuario.schema";
import { getPlanoEnsinoTitulo, sanitizePlanoEnsinoPayload } from "@/server/modules/prontuario/plano-ensino";
import { obterProfissionalPorUsuario } from "@/server/modules/profissionais/profissionais.service";
import { sanitizeEvolucaoPayload } from "@/lib/prontuario/evolucao-payload";

function toIsoDate(value: string): string {
  const normalized = normalizeDateOnlyLoose(value);
  if (!normalized) {
    throw new AppError("Data invalida", 400, "INVALID_INPUT");
  }
  return normalized;
}

const documentoSelectBase = {
  id: prontuarioDocumentos.id,
  pacienteId: prontuarioDocumentos.pacienteId,
  tipo: prontuarioDocumentos.tipo,
  version: prontuarioDocumentos.version,
  status: prontuarioDocumentos.status,
  titulo: prontuarioDocumentos.titulo,
  payload: prontuarioDocumentos.payload,
  createdByUserId: prontuarioDocumentos.createdByUserId,
  createdByRole: prontuarioDocumentos.createdByRole,
  createdAt: prontuarioDocumentos.createdAt,
  updatedAt: prontuarioDocumentos.updatedAt,
} as const;

async function obterProfissionalIdDoAtendimento(
  pacienteId: number,
  atendimentoId: number
): Promise<number | null> {
  const [row] = await db
    .select({ pacienteId: atendimentos.pacienteId, profissionalId: atendimentos.profissionalId })
    .from(atendimentos)
    .where(and(eq(atendimentos.id, atendimentoId), isNull(atendimentos.deletedAt)))
    .limit(1);

  if (!row) {
    throw new AppError("Atendimento nao encontrado", 404, "NOT_FOUND");
  }
  if (Number(row.pacienteId) !== Number(pacienteId)) {
    throw new AppError("Atendimento nao pertence ao paciente", 400, "INVALID_INPUT");
  }
  return row.profissionalId == null ? null : Number(row.profissionalId);
}

async function marcarRepasseConcluido(executor: typeof db, atendimentoId: number) {
  await executor
    .update(atendimentos)
    .set({ statusRepasse: "Concluido", updatedAt: sql`now()` })
    .where(and(eq(atendimentos.id, atendimentoId), isNull(atendimentos.deletedAt)));
}

async function sincronizarRepassePendenteSeSemEvolucao(
  executor: typeof db,
  atendimentoId: number,
  ignoreEvolucaoId?: number | null
) {
  const where = [eq(evolucoes.atendimentoId, atendimentoId), isNull(evolucoes.deletedAt)];
  if (ignoreEvolucaoId) where.push(sql`${evolucoes.id} <> ${ignoreEvolucaoId}`);

  const [active] = await executor
    .select({ id: evolucoes.id })
    .from(evolucoes)
    .where(and(...where))
    .limit(1);
  if (active) return;

  await executor
    .update(atendimentos)
    .set({ statusRepasse: "Pendente", updatedAt: sql`now()` })
    .where(and(eq(atendimentos.id, atendimentoId), isNull(atendimentos.deletedAt)));
}

export async function listarDocumentos(pacienteId: number, tipo?: string | null) {
  const where = [eq(prontuarioDocumentos.pacienteId, pacienteId), isNull(prontuarioDocumentos.deletedAt)];
  if (tipo) where.push(eq(prontuarioDocumentos.tipo, tipo));

  return db
    .select({
      ...documentoSelectBase,
      autorNome: users.nome,
    })
    .from(prontuarioDocumentos)
    .leftJoin(users, eq(users.id, prontuarioDocumentos.createdByUserId))
    .where(and(...where))
    .orderBy(desc(prontuarioDocumentos.version), desc(prontuarioDocumentos.createdAt));
}

export async function obterDocumento(id: number) {
  const [row] = await db
    .select({
      ...documentoSelectBase,
      autorNome: users.nome,
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

  let payload = input.payload ?? {};
  if (tipo === "PLANO_ENSINO") {
    payload = sanitizePlanoEnsinoPayload(payload);
  }

  const tituloInformado = (input.titulo ?? "").toString().trim();
  const titulo =
    tituloInformado ||
    (tipo === "PLANO_ENSINO"
      ? getPlanoEnsinoTitulo(payload as ReturnType<typeof sanitizePlanoEnsinoPayload>)
      : getDocumentoTipoLabel(tipo));

  const userId = user?.id ? Number(user.id) : null;
  const userRole = user?.role ?? null;

  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    try {
      const created = await runDbTransaction(
        async (tx) => {
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
        },
        { operation: "prontuario.salvarDocumento", mode: "required" }
      );

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
      pacienteId: evolucoes.pacienteId,
      profissionalId: evolucoes.profissionalId,
      atendimentoId: evolucoes.atendimentoId,
      atendimentoHoraInicio: atendimentos.horaInicio,
      atendimentoHoraFim: atendimentos.horaFim,
      data: evolucoes.data,
      payload: evolucoes.payload,
      createdAt: evolucoes.createdAt,
      profissionalNome: profissionaisTabela.nome,
    })
    .from(evolucoes)
    .leftJoin(profissionaisTabela, eq(profissionaisTabela.id, evolucoes.profissionalId))
    .leftJoin(atendimentos, eq(atendimentos.id, evolucoes.atendimentoId))
    .where(and(eq(evolucoes.pacienteId, pacienteId), isNull(evolucoes.deletedAt)))
    .orderBy(desc(evolucoes.data), desc(evolucoes.createdAt));

  return rows.map((row) => ({
    ...row,
    data: row.data ? String(row.data).slice(0, 10) : row.data,
    createdAt: row.createdAt ? String(row.createdAt) : row.createdAt,
  }));
}

export async function criarEvolucao(
  pacienteId: number,
  input: CriarEvolucaoInput,
  user?: { id: number | string; role?: string | null } | null
) {
  const dataVal = toIsoDate(input.data ?? ymdNowInClinicTz());
  const payload = sanitizeEvolucaoPayload(input.payload ?? {}).payload;

  const atendimentoRaw = input.atendimentoId ?? null;
  const atendimentoId = atendimentoRaw ? Number(atendimentoRaw) : null;

  const profissionalRaw = input.profissionalId ?? null;
  let profissionalId = profissionalRaw ? Number(profissionalRaw) : null;
  const roleCanon = canonicalRoleName(user?.role ?? null) ?? user?.role ?? null;
  if (roleCanon === "PROFISSIONAL") {
    const profissional = await obterProfissionalPorUsuario(Number(user?.id));
    if (!profissional) throw new AppError("Profissional nao encontrado", 403, "FORBIDDEN");
    profissionalId = profissional.id;
  } else if (!profissionalId && atendimentoId) {
    profissionalId = await obterProfissionalIdDoAtendimento(pacienteId, atendimentoId);
  }
  if (!profissionalId) {
    throw new AppError("Profissional obrigatorio para evolucao", 400, "INVALID_INPUT");
  }

  try {
    const saved = await runDbTransaction(
      async (tx) => {
        const [saved] = await tx
          .insert(evolucoes)
          .values({
            pacienteId,
            profissionalId,
            atendimentoId,
            data: dataVal,
            payload,
          })
          .returning({ id: evolucoes.id, data: evolucoes.data });

        if (atendimentoId) {
          await marcarRepasseConcluido(tx, atendimentoId);
        }

        return saved;
      },
      { operation: "prontuario.criarEvolucao", mode: "required" }
    );
    return { id: saved.id, data: String(saved.data).slice(0, 10) };
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError("Ja existe evolucao para este atendimento", 409, "CONFLICT");
    }
    throw error;
  }
}

export async function obterEvolucaoPorId(id: number) {
  const [row] = await db
    .select({
      id: evolucoes.id,
      pacienteId: evolucoes.pacienteId,
      profissionalId: evolucoes.profissionalId,
      atendimentoId: evolucoes.atendimentoId,
      data: evolucoes.data,
      payload: evolucoes.payload,
      createdAt: evolucoes.createdAt,
      profissionalNome: profissionaisTabela.nome,
    })
    .from(evolucoes)
    .leftJoin(profissionaisTabela, eq(profissionaisTabela.id, evolucoes.profissionalId))
    .where(and(eq(evolucoes.id, id), isNull(evolucoes.deletedAt)))
    .limit(1);

  if (!row) return null;
  return {
    ...row,
    data: row.data ? String(row.data).slice(0, 10) : row.data,
    createdAt: row.createdAt ? String(row.createdAt) : row.createdAt,
  };
}

export async function atualizarEvolucao(
  id: number,
  input: AtualizarEvolucaoInput,
  user?: { id: number | string; role?: string | null } | null,
  evolucaoAtual?: Awaited<ReturnType<typeof obterEvolucaoPorId>> | null
) {
  const current =
    evolucaoAtual ??
    (await obterEvolucaoPorId(id)) ??
    null;
  if (!current) throw new AppError("Evolucao nao encontrada", 404, "NOT_FOUND");

  const dataVal = toIsoDate(input.data ?? current.data ?? ymdNowInClinicTz());
  const payload = sanitizeEvolucaoPayload(input.payload ?? current.payload ?? {}).payload;

  const atendimentoRaw = input.atendimentoId ?? null;
  const atendimentoId = atendimentoRaw
    ? Number(atendimentoRaw)
    : (current.atendimentoId ?? null);

  const profissionalRaw = input.profissionalId ?? null;
  const profissionalExplicito = profissionalRaw != null;
  let profissionalId = profissionalRaw
    ? Number(profissionalRaw)
    : Number(current.profissionalId);
  const roleCanon = canonicalRoleName(user?.role ?? null) ?? user?.role ?? null;
  if (roleCanon === "PROFISSIONAL") {
    const profissional = await obterProfissionalPorUsuario(Number(user?.id));
    if (!profissional) throw new AppError("Profissional nao encontrado", 403, "FORBIDDEN");
    profissionalId = profissional.id;
  } else if (!profissionalExplicito && atendimentoRaw && atendimentoId) {
    const profissionalFromAtendimento = await obterProfissionalIdDoAtendimento(
      Number(current.pacienteId),
      atendimentoId
    );
    if (profissionalFromAtendimento) profissionalId = profissionalFromAtendimento;
  }
  if (!profissionalId) {
    throw new AppError("Profissional obrigatorio para evolucao", 400, "INVALID_INPUT");
  }

  const atendimentoAnteriorId = current.atendimentoId == null ? null : Number(current.atendimentoId);
  const atendimentoNovoId = atendimentoId == null ? null : Number(atendimentoId);

  try {
    await runDbTransaction(
      async (tx) => {
        const [updated] = await tx
          .update(evolucoes)
          .set({
            data: dataVal,
            payload,
            atendimentoId,
            profissionalId,
            updatedAt: sql`now()`,
          })
          .where(and(eq(evolucoes.id, id), isNull(evolucoes.deletedAt)))
          .returning({ id: evolucoes.id });
        if (!updated) throw new AppError("Evolucao nao encontrada", 404, "NOT_FOUND");

        if (atendimentoAnteriorId && atendimentoAnteriorId !== atendimentoNovoId) {
          await sincronizarRepassePendenteSeSemEvolucao(tx, atendimentoAnteriorId, id);
        }
        if (atendimentoNovoId) {
          await marcarRepasseConcluido(tx, atendimentoNovoId);
        }
      },
      { operation: "prontuario.atualizarEvolucao", mode: "required" }
    );
    return { id, data: dataVal };
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError("Ja existe evolucao para este atendimento", 409, "CONFLICT");
    }
    throw error;
  }
}

export async function excluirEvolucao(id: number, userId?: number | null) {
  const row = await runDbTransaction(
    async (tx) => {
      const [deleted] = await tx
        .update(evolucoes)
        .set({ deletedAt: sql`now()`, deletedByUserId: userId ?? null, updatedAt: sql`now()` })
        .where(and(eq(evolucoes.id, id), isNull(evolucoes.deletedAt)))
        .returning({ id: evolucoes.id, atendimentoId: evolucoes.atendimentoId });
      if (!deleted) return null;

      if (deleted.atendimentoId) {
        await sincronizarRepassePendenteSeSemEvolucao(tx, Number(deleted.atendimentoId), id);
      }

      return deleted;
    },
    { operation: "prontuario.excluirEvolucao", mode: "required" }
  );
  return !!row;
}

export async function finalizarDocumento(id: number) {
  const [row] = await db
    .update(prontuarioDocumentos)
    .set({ status: "Finalizado", updatedAt: sql`now()` })
    .where(and(eq(prontuarioDocumentos.id, id), isNull(prontuarioDocumentos.deletedAt)))
    .returning({
      id: prontuarioDocumentos.id,
      status: prontuarioDocumentos.status,
      updatedAt: prontuarioDocumentos.updatedAt,
    });
  return row ?? null;
}

export async function excluirDocumento(id: number, userId?: number | null) {
  const [row] = await db
    .update(prontuarioDocumentos)
    .set({ deletedAt: sql`now()`, deletedByUserId: userId ?? null, updatedAt: sql`now()` })
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
    data: d.createdAt ? String(d.createdAt) : "",
    profissional: d.autorNome || d.createdByRole || "Usuario",
  }));

  const mappedEvols = evols.map((e) => {
    const payload = (e.payload ?? {}) as Record<string, unknown>;
    const isComportamento = !!payload.comportamentos;
    const horaInicio = e.atendimentoHoraInicio ? String(e.atendimentoHoraInicio).slice(0, 5) : "";
    const horaFim = e.atendimentoHoraFim ? String(e.atendimentoHoraFim).slice(0, 5) : "";
    const horario = horaInicio && horaFim ? `${horaInicio} - ${horaFim}` : horaInicio || horaFim || null;
    return {
      kind: "evolucao" as const,
      id: e.id,
      tipo: isComportamento ? "COMPORTAMENTO" : "EVOLUCAO",
      titulo:
        (payload.titulo as string | undefined) ||
        (isComportamento ? "Registro de comportamento" : "Evolucao clinica"),
      status: "-",
      version: null as number | null,
      data: e.data || e.createdAt,
      profissional: e.profissionalNome || "Profissional",
      horario,
    };
  });

  const items = [...mappedDocs, ...mappedEvols];
  items.sort((a, b) => new Date(String(b.data)).getTime() - new Date(String(a.data)).getTime());
  return items;
}
