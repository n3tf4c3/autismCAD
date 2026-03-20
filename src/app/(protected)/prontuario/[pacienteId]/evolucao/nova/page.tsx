import Link from "next/link";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { atendimentos, pacientes } from "@/server/db/schema";
import { requirePermission } from "@/server/auth/auth";
import { assertPacienteAccess } from "@/server/auth/paciente-access";
import { canonicalRoleName } from "@/server/auth/permissions";
import { listarTerapeutas } from "@/server/modules/profissionais/profissionais.service";
import { EvolucaoFormClient } from "@/app/(protected)/prontuario/[pacienteId]/evolucao/evolucao-form.client";
import { toAppError } from "@/server/shared/errors";
import { normalizeDateOnlyLoose } from "@/server/shared/normalize";

function parsePositiveInt(value?: string): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0 || !Number.isInteger(parsed)) return null;
  return parsed;
}

export default async function NovaEvolucaoPage(props: {
  params: Promise<{ pacienteId: string }>;
  searchParams: Promise<{ atendimentoId?: string; terapeutaId?: string; data?: string }>;
}) {
  const { user } = await requirePermission("evolucoes:create");
  const { pacienteId } = await props.params;
  const search = await props.searchParams;
  const id = Number(pacienteId);
  if (!id) {
    return (
      <main className="rounded-2xl bg-white p-6 shadow-sm">
        <p className="text-sm text-red-600">Paciente invalido.</p>
      </main>
    );
  }

  try {
    await assertPacienteAccess(user, id);
  } catch (error) {
    const err = toAppError(error);
    return (
      <main className="rounded-2xl bg-white p-6 shadow-sm">
        <p className="text-sm text-red-600">{err.message}</p>
      </main>
    );
  }

  const [paciente] = await db
    .select({ id: pacientes.id, nome: pacientes.nome })
    .from(pacientes)
    .where(and(eq(pacientes.id, id), isNull(pacientes.deletedAt)))
    .limit(1);

  if (!paciente) {
    return (
      <main className="rounded-2xl bg-white p-6 shadow-sm">
        <p className="text-sm text-red-600">Paciente nao encontrado.</p>
      </main>
    );
  }

  const isTerapeuta = (canonicalRoleName(user.role) ?? user.role) === "TERAPEUTA";
  let terapeutas: Array<{ id: number; nome: string }> = [];
  if (!isTerapeuta) {
    try {
      await requirePermission("terapeutas:view");
      const terapeutasRows = await listarTerapeutas({});
      terapeutas = terapeutasRows.map((item) => ({ id: item.id, nome: item.nome }));
    } catch {
      terapeutas = [];
    }
  }

  const atendimentoQueryId = parsePositiveInt(search.atendimentoId);
  const terapeutaQueryId = parsePositiveInt(search.terapeutaId);
  const dataQuery = normalizeDateOnlyLoose(search.data ?? "");

  let initialAtendimentoId: number | null = null;
  let initialTerapeutaId: number | null = terapeutaQueryId;
  let initialData: string | null = dataQuery;

  if (atendimentoQueryId) {
    const [atendimento] = await db
      .select({
        id: atendimentos.id,
        data: atendimentos.data,
        terapeutaId: atendimentos.terapeutaId,
      })
      .from(atendimentos)
      .where(
        and(
          eq(atendimentos.id, atendimentoQueryId),
          eq(atendimentos.pacienteId, id),
          isNull(atendimentos.deletedAt)
        )
      )
      .limit(1);

    if (atendimento) {
      initialAtendimentoId = Number(atendimento.id);
      initialData = String(atendimento.data).slice(0, 10);
      initialTerapeutaId =
        atendimento.terapeutaId == null ? null : Number(atendimento.terapeutaId);
    }
  }

  return (
    <main className="space-y-4">
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-gray-500">Registro de evolucao</p>
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
        isTerapeuta={isTerapeuta}
        initialTerapeutas={terapeutas}
        initial={
          initialAtendimentoId || initialTerapeutaId || initialData
            ? {
                atendimentoId: initialAtendimentoId,
                terapeutaId: initialTerapeutaId,
                data: initialData,
              }
            : undefined
        }
      />
    </main>
  );
}
