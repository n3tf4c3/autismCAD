import Link from "next/link";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { PlanoEnsinoFormClient } from "@/app/(protected)/prontuario/[pacienteId]/plano-ensino/plano-ensino-form.client";
import { pacientes } from "@/server/db/schema";
import { requirePermission } from "@/server/auth/auth";
import { assertPacienteAccess } from "@/server/auth/paciente-access";
import { sanitizePlanoEnsinoPayload } from "@/server/modules/prontuario/plano-ensino";
import { obterDocumento } from "@/server/modules/prontuario/prontuario.service";
import { toAppError } from "@/server/shared/errors";

export default async function PlanoEnsinoPage(props: {
  params: Promise<{ pacienteId: string }>;
  searchParams: Promise<{ documentoId?: string }>;
}) {
  const { user } = await requirePermission("prontuario:create");
  const { pacienteId } = await props.params;
  const { documentoId } = await props.searchParams;
  const id = Number(pacienteId);
  const sourceDocumentId = documentoId ? Number(documentoId) : null;
  if (!id) {
    return (
      <main className="rounded-2xl bg-white p-6 shadow-sm">
        <p className="text-sm text-red-600">Paciente inválido.</p>
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
        <p className="text-sm text-red-600">Paciente não encontrado.</p>
      </main>
    );
  }

  const sourceDoc = sourceDocumentId ? await obterDocumento(sourceDocumentId) : null;
  if (sourceDocumentId && !sourceDoc) {
    return (
      <main className="rounded-2xl bg-white p-6 shadow-sm">
        <p className="text-sm text-red-600">Documento de origem não encontrado.</p>
      </main>
    );
  }

  if (sourceDoc && (Number(sourceDoc.pacienteId) !== id || sourceDoc.tipo !== "PLANO_ENSINO")) {
    return (
      <main className="rounded-2xl bg-white p-6 shadow-sm">
        <p className="text-sm text-red-600">Documento informado não pode ser usado para editar este plano.</p>
      </main>
    );
  }

  const initialData = sourceDoc
    ? {
        ...sanitizePlanoEnsinoPayload(sourceDoc.payload),
        sourceDocumentId: sourceDoc.id,
      }
    : null;

  return (
    <main className="space-y-4">
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-gray-500">{sourceDoc ? "Editar plano de ensino" : "Novo plano de ensino"}</p>
            <h1 className="text-2xl font-bold text-[var(--marrom)]">
              {paciente.nome} <span className="text-gray-500">#{paciente.id}</span>
            </h1>
          </div>
          <Link href={`/prontuario/${paciente.id}`} className="text-sm font-semibold text-[var(--laranja)]">
            &larr; Voltar
          </Link>
        </div>
      </section>

      <PlanoEnsinoFormClient pacienteId={paciente.id} initialData={initialData} />
    </main>
  );
}


