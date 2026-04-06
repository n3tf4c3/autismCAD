type SessionUserLike = {
  id: number | string;
  role?: string | null;
};

type RequirePermissionResult = {
  user: SessionUserLike;
  access?: unknown;
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

export type ConsultasActionsDeps<
  TAtendimentosFilters = unknown,
  TAtendimentosRows = unknown,
  TRecorrenteInput extends { pacienteId: number } = { pacienteId: number },
  TRecorrentesResult = unknown,
  TExcluirDiaInput extends { pacienteId: number } = { pacienteId: number },
  TSaveAtendimentoInput extends { pacienteId: number } = { pacienteId: number }
> = {
  requirePermission: (permissionKey: string | string[]) => Promise<RequirePermissionResult>;
  assertPacienteAccess: (user: SessionUserLike, pacienteId: number) => Promise<unknown>;
  atendimentosQuerySchema: ZodSchemaLike<TAtendimentosFilters>;
  excluirDiaSchema: ZodSchemaLike<TExcluirDiaInput>;
  recorrenteSchema: ZodSchemaLike<TRecorrenteInput>;
  saveAtendimentoSchema: ZodSchemaLike<TSaveAtendimentoInput>;
  criarRecorrentes: (input: TRecorrenteInput) => Promise<TRecorrentesResult>;
  excluirDia: (input: TExcluirDiaInput, deletedByUserId?: number | null) => Promise<{ removidos: number }>;
  listarAtendimentosPorUsuario: (userId: number, filters: TAtendimentosFilters) => Promise<TAtendimentosRows>;
  salvarAtendimento: (input: TSaveAtendimentoInput, id?: number | null) => Promise<number>;
  softDeleteAtendimento: (id: number, deletedByUserId?: number | null) => Promise<{ id: number }>;
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

export function buildConsultasActions<
  TAtendimentosFilters = unknown,
  TAtendimentosRows = unknown,
  TRecorrenteInput extends { pacienteId: number } = { pacienteId: number },
  TRecorrentesResult = unknown,
  TExcluirDiaInput extends { pacienteId: number } = { pacienteId: number },
  TSaveAtendimentoInput extends { pacienteId: number } = { pacienteId: number }
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
        const { user } = await deps.requirePermission(["consultas:edit", "consultas:presence"]);
        const idNum = Number(atendimentoId);
        if (!Number.isFinite(idNum) || idNum <= 0) {
          throw new deps.AppError("Atendimento invalido", 400, "INVALID_INPUT");
        }
        assertNoLegacyAtendimentoFields(input, deps.AppError);
        const parsed = deps.saveAtendimentoSchema.parse(input);
        await deps.assertPacienteAccess(user, parsed.pacienteId);
        const savedId = await deps.salvarAtendimento(parsed, idNum);
        return { ok: true, data: { id: savedId } };
      } catch (error) {
        return actionErrorResult(error, deps.toAppError);
      }
    },

    async criarAtendimentoAction(input: unknown): Promise<ActionResult<{ id: number }>> {
      try {
        const { user } = await deps.requirePermission("consultas:create");
        assertNoLegacyAtendimentoFields(input, deps.AppError);
        const parsed = deps.saveAtendimentoSchema.parse(input);
        await deps.assertPacienteAccess(user, parsed.pacienteId);
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
        const { user } = await deps.requirePermission("consultas:create");
        const parsed = deps.recorrenteSchema.parse(input);
        await deps.assertPacienteAccess(user, parsed.pacienteId);
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
        const { user } = await deps.requirePermission("consultas:cancel");
        const result = await deps.softDeleteAtendimento(idNum, Number(user.id));
        return { ok: true, data: { id: result.id } };
      } catch (error) {
        return actionErrorResult(error, deps.toAppError);
      }
    },

    async excluirDiaAtendimentosAction(input: unknown): Promise<ActionResult<{ removidos: number }>> {
      try {
        const { user } = await deps.requirePermission("consultas:cancel");
        const parsed = deps.excluirDiaSchema.parse(input);
        await deps.assertPacienteAccess(user, parsed.pacienteId);
        const result = await deps.excluirDia(parsed, Number(user.id));
        return { ok: true, data: { removidos: result.removidos } };
      } catch (error) {
        return actionErrorResult(error, deps.toAppError);
      }
    },
  };
}
