"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  commitArquivoPacienteAction,
  obterArquivoPacienteReadUrlAction,
  prepararUploadArquivoPacienteAction,
} from "@/app/(protected)/pacientes/paciente.actions";

type Kind = "foto" | "laudo" | "documento";

type Existing = {
  foto: string | null;
  laudo: string | null;
  documento: string | null;
};

function labelForKind(kind: Kind): string {
  if (kind === "foto") return "Foto";
  if (kind === "laudo") return "Laudo";
  return "Documento";
}

function normalizeApiError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Erro ao processar arquivo";
}

function uploadNetworkErrorMessage(kind: Kind): string {
  return `Falha ao enviar ${labelForKind(kind)}. Tente novamente em instantes.`;
}

function uploadRejectedMessage(kind: Kind): string {
  return `Falha ao enviar ${labelForKind(kind)}. O armazenamento recusou a requisicao.`;
}

function unwrapAction<T>(
  result: { ok: true; data: T } | { ok: false; error: string }
): T {
  if (!result.ok) throw new Error(result.error || "Erro ao processar arquivo");
  return result.data;
}

async function openSignedUrl(pacienteId: number, kind: Kind) {
  const data = unwrapAction(await obterArquivoPacienteReadUrlAction(pacienteId, kind));
  const url = data.url;
  if (!url) throw new Error("Arquivo nao encontrado");
  window.open(url, "_blank", "noopener,noreferrer");
}

async function presignUpload(pacienteId: number, kind: Kind, file: File) {
  const data = unwrapAction(
    await prepararUploadArquivoPacienteAction(pacienteId, {
      kind,
      filename: file.name,
      contentType: file.type || "application/octet-stream",
    })
  );
  const key = data.key;
  const url = data.url;
  if (!key || !url) throw new Error("Resposta invalida ao preparar upload");
  return { key, url };
}

async function commitKey(pacienteId: number, kind: Kind, key: string | null) {
  unwrapAction(await commitArquivoPacienteAction(pacienteId, { kind, key }));
}

export function PacienteArquivosClient(props: { pacienteId: number; existing: Existing }) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [busyKind, setBusyKind] = useState<Kind | null>(null);
  const [selected, setSelected] = useState<Record<Kind, File | null>>({
    foto: null,
    laudo: null,
    documento: null,
  });

  const rows = useMemo(() => {
    const items: Array<{ kind: Kind; current: string | null }> = [
      { kind: "foto", current: props.existing.foto },
      { kind: "laudo", current: props.existing.laudo },
      { kind: "documento", current: props.existing.documento },
    ];
    return items;
  }, [props.existing.documento, props.existing.foto, props.existing.laudo]);

  async function upload(kind: Kind) {
    setMsg(null);
    const file = selected[kind];
    if (!file) {
      setMsg("Selecione um arquivo primeiro.");
      return;
    }

    setBusyKind(kind);
    try {
      const { key, url } = await presignUpload(props.pacienteId, kind, file);
      let put: Response;
      try {
        put = await fetch(url, {
          method: "PUT",
          headers: { "content-type": file.type || "application/octet-stream" },
          body: file,
        });
      } catch {
        throw new Error(uploadNetworkErrorMessage(kind));
      }
      if (!put.ok) {
        throw new Error(uploadRejectedMessage(kind));
      }
      await commitKey(props.pacienteId, kind, key);
      setSelected((cur) => ({ ...cur, [kind]: null }));
      setMsg(`${labelForKind(kind)} enviado com sucesso.`);
      router.refresh();
    } catch (err) {
      setMsg(normalizeApiError(err));
    } finally {
      setBusyKind(null);
    }
  }

  async function remove(kind: Kind) {
    if (!confirm(`Remover ${labelForKind(kind)} deste paciente?`)) return;
    setMsg(null);
    setBusyKind(kind);
    try {
      await commitKey(props.pacienteId, kind, null);
      setSelected((cur) => ({ ...cur, [kind]: null }));
      setMsg(`${labelForKind(kind)} removido.`);
      router.refresh();
    } catch (err) {
      setMsg(normalizeApiError(err));
    } finally {
      setBusyKind(null);
    }
  }

  async function open(kind: Kind) {
    setMsg(null);
    setBusyKind(kind);
    try {
      await openSignedUrl(props.pacienteId, kind);
    } catch (err) {
      setMsg(normalizeApiError(err));
    } finally {
      setBusyKind(null);
    }
  }

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-[var(--marrom)]">Arquivos do paciente</h2>
          <p className="mt-1 text-sm text-gray-600">
            Upload privado via Cloudflare R2 (URL pre-assinada).
          </p>
        </div>
      </div>

      {msg ? <p className="mt-3 text-sm text-gray-700">{msg}</p> : null}

      <div className="mt-4 space-y-3">
        {rows.map((row) => {
          const busy = busyKind === row.kind;
          const hasCurrent = !!row.current;
          return (
            <div
              key={row.kind}
              className="rounded-xl border border-gray-200 bg-gray-50 p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[var(--marrom)]">{labelForKind(row.kind)}</p>
                  <p className="text-xs text-gray-500">
                    {hasCurrent ? "Arquivo cadastrado" : "Nenhum arquivo cadastrado"}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={!hasCurrent || busy}
                    onClick={() => void open(row.kind)}
                    className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Abrir
                  </button>
                  <button
                    type="button"
                    disabled={!hasCurrent || busy}
                    onClick={() => void remove(row.kind)}
                    className="rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    Remover
                  </button>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input
                  type="file"
                  onChange={(e) =>
                    setSelected((cur) => ({
                      ...cur,
                      [row.kind]: e.target.files?.item(0) ?? null,
                    }))
                  }
                  className="block text-sm"
                />
                <button
                  type="button"
                  disabled={!selected[row.kind] || busy}
                  onClick={() => void upload(row.kind)}
                  className="rounded-lg bg-[var(--laranja)] px-4 py-2 text-sm font-semibold text-white hover:bg-[#e6961f] disabled:opacity-50"
                >
                  {busy ? "Enviando..." : "Enviar"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
