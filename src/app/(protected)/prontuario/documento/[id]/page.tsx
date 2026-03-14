import Link from "next/link";
import { formatDateBr } from "@/lib/date-only";
import { getDocumentoNovoHref, getDocumentoTipoLabel } from "@/lib/prontuario/document-meta";
import { requirePermission } from "@/server/auth/auth";
import { assertPacienteAccess } from "@/server/auth/paciente-access";
import { sanitizePlanoEnsinoPayload } from "@/server/modules/prontuario/plano-ensino";
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

  const planoEnsino = doc.tipo === "PLANO_ENSINO" ? sanitizePlanoEnsinoPayload(doc.payload) : null;

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
            <p className="text-lg font-semibold text-[var(--marrom)]">{getDocumentoTipoLabel(doc.tipo)}</p>
          </div>
          <div className="text-right text-sm text-gray-600">
            <p>Status: {doc.status || "-"}</p>
            <p>Versao: {doc.version ?? "-"}</p>
            <p>Data: {formatDateBr(String(doc.created_at).slice(0, 10))}</p>
          </div>
        </div>

        <p className="mt-3 text-sm text-gray-600">
          Autor: {doc.autor_nome || doc.created_by_role || "Usuario"}
        </p>

        {planoEnsino ? (
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Especialidade</p>
                <p className="mt-1 text-sm font-semibold text-[var(--texto)]">{planoEnsino.especialidade || "-"}</p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Data de inicio</p>
                <p className="mt-1 text-sm font-semibold text-[var(--texto)]">{formatDateBr(planoEnsino.dataInicio)}</p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Data final</p>
                <p className="mt-1 text-sm font-semibold text-[var(--texto)]">{formatDateBr(planoEnsino.dataFinal)}</p>
              </div>
            </div>

            <div className="space-y-4">
              {planoEnsino.blocos.length ? (
                planoEnsino.blocos.map((bloco, index) => (
                  <section key={`${doc.id}-bloco-${index + 1}`} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                    <h3 className="text-lg font-bold text-[var(--marrom)]">Bloco {index + 1}</h3>
                    <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Habilidade</p>
                        <p className="mt-1 text-sm font-semibold text-[var(--texto)]">{bloco.habilidade || "-"}</p>
                      </div>
                      <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Ensino</p>
                        <p className="mt-1 text-sm font-semibold text-[var(--texto)]">{bloco.ensino || "-"}</p>
                      </div>
                      <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Objetivo de Ensino</p>
                        <p className="mt-1 text-sm font-semibold text-[var(--texto)]">{bloco.objetivoEnsino || "-"}</p>
                      </div>
                      <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Recursos</p>
                        <p className="mt-1 text-sm font-semibold text-[var(--texto)]">{bloco.recursos || "-"}</p>
                      </div>
                      <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Procedimento</p>
                        <p className="mt-1 text-sm font-semibold text-[var(--texto)]">{bloco.procedimento || "-"}</p>
                      </div>
                      <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Suportes</p>
                        <p className="mt-1 text-sm font-semibold text-[var(--texto)]">{bloco.suportes || "-"}</p>
                      </div>
                      <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Objetivo Especifico</p>
                        <p className="mt-1 text-sm font-semibold text-[var(--texto)]">{bloco.objetivoEspecifico || "-"}</p>
                      </div>
                      <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Criterio de Sucesso</p>
                        <p className="mt-1 text-sm font-semibold text-[var(--texto)]">{bloco.criterioSucesso || "-"}</p>
                      </div>
                    </div>
                  </section>
                ))
              ) : (
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
                  Nenhum bloco cadastrado neste plano de ensino.
                </div>
              )}
            </div>
          </div>
        ) : (
          <pre className="mt-4 overflow-auto rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm">
            {JSON.stringify(doc.payload ?? {}, null, 2)}
          </pre>
        )}

        <div className="mt-4 flex justify-end">
          <Link
            href={getDocumentoNovoHref(doc.paciente_id, doc.tipo)}
            className="rounded-lg bg-[var(--laranja)] px-4 py-2 text-sm font-semibold text-white hover:bg-[#e6961f]"
          >
            Criar nova versao
          </Link>
        </div>
      </section>
    </main>
  );
}
