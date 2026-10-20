import Link from "next/link";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { PlanoEnsinoFormClient } from "@/app/(protected)/prontuario/[pacienteId]/plano-ensino/plano-ensino-form.client";
import { pacientes } from "@autismcad/db/schema";
import { requirePermission } from "@/server/auth/auth";
import { hasPermission } from "@/server/auth/access";
import { assertPacienteAccess } from "@/server/auth/paciente-access";
import { sanitizePlanoEnsinoPayload } from "@/server/modules/prontuario/plano-ensino";
import { obterDocumento } from "@/server/modules/prontuario/prontuario.service";
import { toAppError } from "@/server/shared/errors";

export default async function PlanoEnsinoPage(props: {
  params: Promise<{ pacienteId: string }>;
  searchParams: Promise<{ documentoId?: string; clonarDe?: string }>;
}) {
  const { pacienteId } = await props.params;
  const { documentoId, clonarDe } = await props.searchParams;
  const { user, access } = await requirePermission(documentoId ? "prontuario:version" : "prontuario:create");
  if (clonarDe !== undefined) await requirePermission("prontuario:view");
  const id = Number(pacienteId);
  const isCloning = clonarDe !== undefined;
  const sourceDocumentId = isCloning ? Number(clonarDe) : documentoId !== undefined ? Number(documentoId) : null;
  if (!Number.isSafeInteger(id) || id <= 0 ||
      (sourceDocumentId !== null && (!Number.isSafeInteger(sourceDocumentId) || sourceDocumentId <= 0)) ||
      (isCloning && documentoId !== undefined)) {
    return (
      <main className="rounded-2xl bg-white p-6 shadow-sm">
        <p className="text-sm text-red-600">Paciente ou documento inválido.</p>
      </main>
    );
  }

  try {
    await assertPacienteAccess(user, id, access);
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

  if (sourceDoc && ((!isCloning && Number(sourceDoc.pacienteId) !== id) || sourceDoc.tipo !== "PLANO_ENSINO")) {
    return (
      <main className="rounded-2xl bg-white p-6 shadow-sm">
        <p className="text-sm text-red-600">Documento informado não pode ser usado para editar este plano.</p>
      </main>
    );
  }

  if (sourceDoc && isCloning) {
    try {
      await assertPacienteAccess(user, Number(sourceDoc.pacienteId), access);
    } catch (error) {
      const err = toAppError(error);
      return (
        <main className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm text-red-600">{err.message}</p>
        </main>
      );
    }
  }

  if (sourceDoc?.status === "Finalizado" && !isCloning) {
    return (
      <main className="space-y-4 rounded-2xl bg-white p-6 shadow-sm">
        <p className="text-sm text-gray-600">Este plano de ensino está finalizado e não pode ser editado.</p>
        <Link href={`/prontuario/documento/${sourceDoc.id}`} className="text-sm font-semibold text-[var(--laranja)]">
          Visualizar plano de ensino
        </Link>
      </main>
    );
  }

  const initialData = sourceDoc
    ? {
        ...sanitizePlanoEnsinoPayload(sourceDoc.payload),
        sourceDocumentId: isCloning ? null : sourceDoc.id,
      }
    : null;

  return (
    <main className="space-y-4">
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-gray-500">{isCloning ? "Clonar plano de ensino" : sourceDoc ? "Editar plano de ensino" : "Novo plano de ensino"}</p>
            <h1 className="text-2xl font-bold text-[var(--marrom)]">
              {paciente.nome} <span className="text-gray-500">#{paciente.id}</span>
            </h1>
          </div>
          <Link href={`/prontuario/${paciente.id}`} className="text-sm font-semibold text-[var(--laranja)]">
            &larr; Voltar
          </Link>
        </div>
      </section>

      {isCloning ? (
        <p role="status" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-[var(--marrom)]">
          Você está criando uma cópia para este paciente. Revise as datas, o responsável técnico e o conteúdo.
          A cópia só será criada ao salvar como rascunho ou finalizar. O plano original será preservado.
        </p>
      ) : null}
      <PlanoEnsinoFormClient key={`${id}:${documentoId ?? "novo"}:${clonarDe ?? ""}`} pacienteId={paciente.id} initialData={initialData} canFinalize={hasPermission(access, "prontuario:finalize")} />
    </main>
  );
}


