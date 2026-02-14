import Link from "next/link";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { pacientes } from "@/server/db/schema";
import { requirePermission } from "@/server/auth/auth";
import { assertPacienteAccess } from "@/server/auth/paciente-access";
import { canonicalRoleName } from "@/server/auth/permissions";
import { obterEvolucaoPorId } from "@/server/modules/prontuario/prontuario.service";
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
        <p className="text-sm text-red-600">Evolucao nao encontrada.</p>
      </main>
    );
  }

  if (Number(evolucao.paciente_id) !== pid) {
    return (
      <main className="rounded-2xl bg-white p-6 shadow-sm">
        <p className="text-sm text-red-600">Evolucao nao pertence ao paciente.</p>
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
  if ((canonicalRoleName(user.role) ?? user.role) === "TERAPEUTA") {
    if (!access.terapeutaId || access.terapeutaId !== Number(evolucao.terapeuta_id)) {
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
        <p className="text-sm text-red-600">Paciente nao encontrado.</p>
      </main>
    );
  }

  const isTerapeuta = (canonicalRoleName(user.role) ?? user.role) === "TERAPEUTA";

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
        isTerapeuta={isTerapeuta}
        initial={{
          data: evolucao.data,
          atendimento_id: evolucao.atendimento_id ? Number(evolucao.atendimento_id) : null,
          terapeuta_id: evolucao.terapeuta_id ? Number(evolucao.terapeuta_id) : null,
          payload: (evolucao.payload ?? {}) as Record<string, unknown>,
        }}
      />
    </main>
  );
}
