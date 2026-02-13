"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

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

function corsHintForR2(origin: string): string {
  return (
    `O navegador bloqueou o upload para o R2 (CORS).\n` +
    `Configure o CORS do bucket no Cloudflare R2 para permitir PUT/GET/HEAD da origem: ${origin}\n` +
    `Dica rapida (dev): AllowedOrigins [\"${origin}\", \"http://localhost:3000\"] e AllowedHeaders [\"*\"]`
  );
}

async function readJson(resp: Response): Promise<unknown> {
  return resp.json().catch(() => null);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function readError(value: unknown): string | null {
  const rec = asRecord(value);
  if (!rec) return null;
  const err = rec.error;
  return typeof err === "string" ? err : null;
}

function readString(value: unknown, key: string): string | null {
  const rec = asRecord(value);
  if (!rec) return null;
  const v = rec[key];
  return typeof v === "string" ? v : null;
}

async function openSignedUrl(pacienteId: number, kind: Kind) {
  const resp = await fetch(`/api/pacientes/${pacienteId}/arquivos/read-url?kind=${kind}`, {
    cache: "no-store",
  });
  const data = await readJson(resp);
  if (!resp.ok) throw new Error(readError(data) || "Erro ao abrir arquivo");
  const url = readString(data, "url");
  if (!url) throw new Error("Arquivo nao encontrado");
  window.open(url, "_blank", "noopener,noreferrer");
}

async function presignUpload(pacienteId: number, kind: Kind, file: File) {
  const resp = await fetch(`/api/pacientes/${pacienteId}/arquivos/presign`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      kind,
      filename: file.name,
      contentType: file.type || "application/octet-stream",
    }),
  });
  const data = await readJson(resp);
  if (!resp.ok) throw new Error(readError(data) || "Erro ao preparar upload");
  const key = readString(data, "key");
  const url = readString(data, "url");
  if (!key || !url) throw new Error("Resposta invalida ao preparar upload");
  return { key, url };
}

async function commitKey(pacienteId: number, kind: Kind, key: string | null) {
  const resp = await fetch(`/api/pacientes/${pacienteId}/arquivos/commit`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ kind, key }),
  });
  const data = await readJson(resp);
  if (!resp.ok) throw new Error(readError(data) || "Erro ao salvar referencia do arquivo");
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
      } catch (err) {
        const origin = typeof window !== "undefined" ? window.location.origin : "";
        throw new Error(origin ? corsHintForR2(origin) : normalizeApiError(err));
      }
      if (!put.ok) {
        throw new Error(`Falha no upload (HTTP ${put.status}). Verifique o CORS do R2 e tente novamente.`);
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
