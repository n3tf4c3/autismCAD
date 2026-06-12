import type { UserAccess } from "@/server/auth/access";

type SessionUserLike = {
  id: number | string;
  role?: string | null;
};

type RequirePermissionResult = {
  user: SessionUserLike;
  access?: UserAccess;
};

type ZodSchemaLike<T> = {
  parse: (input: unknown) => T;
};

type AppErrorLike = {
  message: string;
  status: number;
  code: string;
};

export type ActionError = {
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

export type PacienteAccessInfo = {
  profissionalId: number | null;
};

export type AtendimentoExistente = {
  id: number;
  pacienteId: number;
  profissionalId: number | null;
  data: string;
  horaInicio: string;
  horaFim: string;
  isGrupo: boolean;
  turno: string | null;
  periodoInicio: string | null;
  periodoFim: string | null;
};

export type ConsultasActionsDeps<
  TAtendimentosFilters = unknown,
  TAtendimentosRows = unknown,
  TRecorrenteInput extends { pacienteId: number; profissionalId?: number | null } = {
    pacienteId: number;
    profissionalId?: number | null;
  },
  TRecorrentesResult = unknown,
  TExcluirDiaInput extends { pacienteId: number; profissionalId?: number | null } = {
    pacienteId: number;
    profissionalId?: number | null;
  },
  TSaveAtendimentoInput extends { pacienteId: number; profissionalId?: number | null } = {
    pacienteId: number;
    profissionalId?: number | null;
  }
> = {
  requirePermission: (permissionKey: string | string[]) => Promise<RequirePermissionResult>;
  assertPacienteAccess: (
    user: SessionUserLike,
    pacienteId: number,
    access?: UserAccess
  ) => Promise<PacienteAccessInfo>;
  hasConsultasEditPermission: (access?: UserAccess) => boolean;
  atendimentosQuerySchema: ZodSchemaLike<TAtendimentosFilters>;
  excluirDiaSchema: ZodSchemaLike<TExcluirDiaInput>;
  recorrenteSchema: ZodSchemaLike<TRecorrenteInput>;
  saveAtendimentoSchema: ZodSchemaLike<TSaveAtendimentoInput>;
  criarRecorrentes: (input: TRecorrenteInput) => Promise<TRecorrentesResult>;
  excluirDia: (input: TExcluirDiaInput, deletedByUserId?: number | null) => Promise<{ removidos: number }>;
  listarAtendimentosPorUsuario: (userId: number, filters: TAtendimentosFilters) => Promise<TAtendimentosRows>;
  salvarAtendimento: (input: TSaveAtendimentoInput, id?: number | null) => Promise<number>;
  getAtendimentoById: (id: number) => Promise<AtendimentoExistente | null>;
  softDeleteAtendimento: (
    id: number,
    pacienteId: number,
    deletedByUserId?: number | null
  ) => Promise<{ id: number; pacienteId: number }>;
  AppError: new (message: string, status?: number, code?: string) => AppErrorLike;
  toAppError: (error: unknown) => AppErrorLike;
};

function assertNoLegacyAtendimentoFields(
  input: unknown,
  AppErrorCtor: ConsultasActionsDeps["AppError"]
) {
  if (!input || typeof input !== "object") return;
  const payload = input as Record<string, unknown>;
  if ("realizado" in payload) {
    throw new AppErrorCtor(
      "Campo legado nao suportado. Use apenas presenca; realizado e calculado no servidor.",
      400,
      "INVALID_INPUT"
    );
  }
}

function actionErrorResult(error: unknown, toAppError: ConsultasActionsDeps["toAppError"]): ActionError {
  const appError = toAppError(error);
  return {
    ok: false,
    error: appError.message,
    code: appError.code,
    status: appError.status,
  };
}

function assertProfissionalAtribuido(
  profissionalProprio: number | null,
  profissionalAtribuido: number | null | undefined,
  AppErrorCtor: ConsultasActionsDeps["AppError"]
) {
  if (profissionalProprio == null) return;
  if (Number(profissionalAtribuido) !== Number(profissionalProprio)) {
    throw new AppErrorCtor(
      "Nao e permitido atribuir atendimento a outro profissional",
      403,
      "FORBIDDEN"
    );
  }
}

export function buildConsultasActions<
  TAtendimentosFilters = unknown,
  TAtendimentosRows = unknown,
  TRecorrenteInput extends { pacienteId: number; profissionalId?: number | null } = {
    pacienteId: number;
    profissionalId?: number | null;
  },
  TRecorrentesResult = unknown,
  TExcluirDiaInput extends { pacienteId: number; profissionalId?: number | null } = {
    pacienteId: number;
    profissionalId?: number | null;
  },
  TSaveAtendimentoInput extends { pacienteId: number; profissionalId?: number | null } = {
    pacienteId: number;
    profissionalId?: number | null;
  }
>(
  deps: ConsultasActionsDeps<
    TAtendimentosFilters,
    TAtendimentosRows,
    TRecorrenteInput,
    TRecorrentesResult,
    TExcluirDiaInput,
    TSaveAtendimentoInput
  >
) {
  return {
    async listarAtendimentosAction(
      filters: unknown
    ): Promise<ActionResult<{ items: TAtendimentosRows }>> {
      try {
        const { user } = await deps.requirePermission("consultas:view");
        const parsed = deps.atendimentosQuerySchema.parse(filters ?? {});
        const rows = await deps.listarAtendimentosPorUsuario(Number(user.id), parsed);
        return { ok: true, data: { items: rows } };
      } catch (error) {
        return actionErrorResult(error, deps.toAppError);
      }
    },

    async salvarAtendimentoAction(
      atendimentoId: number,
      input: unknown
    ): Promise<ActionResult<{ id: number }>> {
      try {
        const { user, access } = await deps.requirePermission(["consultas:edit", "consultas:presence"]);
        const idNum = Number(atendimentoId);
        if (!Number.isFinite(idNum) || idNum <= 0) {
          throw new deps.AppError("Atendimento invalido", 400, "INVALID_INPUT");
        }
        assertNoLegacyAtendimentoFields(input, deps.AppError);
        const parsed = deps.saveAtendimentoSchema.parse(input);
        const atendimento = await deps.getAtendimentoById(idNum);
        if (!atendimento) {
          throw new deps.AppError("Atendimento nao encontrado", 404, "NOT_FOUND");
        }
        const acesso = await deps.assertPacienteAccess(user, atendimento.pacienteId, access);
        if (Number(atendimento.pacienteId) !== Number(parsed.pacienteId)) {
          throw new deps.AppError(
            "Atendimento nao pertence ao paciente informado",
            403,
            "FORBIDDEN"
          );
        }
        const profissionalProprio = acesso.profissionalId;
        if (
          profissionalProprio != null &&
          Number(atendimento.profissionalId) !== Number(profissionalProprio)
        ) {
          throw new deps.AppError(
            "Atendimento pertence a outro profissional",
            403,
            "FORBIDDEN"
          );
        }
        // Quem tem apenas consultas:presence altera presenca/motivo/observacoes;
        // os campos de agenda sao preservados do registro existente.
        const inputEfetivo = deps.hasConsultasEditPermission(access)
          ? parsed
          : ({
              ...parsed,
              pacienteId: atendimento.pacienteId,
              profissionalId: atendimento.profissionalId,
              data: atendimento.data,
              horaInicio: atendimento.horaInicio,
              horaFim: atendimento.horaFim,
              isGrupo: atendimento.isGrupo,
              turno: atendimento.turno ?? undefined,
              periodoInicio: atendimento.periodoInicio,
              periodoFim: atendimento.periodoFim,
            } as TSaveAtendimentoInput);
        assertProfissionalAtribuido(profissionalProprio, inputEfetivo.profissionalId, deps.AppError);
        const savedId = await deps.salvarAtendimento(inputEfetivo, idNum);
        return { ok: true, data: { id: savedId } };
      } catch (error) {
        return actionErrorResult(error, deps.toAppError);
      }
    },

    async criarAtendimentoAction(input: unknown): Promise<ActionResult<{ id: number }>> {
      try {
        const { user, access } = await deps.requirePermission("consultas:create");
        assertNoLegacyAtendimentoFields(input, deps.AppError);
        const parsed = deps.saveAtendimentoSchema.parse(input);
        const acesso = await deps.assertPacienteAccess(user, parsed.pacienteId, access);
        assertProfissionalAtribuido(acesso.profissionalId, parsed.profissionalId, deps.AppError);
        const savedId = await deps.salvarAtendimento(parsed, null);
        return { ok: true, data: { id: savedId } };
      } catch (error) {
        return actionErrorResult(error, deps.toAppError);
      }
    },

    async criarAtendimentosRecorrentesAction(
      input: unknown
    ): Promise<ActionResult<TRecorrentesResult>> {
      try {
        const { user, access } = await deps.requirePermission("consultas:create");
        const parsed = deps.recorrenteSchema.parse(input);
        const acesso = await deps.assertPacienteAccess(user, parsed.pacienteId, access);
        assertProfissionalAtribuido(acesso.profissionalId, parsed.profissionalId, deps.AppError);
        const result = await deps.criarRecorrentes(parsed);
        return { ok: true, data: result };
      } catch (error) {
        return actionErrorResult(error, deps.toAppError);
      }
    },

    async excluirAtendimentoAction(atendimentoId: number): Promise<ActionResult<{ id: number }>> {
      try {
        const idNum = Number(atendimentoId);
        if (!Number.isFinite(idNum) || idNum <= 0) {
          throw new deps.AppError("Atendimento invalido", 400, "INVALID_INPUT");
        }
        const { user, access } = await deps.requirePermission("consultas:cancel");
        const atendimento = await deps.getAtendimentoById(idNum);
        if (!atendimento) {
          throw new deps.AppError("Atendimento nao encontrado", 404, "NOT_FOUND");
        }
        await deps.assertPacienteAccess(user, atendimento.pacienteId, access);
        const result = await deps.softDeleteAtendimento(
          atendimento.id,
          atendimento.pacienteId,
          Number(user.id)
        );
        return { ok: true, data: { id: result.id } };
      } catch (error) {
        return actionErrorResult(error, deps.toAppError);
      }
    },

    async excluirDiaAtendimentosAction(input: unknown): Promise<ActionResult<{ removidos: number }>> {
      try {
        const { user, access } = await deps.requirePermission("consultas:cancel");
        const parsed = deps.excluirDiaSchema.parse(input);
        const acesso = await deps.assertPacienteAccess(user, parsed.pacienteId, access);
        // Achado 56: para papel efetivo PROFISSIONAL, forca o escopo da exclusao em lote
        // ao proprio profissional, impedindo remover atendimentos de outro profissional.
        const escopo =
          acesso.profissionalId != null
            ? ({ ...parsed, profissionalId: acesso.profissionalId } as TExcluirDiaInput)
            : parsed;
        const result = await deps.excluirDia(escopo, Number(user.id));
        return { ok: true, data: { removidos: result.removidos } };
      } catch (error) {
        return actionErrorResult(error, deps.toAppError);
      }
    },
  };
}
