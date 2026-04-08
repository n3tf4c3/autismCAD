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
import {
  obterProfissionalPorUsuario,
  profissionalAtendePaciente,
} from "@/server/modules/profissionais/profissionais.service";
import { sanitizeEvolucaoPayload } from "@/lib/prontuario/evolucao-payload";

function toIsoDate(value: string): string {
  const normalized = normalizeDateOnlyLoose(value);
  if (!normalized) {
    throw new AppError("Data invalida", 400, "INVALID_INPUT");
  }
  return normalized;
}

function toTimelineSortTimestamp(value: unknown): number {
  const raw = String(value ?? "").trim();
  if (!raw) return 0;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const ts = Date.parse(`${raw}T12:00:00.000Z`);
    return Number.isNaN(ts) ? 0 : ts;
  }
  const ts = Date.parse(raw);
  return Number.isNaN(ts) ? 0 : ts;
}

function normalizeDocTipo(value?: string | null): string | null {
  const normalized = String(value ?? "").trim().toUpperCase();
  return normalized || null;
}

function toPositiveUserIdOrNull(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0 || !Number.isInteger(parsed)) {
    throw new AppError("Usuario invalido", 400, "INVALID_INPUT");
  }
  return parsed;
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

async function acquireProntuarioDocumentVersionLock(
  executor: typeof db,
  params: { pacienteId: number; tipo: string }
) {
  await executor.execute(
    sql`select pg_advisory_xact_lock(${params.pacienteId}, hashtext(${`prontuario-documento:${params.tipo}`}))`
  );
}

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

async function assertProfissionalPacienteValido(
  pacienteId: number,
  profissionalId: number,
  atendimentoId?: number | null
) {
  if (!Number.isFinite(profissionalId) || profissionalId <= 0) {
    throw new AppError("Profissional obrigatorio para evolucao", 400, "INVALID_INPUT");
  }

  if (atendimentoId) {
    const profissionalFromAtendimento = await obterProfissionalIdDoAtendimento(
      pacienteId,
      atendimentoId
    );
    if (!profissionalFromAtendimento || Number(profissionalFromAtendimento) !== Number(profissionalId)) {
      throw new AppError(
        "Profissional nao corresponde ao atendimento informado",
        400,
        "INVALID_INPUT"
      );
    }
    return;
  }

  const vinculado = await profissionalAtendePaciente(pacienteId, profissionalId);
  if (!vinculado) {
    throw new AppError("Profissional sem vinculo com o paciente", 403, "FORBIDDEN");
  }
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
  const normalizedTipo = normalizeDocTipo(tipo);
  if (normalizedTipo) where.push(eq(prontuarioDocumentos.tipo, normalizedTipo));

  return db
    .select({
      ...documentoSelectBase,
      autorNome: users.nome,
    })
    .from(prontuarioDocumentos)
    .leftJoin(users, eq(users.id, prontuarioDocumentos.createdByUserId))
    .where(and(...where))
    .orderBy(
      desc(prontuarioDocumentos.updatedAt),
      desc(prontuarioDocumentos.createdAt),
      desc(prontuarioDocumentos.version)
    );
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

  const userId = toPositiveUserIdOrNull(user?.id ?? null);
  const userRole = user?.role ?? null;
  const documentoId =
    tipo === "PLANO_ENSINO" && input.documentoId != null
      ? Number(input.documentoId)
      : null;

  if (documentoId && Number.isFinite(documentoId) && documentoId > 0) {
    const updated = await runDbTransaction(
      async (tx) => {
        const [row] = await tx
          .update(prontuarioDocumentos)
          .set({
            status: statusVal,
            titulo,
            payload,
            updatedAt: sql`now()`,
          })
          .where(
            and(
              eq(prontuarioDocumentos.id, documentoId),
              eq(prontuarioDocumentos.pacienteId, pacienteId),
              eq(prontuarioDocumentos.tipo, tipo),
              isNull(prontuarioDocumentos.deletedAt)
            )
          )
          .returning({ id: prontuarioDocumentos.id, version: prontuarioDocumentos.version });
        return row ?? null;
      },
      { operation: "prontuario.salvarDocumento", mode: "required" }
    );

    if (!updated) {
      throw new AppError("Plano de ensino nao encontrado", 404, "NOT_FOUND");
    }
    return updated;
  }

  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    try {
      const created = await runDbTransaction(
        async (tx) => {
          await acquireProntuarioDocumentVersionLock(tx, { pacienteId, tipo });

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
    const userId = toPositiveUserIdOrNull(user?.id ?? null);
    if (!userId) throw new AppError("Profissional nao encontrado", 403, "FORBIDDEN");
    const profissional = await obterProfissionalPorUsuario(userId);
    if (!profissional) throw new AppError("Profissional nao encontrado", 403, "FORBIDDEN");
    if (profissionalRaw != null && Number(profissionalRaw) !== Number(profissional.id)) {
      throw new AppError(
        "Nao e permitido atribuir evolucao a outro profissional",
        403,
        "FORBIDDEN"
      );
    }
    profissionalId = profissional.id;
  } else if (!profissionalId && atendimentoId) {
    profissionalId = await obterProfissionalIdDoAtendimento(pacienteId, atendimentoId);
  }
  if (!profissionalId) {
    throw new AppError("Profissional obrigatorio para evolucao", 400, "INVALID_INPUT");
  }
  await assertProfissionalPacienteValido(pacienteId, profissionalId, atendimentoId);

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
    const userId = toPositiveUserIdOrNull(user?.id ?? null);
    if (!userId) throw new AppError("Profissional nao encontrado", 403, "FORBIDDEN");
    const profissional = await obterProfissionalPorUsuario(userId);
    if (!profissional) throw new AppError("Profissional nao encontrado", 403, "FORBIDDEN");
    if (profissionalRaw != null && Number(profissionalRaw) !== Number(profissional.id)) {
      throw new AppError(
        "Nao e permitido atribuir evolucao a outro profissional",
        403,
        "FORBIDDEN"
      );
    }
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
  await assertProfissionalPacienteValido(Number(current.pacienteId), profissionalId, atendimentoId);

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
    data: d.updatedAt ? String(d.updatedAt) : d.createdAt ? String(d.createdAt) : "",
    profissional: d.autorNome || d.createdByRole || "Usuario",
    sortTs: toTimelineSortTimestamp(d.updatedAt ?? d.createdAt ?? ""),
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
      sortTs: toTimelineSortTimestamp(e.data || e.createdAt),
    };
  });

  const items = [...mappedDocs, ...mappedEvols];
  items.sort((a, b) => b.sortTs - a.sortTs);
  return items.map(({ sortTs, ...item }) => item);
}
