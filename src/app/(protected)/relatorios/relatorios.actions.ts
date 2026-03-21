"use server";

import { requirePermission } from "@/server/auth/auth";
import {
  assiduidadeQuerySchema,
  evolutivoQuerySchema,
  planoEnsinoQuerySchema,
} from "@/server/modules/relatorios/relatorios.schema";
import {
  consolidateAssiduidadeReport,
  consolidateEvolutivoReport,
  consolidatePlanoEnsinoReport,
} from "@/server/modules/relatorios/relatorios.service";
import { toAppError } from "@/server/shared/errors";

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

export async function gerarRelatorioEvolutivoAction(
  filters: unknown
): Promise<
  ActionResult<{ report: Awaited<ReturnType<typeof consolidateEvolutivoReport>> }>
> {
  try {
    const { user } = await requirePermission("relatorios_clinicos:view");
    const parsed = evolutivoQuerySchema.parse(filters ?? {});
    const report = await consolidateEvolutivoReport({ query: parsed, user });
    return { ok: true, data: { report } };
  } catch (error) {
    return actionErrorResult(error);
  }
}

export async function gerarRelatorioAssiduidadeAction(
  filters: unknown
): Promise<
  ActionResult<{ report: Awaited<ReturnType<typeof consolidateAssiduidadeReport>> }>
> {
  try {
    const { user } = await requirePermission("relatorios_admin:view");
    const parsed = assiduidadeQuerySchema.parse(filters ?? {});
    const report = await consolidateAssiduidadeReport({ query: parsed, user });
    return { ok: true, data: { report } };
  } catch (error) {
    return actionErrorResult(error);
  }
}

export async function gerarRelatorioPlanoEnsinoAction(
  filters: unknown
): Promise<
  ActionResult<{ report: Awaited<ReturnType<typeof consolidatePlanoEnsinoReport>> }>
> {
  try {
    const { user } = await requirePermission("relatorios_clinicos:view");
    const parsed = planoEnsinoQuerySchema.parse(filters ?? {});
    const report = await consolidatePlanoEnsinoReport({ query: parsed, user });
    return { ok: true, data: { report } };
  } catch (error) {
    return actionErrorResult(error);
  }
}
