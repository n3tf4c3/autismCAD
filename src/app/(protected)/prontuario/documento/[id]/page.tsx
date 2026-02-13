import Link from "next/link";
import { requirePermission } from "@/server/auth/auth";
import { assertPacienteAccess } from "@/server/auth/paciente-access";
import { obterDocumento } from "@/server/modules/prontuario/prontuario.service";
import { toAppError } from "@/server/shared/errors";

export default async function VisualizarDocumentoPage(props: { params: Promise<{ id: string }> }) {
  const { user } = await requirePermission("prontuario:view");
  const { id } = await props.params;
  const docId = Number(id);
  if (!docId) {
    return (
      <main className="rounded-2xl bg-white p-6 shadow-sm">
        <p className="text-sm text-red-600">Documento invalido.</p>
      </main>
    );
  }

  const doc = await obterDocumento(docId);
  if (!doc) {
    return (
      <main className="rounded-2xl bg-white p-6 shadow-sm">
        <p className="text-sm text-red-600">Documento nao encontrado.</p>
      </main>
    );
  }

  try {
    await assertPacienteAccess(user, Number(doc.paciente_id));
  } catch (error) {
    const err = toAppError(error);
    return (
      <main className="rounded-2xl bg-white p-6 shadow-sm">
        <p className="text-sm text-red-600">{err.message}</p>
      </main>
    );
  }

  return (
    <main className="space-y-4">
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-gray-500">Documento do prontuario</p>
            <h1 className="text-2xl font-bold text-[var(--marrom)]">
              {doc.titulo || "Documento"}
            </h1>
          </div>
          <Link
            href={`/prontuario/${doc.paciente_id}`}
            className="text-sm font-semibold text-[var(--laranja)]"
          >
            &larr; Voltar
          </Link>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex flex-wrap justify-between gap-3">
          <div>
            <p className="text-xs uppercase text-gray-500">Tipo</p>
            <p className="text-lg font-semibold text-[var(--marrom)]">{doc.tipo}</p>
          </div>
          <div className="text-right text-sm text-gray-600">
            <p>Status: {doc.status || "-"}</p>
            <p>Versao: {doc.version ?? "-"}</p>
            <p>Data: {String(doc.created_at).slice(0, 10)}</p>
          </div>
        </div>

        <p className="mt-3 text-sm text-gray-600">
          Autor: {doc.autor_nome || doc.created_by_role || "Usuario"}
        </p>

        <pre className="mt-4 overflow-auto rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm">
          {JSON.stringify(doc.payload ?? {}, null, 2)}
        </pre>

        <div className="mt-4 flex justify-end">
          <Link
            href={`/prontuario/${doc.paciente_id}/novo-documento?tipo=${encodeURIComponent(doc.tipo)}`}
            className="rounded-lg bg-[var(--laranja)] px-4 py-2 text-sm font-semibold text-white hover:bg-[#e6961f]"
          >
            Criar nova versao
          </Link>
        </div>
      </section>
    </main>
  );
}
