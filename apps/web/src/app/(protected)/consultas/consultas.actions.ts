"use server";

import { requirePermission } from "@/server/auth/auth";
import { assertPacienteAccess } from "@/server/auth/paciente-access";
import type { UserAccess } from "@/server/auth/access";
import { ADMIN_ROLES, hasPermissionKey } from "@/server/auth/permissions";
import {
  atendimentosQuerySchema,
  excluirDiaSchema,
  recorrenteSchema,
  saveAtendimentoSchema,
} from "@/server/modules/atendimentos/atendimentos.schema";
import {
  criarRecorrentes,
  excluirDia,
  getAtendimentoById,
  listarAtendimentosPorUsuario,
  salvarAtendimento,
  softDeleteAtendimento,
} from "@/server/modules/atendimentos/atendimentos.service";
import { AppError, toAppError } from "@/server/shared/errors";
import { buildConsultasActions } from "@/app/(protected)/consultas/consultas.actions.impl";

function hasConsultasEditPermission(access?: UserAccess) {
  if (!access) return false;
  const role = access.canonicalRole ?? access.role;
  if (role && ADMIN_ROLES.has(role)) return true;
  return hasPermissionKey(access.permissions, "consultas:edit");
}

const actions = buildConsultasActions({
  requirePermission,
  assertPacienteAccess,
  hasConsultasEditPermission,
  atendimentosQuerySchema,
  excluirDiaSchema,
  recorrenteSchema,
  saveAtendimentoSchema,
  criarRecorrentes,
  excluirDia,
  listarAtendimentosPorUsuario,
  salvarAtendimento,
  getAtendimentoById,
  softDeleteAtendimento,
  AppError,
  toAppError,
});

export const listarAtendimentosAction = actions.listarAtendimentosAction;
export const salvarAtendimentoAction = actions.salvarAtendimentoAction;
export const criarAtendimentoAction = actions.criarAtendimentoAction;
export const criarAtendimentosRecorrentesAction = actions.criarAtendimentosRecorrentesAction;
export const excluirAtendimentoAction = actions.excluirAtendimentoAction;
export const excluirDiaAtendimentosAction = actions.excluirDiaAtendimentosAction;
