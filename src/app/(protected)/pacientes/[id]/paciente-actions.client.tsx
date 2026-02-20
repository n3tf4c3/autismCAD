"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  pacienteId: number;
  pacienteNome: string;
  ativo: boolean | number | string | null;
  canArchive: boolean;
  canDelete: boolean;
};

function readApiError(json: unknown): string | null {
  if (!json || typeof json !== "object") return null;
  const rec = json as Record<string, unknown>;
  return typeof rec.error === "string" ? rec.error : null;
}

async function safeJson(resp: Response): Promise<unknown> {
  try {
    return await resp.json();
  } catch {
    return {};
  }
}

function normalizeApiError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Erro ao executar acao";
}

function parseAtivo(value: Props["ativo"]): boolean {
  if (value === true || value === 1) return true;
  if (value === false || value === 0) return false;
  if (typeof value === "string") {
    const parsed = value.trim().toLowerCase();
    if (["1", "true", "ativo"].includes(parsed)) return true;
    if (["0", "false", "inativo", "arquivado"].includes(parsed)) return false;
  }
  // Em caso de valor inesperado, assume ativo para nao expor "Excluir" indevidamente.
  return true;
}

export function PacienteActionsClient({
  pacienteId,
  pacienteNome,
  ativo,
  canArchive,
  canDelete,
}: Props) {
  const router = useRouter();
  const [busyAction, setBusyAction] = useState<"archive" | "delete" | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const isAtivo = parseAtivo(ativo);
  const canShowDelete = canDelete && !isAtivo;

  if (!canArchive && !canDelete) return null;

  async function toggleArquivo() {
    if (busyAction) return;
    const vaiArquivar = isAtivo;
    const ok = window.confirm(
      vaiArquivar
        ? `Arquivar o paciente ${pacienteNome}?`
        : `Desarquivar o paciente ${pacienteNome}?`
    );
    if (!ok) return;

    setBusyAction("archive");
    setMsg(null);
    try {
      const resp = await fetch(`/api/pacientes/${pacienteId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ativo: vaiArquivar ? 0 : 1 }),
      });
      const json = await safeJson(resp);
      if (!resp.ok) throw new Error(readApiError(json) || "Erro ao atualizar status");
      setMsg(null);
      router.refresh();
    } catch (error) {
      setMsg(normalizeApiError(error));
    } finally {
      setBusyAction(null);
    }
  }

  async function excluirPaciente() {
    if (busyAction) return;
    const ok = window.confirm(
      `Excluir o paciente ${pacienteNome}? Esta acao remove a ficha da lista ativa.`
    );
    if (!ok) return;

    const okFinal = window.confirm("Confirmacao final: deseja realmente excluir este paciente?");
    if (!okFinal) return;

    setBusyAction("delete");
    setMsg(null);
    try {
      const resp = await fetch(`/api/pacientes/${pacienteId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const json = await safeJson(resp);
      if (!resp.ok) throw new Error(readApiError(json) || "Erro ao excluir paciente");

      router.push("/pacientes");
      router.refresh();
    } catch (error) {
      setMsg(normalizeApiError(error));
      setBusyAction(null);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex flex-wrap items-center justify-start gap-2">
        {canArchive ? (
          <button
            type="button"
            onClick={() => void toggleArquivo()}
            disabled={busyAction !== null}
            className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busyAction === "archive"
              ? "Processando..."
              : isAtivo
                ? "Arquivar"
                : "Desarquivar"}
          </button>
        ) : null}
        {canShowDelete ? (
          <button
            type="button"
            onClick={() => void excluirPaciente()}
            disabled={busyAction !== null}
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busyAction === "delete" ? "Excluindo..." : "Excluir"}
          </button>
        ) : null}
      </div>
      {msg ? <p className="text-xs text-red-600">{msg}</p> : null}
    </div>
  );
}
