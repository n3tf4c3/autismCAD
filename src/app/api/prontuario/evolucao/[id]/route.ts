import { ZodError } from "zod";
import { parseJsonBody } from "@/lib/zod/api";
import { requirePermission } from "@/server/auth/auth";
import { assertPacienteAccess } from "@/server/auth/paciente-access";
import { canonicalRoleName } from "@/server/auth/permissions";
import {
  atualizarEvolucao,
  criarEvolucao,
  excluirEvolucao,
  obterEvolucaoPorId,
} from "@/server/modules/prontuario/prontuario.service";
import {
  atualizarEvolucaoSchema,
  criarEvolucaoSchema,
} from "@/server/modules/prontuario/prontuario.schema";
import { toAppError } from "@/server/shared/errors";
import { jsonError } from "@/server/shared/http";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { user } = await requirePermission("evolucoes:view");
    const { id } = await context.params;
    const evoId = Number(id);
    if (!evoId) return Response.json({ error: "Evolucao invalida" }, { status: 400 });

    const evolucao = await obterEvolucaoPorId(evoId);
    if (!evolucao) return Response.json({ error: "Evolucao nao encontrada" }, { status: 404 });

    const access = await assertPacienteAccess(user, Number(evolucao.paciente_id));
    if ((canonicalRoleName(user.role) ?? user.role) === "TERAPEUTA") {
      if (!access.terapeutaId || access.terapeutaId !== Number(evolucao.terapeuta_id)) {
        return Response.json({ error: "Acesso negado" }, { status: 403 });
      }
    }

    return Response.json({ ...evolucao, payload: evolucao.payload ?? {} });
  } catch (error) {
    return jsonError(toAppError(error));
  }
}

// Compatibilidade com o legado: POST /api/prontuario/evolucao/:pacienteId
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { user } = await requirePermission("evolucoes:create");
    const { id } = await context.params;
    const pacienteId = Number(id);
    if (!pacienteId) return Response.json({ error: "Paciente invalido" }, { status: 400 });

    await assertPacienteAccess(user, pacienteId);
    const payload = await parseJsonBody(request, criarEvolucaoSchema);
    const saved = await criarEvolucao(pacienteId, payload, user);
    return Response.json(saved, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json({ error: "Payload invalido" }, { status: 400 });
    }
    return jsonError(toAppError(error));
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { user } = await requirePermission("evolucoes:edit");
    const { id } = await context.params;
    const evoId = Number(id);
    if (!evoId) return Response.json({ error: "Evolucao invalida" }, { status: 400 });

    const evolucaoAtual = await obterEvolucaoPorId(evoId);
    if (!evolucaoAtual) return Response.json({ error: "Evolucao nao encontrada" }, { status: 404 });

    const access = await assertPacienteAccess(user, Number(evolucaoAtual.paciente_id));
    if ((canonicalRoleName(user.role) ?? user.role) === "TERAPEUTA") {
      if (!access.terapeutaId || access.terapeutaId !== Number(evolucaoAtual.terapeuta_id)) {
        return Response.json({ error: "Acesso negado" }, { status: 403 });
      }
    }

    const payload = await parseJsonBody(request, atualizarEvolucaoSchema);
    const updated = await atualizarEvolucao(evoId, payload, user, evolucaoAtual);
    return Response.json(updated);
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json({ error: "Payload invalido" }, { status: 400 });
    }
    return jsonError(toAppError(error));
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { user } = await requirePermission("evolucoes:delete");
    const { id } = await context.params;
    const evoId = Number(id);
    if (!evoId) return Response.json({ error: "Evolucao invalida" }, { status: 400 });

    const evolucaoAtual = await obterEvolucaoPorId(evoId);
    if (!evolucaoAtual) return Response.json({ error: "Evolucao nao encontrada" }, { status: 404 });

    const access = await assertPacienteAccess(user, Number(evolucaoAtual.paciente_id));
    if ((canonicalRoleName(user.role) ?? user.role) === "TERAPEUTA") {
      if (!access.terapeutaId || access.terapeutaId !== Number(evolucaoAtual.terapeuta_id)) {
        return Response.json({ error: "Acesso negado" }, { status: 403 });
      }
    }

    const ok = await excluirEvolucao(evoId, Number(user.id));
    if (!ok) return Response.json({ error: "Evolucao nao encontrada" }, { status: 404 });
    return Response.json({ id: evoId, deleted: true });
  } catch (error) {
    return jsonError(toAppError(error));
  }
}

