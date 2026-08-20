"use server";

import { requirePermission } from "@/server/auth/auth";
import { assertPacienteAccess } from "@/server/auth/paciente-access";
import type { UserAccess } from "@/server/auth/access";
import { ADMIN_ROLES } from "@/server/auth/permissions";
import {
  atendimentosQuerySchema,
  excluirDiaSchema,
  recorrenteSchema,
  saveAtendimentoSchema,
} from "@autismcad/validators/atendimentos/atendimentos.schema";
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

function isAdminAccess(access?: UserAccess) {
  if (!access) return false;
  const role = access.canonicalRole ?? access.role;
  return Boolean(role && ADMIN_ROLES.has(role));
}

const actions = buildConsultasActions({
  requirePermission,
  assertPacienteAccess,
  isAdminAccess,
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
