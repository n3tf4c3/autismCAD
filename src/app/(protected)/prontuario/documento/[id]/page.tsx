import Link from "next/link";
import { formatDateBr } from "@/lib/date-only";
import { getDocumentoEditarHref, getDocumentoTipoLabel } from "@/lib/prontuario/document-meta";
import { requirePermission } from "@/server/auth/auth";
import { assertPacienteAccess } from "@/server/auth/paciente-access";
import { sanitizePlanoEnsinoPayload } from "@/server/modules/prontuario/plano-ensino";
import { obterDocumento } from "@/server/modules/prontuario/prontuario.service";
import { toAppError } from "@/server/shared/errors";

function ReadonlyField(props: { label: string; value: string | null | undefined }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{props.label}</p>
      <p className="mt-1 whitespace-pre-wrap text-sm font-semibold text-[var(--texto)]">{props.value || "-"}</p>
    </div>
  );
}

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
    await assertPacienteAccess(user, Number(doc.pacienteId));
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
            href={`/prontuario/${doc.pacienteId}`}
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
            <p>Data: {formatDateBr(String(doc.createdAt).slice(0, 10))}</p>
          </div>
        </div>

        <p className="mt-3 text-sm text-gray-600">
          Autor: {doc.autorNome || doc.createdByRole || "Usuario"}
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
                    <div className="mt-4 space-y-4">
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <ReadonlyField label="Habilidade" value={bloco.habilidade} />
                        <ReadonlyField label="Ensino" value={bloco.ensino} />
                      </div>
                      <ReadonlyField label="Objetivo de Ensino" value={bloco.objetivoEnsino} />
                      <ReadonlyField label="Procedimento" value={bloco.procedimento} />
                      <ReadonlyField label="Recursos" value={bloco.recursos} />
                      <ReadonlyField label="Suportes" value={bloco.suportes} />
                      <ReadonlyField label="Objetivo Especifico" value={bloco.objetivoEspecifico} />
                      <ReadonlyField label="Criterio de Sucesso" value={bloco.criterioSucesso} />
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

        <div className="mt-4 flex flex-wrap justify-end gap-3">
          {doc.tipo === "PLANO_ENSINO" ? (
            <>
              <Link
                href={getDocumentoEditarHref(doc.pacienteId, doc.tipo, doc.id)}
                className="rounded-lg border border-[var(--laranja)] bg-white px-4 py-2 text-sm font-semibold text-[var(--laranja)] hover:bg-amber-50"
              >
                Editar
              </Link>
              <Link
                href={`/prontuario/${doc.pacienteId}/plano-ensino`}
                className="rounded-lg bg-[var(--laranja)] px-4 py-2 text-sm font-semibold text-white hover:bg-[#e6961f]"
              >
                Criar nova versao
              </Link>
            </>
          ) : null}
        </div>
      </section>
    </main>
  );
}
