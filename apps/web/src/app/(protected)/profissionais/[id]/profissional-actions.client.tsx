"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  deleteProfissionalAction,
  setProfissionalAtivoAction,
} from "@/app/(protected)/profissionais/profissional.actions";

type Props = {
  profissionalId: number;
  profissionalNome: string;
  ativo: boolean;
  canArchive: boolean;
  canDelete: boolean;
};

function normalizeApiError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Erro ao executar acao";
}

export function ProfissionalActionsClient({
  profissionalId,
  profissionalNome,
  ativo,
  canArchive,
  canDelete,
}: Props) {
  const router = useRouter();
  const [busyAction, setBusyAction] = useState<"archive" | "delete" | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  if (!canArchive && !canDelete) return null;

  async function toggleArquivo() {
    if (busyAction) return;
    const vaiArquivar = ativo;
    const ok = window.confirm(
      vaiArquivar
        ? `Arquivar o profissional ${profissionalNome}?`
        : `Desarquivar o profissional ${profissionalNome}?`
    );
    if (!ok) return;

    setBusyAction("archive");
    setMsg(null);
    try {
      const result = await setProfissionalAtivoAction(profissionalId, !vaiArquivar);
      if (!result.ok) throw new Error(result.error || "Erro ao atualizar status");
      setMsg(null);
      router.refresh();
    } catch (error) {
      setMsg(normalizeApiError(error));
    } finally {
      setBusyAction(null);
    }
  }

  async function excluirProfissional() {
    if (busyAction) return;
    const ok = window.confirm(
      `Excluir o profissional ${profissionalNome}? Esta acao remove o cadastro definitivamente.`
    );
    if (!ok) return;

    const okFinal = window.confirm("Confirmacao final: deseja realmente excluir este profissional?");
    if (!okFinal) return;

    setBusyAction("delete");
    setMsg(null);
    try {
      const result = await deleteProfissionalAction(profissionalId);
      if (!result.ok) throw new Error(result.error || "Erro ao excluir profissional");

      router.push("/profissionais");
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
            className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busyAction === "archive"
              ? "Processando..."
              : ativo
                ? "Arquivar"
                : "Desarquivar"}
          </button>
        ) : null}
        {canDelete && !ativo ? (
          <button
            type="button"
            onClick={() => void excluirProfissional()}
            disabled={busyAction !== null}
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busyAction === "delete" ? "Excluindo..." : "Excluir"}
          </button>
        ) : null}
      </div>
      {msg ? <p className="text-xs text-red-600">{msg}</p> : null}
    </div>
  );
}
