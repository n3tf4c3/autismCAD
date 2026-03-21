import Link from "next/link";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { pacientes } from "@/server/db/schema";
import { requirePermission } from "@/server/auth/auth";
import { assertPacienteAccess } from "@/server/auth/paciente-access";
import { canonicalRoleName } from "@/server/auth/permissions";
import { obterEvolucaoPorId } from "@/server/modules/prontuario/prontuario.service";
import { listarProfissionais } from "@/server/modules/profissionais/profissionais.service";
import { EvolucaoFormClient } from "@/app/(protected)/prontuario/[pacienteId]/evolucao/evolucao-form.client";
import { toAppError } from "@/server/shared/errors";

export default async function EditarEvolucaoPage(props: {
  params: Promise<{ pacienteId: string; evolucaoId: string }>;
}) {
  const { user } = await requirePermission("evolucoes:edit");
  const { pacienteId, evolucaoId } = await props.params;
  const pid = Number(pacienteId);
  const eid = Number(evolucaoId);
  if (!pid || !eid) {
    return (
      <main className="rounded-2xl bg-white p-6 shadow-sm">
        <p className="text-sm text-red-600">Parametros invalidos.</p>
      </main>
    );
  }

  const evolucao = await obterEvolucaoPorId(eid);
  if (!evolucao) {
    return (
      <main className="rounded-2xl bg-white p-6 shadow-sm">
        <p className="text-sm text-red-600">Evolução nao encontrada.</p>
      </main>
    );
  }

  if (Number(evolucao.pacienteId) !== pid) {
    return (
      <main className="rounded-2xl bg-white p-6 shadow-sm">
        <p className="text-sm text-red-600">Evolução não pertence ao paciente.</p>
      </main>
    );
  }

  let access: Awaited<ReturnType<typeof assertPacienteAccess>>;
  try {
    access = await assertPacienteAccess(user, pid);
  } catch (error) {
    const err = toAppError(error);
    return (
      <main className="rounded-2xl bg-white p-6 shadow-sm">
        <p className="text-sm text-red-600">{err.message}</p>
      </main>
    );
  }
  if ((canonicalRoleName(user.role) ?? user.role) === "PROFISSIONAL") {
    const evolucaoProfissionalId = Number(evolucao.profissionalId);
    const accessProfissionalId = access.profissionalId;
    if (!accessProfissionalId || accessProfissionalId !== evolucaoProfissionalId) {
      return (
        <main className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm text-red-600">Acesso negado.</p>
        </main>
      );
    }
  }

  const [paciente] = await db
    .select({ id: pacientes.id, nome: pacientes.nome })
    .from(pacientes)
    .where(and(eq(pacientes.id, pid), isNull(pacientes.deletedAt)))
    .limit(1);

  if (!paciente) {
    return (
      <main className="rounded-2xl bg-white p-6 shadow-sm">
        <p className="text-sm text-red-600">Paciente não encontrado.</p>
      </main>
    );
  }

  const isProfissional = (canonicalRoleName(user.role) ?? user.role) === "PROFISSIONAL";
  let profissionais: Array<{ id: number; nome: string }> = [];
  if (!isProfissional) {
    try {
      await requirePermission("profissionais:view");
      const profissionaisRows = await listarProfissionais({});
      profissionais = profissionaisRows.map((item) => ({ id: item.id, nome: item.nome }));
    } catch {
      profissionais = [];
    }
  }

  return (
    <main className="space-y-4">
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-gray-500">Editar evolucao</p>
            <h1 className="text-2xl font-bold text-[var(--marrom)]">
              {paciente.nome} <span className="text-gray-500">#{paciente.id}</span>
            </h1>
          </div>
          <Link
            href={`/prontuario/${paciente.id}`}
            className="text-sm font-semibold text-[var(--laranja)]"
          >
            &larr; Voltar
          </Link>
        </div>
      </section>

      <EvolucaoFormClient
        pacienteId={paciente.id}
        evolucaoId={evolucao.id}
        isProfissional={isProfissional}
        initialProfissionais={profissionais}
        initial={{
          data: evolucao.data,
          atendimentoId: evolucao.atendimentoId ? Number(evolucao.atendimentoId) : null,
          profissionalId: evolucao.profissionalId ? Number(evolucao.profissionalId) : null,
          payload: (evolucao.payload ?? {}) as Record<string, unknown>,
        }}
      />
    </main>
  );
}



