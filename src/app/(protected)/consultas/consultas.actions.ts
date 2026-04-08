"use server";

import { requirePermission } from "@/server/auth/auth";
import { assertPacienteAccess } from "@/server/auth/paciente-access";
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

const actions = buildConsultasActions({
  requirePermission,
  assertPacienteAccess,
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
