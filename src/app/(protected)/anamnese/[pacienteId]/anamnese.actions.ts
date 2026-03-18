"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/server/auth/auth";
import { assertPacienteAccess } from "@/server/auth/paciente-access";
import {
  listVersionsQuerySchema,
  saveAnamneseSchema,
} from "@/server/modules/anamnese/anamnese.schema";
import {
  assertPacienteExists,
  excluirAnamneseCompleta,
  excluirAnamneseVersao,
  listarAnamneseVersoes,
  obterAnamneseBase,
  obterAnamneseVersao,
  salvarAnamneseCompleta,
} from "@/server/modules/anamnese/anamnese.service";
import { AppError, toAppError } from "@/server/shared/errors";

type ActionError = {
  ok: false;
  error: string;
  code: string;
  status: number;
};

type ActionOk<T> = {
  ok: true;
  data: T;
};

export type ActionResult<T> = ActionOk<T> | ActionError;

function actionErrorResult(error: unknown): ActionError {
  const appError = toAppError(error);
  return {
    ok: false,
    error: appError.message,
    code: appError.code,
    status: appError.status,
  };
}

function parsePacienteId(value: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0 || !Number.isInteger(parsed)) {
    throw new AppError("Paciente invalido", 400, "INVALID_PACIENTE");
  }
  return parsed;
}

function parseVersion(value: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0 || !Number.isInteger(parsed)) {
    throw new AppError("Versao invalida", 400, "INVALID_VERSION");
  }
  return parsed;
}

export async function carregarAnamneseAction(
  pacienteId: number,
  limit?: number
): Promise<
  ActionResult<{
    anamnese: Awaited<ReturnType<typeof obterAnamneseVersao>> | Awaited<ReturnType<typeof obterAnamneseBase>>;
    versions: Awaited<ReturnType<typeof listarAnamneseVersoes>>;
  }>
> {
  try {
    const id = parsePacienteId(pacienteId);
    const { user } = await requirePermission("pacientes:view");
    await assertPacienteAccess(user, id);
    await assertPacienteExists(id);

    const parsedQuery = listVersionsQuerySchema.parse({ limit });
    const [versao, versions] = await Promise.all([
      obterAnamneseVersao(id, null),
      listarAnamneseVersoes(id, parsedQuery.limit ?? 50),
    ]);

    if (versao) return { ok: true, data: { anamnese: versao, versions } };

    const base = await obterAnamneseBase(id);
    return { ok: true, data: { anamnese: base, versions } };
  } catch (error) {
    return actionErrorResult(error);
  }
}

export async function carregarAnamneseVersaoAction(
  pacienteId: number,
  version: number
): Promise<
  ActionResult<{
    anamnese: Awaited<ReturnType<typeof obterAnamneseVersao>> | Awaited<ReturnType<typeof obterAnamneseBase>>;
  }>
> {
  try {
    const id = parsePacienteId(pacienteId);
    const parsedVersion = parseVersion(version);
    const { user } = await requirePermission("pacientes:view");
    await assertPacienteAccess(user, id);

    const versao = await obterAnamneseVersao(id, parsedVersion);
    if (versao) return { ok: true, data: { anamnese: versao } };

    const base = await obterAnamneseBase(id);
    if (!base) throw new AppError("Anamnese nao encontrada", 404, "NOT_FOUND");
    return { ok: true, data: { anamnese: base } };
  } catch (error) {
    return actionErrorResult(error);
  }
}

export async function salvarAnamneseAction(
  pacienteId: number,
  input: unknown
): Promise<ActionResult<{ anamnese: Awaited<ReturnType<typeof salvarAnamneseCompleta>> }>> {
  try {
    const id = parsePacienteId(pacienteId);
    const { user } = await requirePermission("pacientes:edit");
    await assertPacienteAccess(user, id);

    const raw = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
    const parsed = saveAnamneseSchema.parse({ ...raw, pacienteId: id });
    const saved = await salvarAnamneseCompleta({
      pacienteId: id,
      body: parsed,
      status: parsed.status ?? "Rascunho",
    });

    revalidatePath(`/anamnese/${id}`);
    return { ok: true, data: { anamnese: saved } };
  } catch (error) {
    return actionErrorResult(error);
  }
}

export async function excluirAnamneseAction(
  pacienteId: number
): Promise<ActionResult<Awaited<ReturnType<typeof excluirAnamneseCompleta>>>> {
  try {
    const id = parsePacienteId(pacienteId);
    const { user } = await requirePermission("pacientes:delete");
    await assertPacienteAccess(user, id);

    const deleted = await excluirAnamneseCompleta(id);
    revalidatePath(`/anamnese/${id}`);
    return { ok: true, data: deleted };
  } catch (error) {
    return actionErrorResult(error);
  }
}

export async function excluirAnamneseVersaoAction(
  pacienteId: number,
  version: number
): Promise<ActionResult<Awaited<ReturnType<typeof excluirAnamneseVersao>>>> {
  try {
    const id = parsePacienteId(pacienteId);
    const parsedVersion = parseVersion(version);
    const { user } = await requirePermission("pacientes:delete");
    await assertPacienteAccess(user, id);

    const deleted = await excluirAnamneseVersao(id, parsedVersion);
    revalidatePath(`/anamnese/${id}`);
    return { ok: true, data: deleted };
  } catch (error) {
    return actionErrorResult(error);
  }
}
