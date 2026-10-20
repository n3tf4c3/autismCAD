"use server";

import { requirePermission } from "@/server/auth/auth";
import { listarPacientesPorUsuario } from "@/server/modules/pacientes/pacientes.service";
import { pacientesQuerySchema } from "@autismcad/validators/pacientes/pacientes.schema";
import { toAppError } from "@/server/shared/errors";
import type { ActionResult } from "./prontuario.actions";

export async function buscarPacientesParaClonarPlanoAction(
  nome: string
): Promise<ActionResult<{ id: number; nome: string }[]>> {
  try {
    const { user } = await requirePermission("prontuario:create");
    await requirePermission("prontuario:view");
    const filters = pacientesQuerySchema.parse({ nome });
    const pacientes = await listarPacientesPorUsuario(user.id, filters);
    return { ok: true, data: pacientes.map(({ id, nome }) => ({ id, nome })) };
  } catch (error) {
    const err = toAppError(error);
    return { ok: false, error: err.message, code: err.code, status: err.status };
  }
}
