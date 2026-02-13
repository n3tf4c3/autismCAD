import Link from "next/link";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { pacientes } from "@/server/db/schema";
import { requirePermission } from "@/server/auth/auth";
import { assertPacienteAccess } from "@/server/auth/paciente-access";
import { DocFormClient } from "@/app/(protected)/prontuario/[pacienteId]/novo-documento/doc-form.client";
import { toAppError } from "@/server/shared/errors";

export default async function NovoDocumentoPage(props: {
  params: Promise<{ pacienteId: string }>;
  searchParams: Promise<{ tipo?: string }>;
}) {
  const { user } = await requirePermission("prontuario:create");
  const { pacienteId } = await props.params;
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

  const { tipo } = await props.searchParams;
  const defaultTipo = (tipo || "ANAMNESE").toUpperCase();

  return (
    <main className="space-y-4">
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-gray-500">Novo documento</p>
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

      <DocFormClient pacienteId={paciente.id} defaultTipo={defaultTipo} />
    </main>
  );
}
