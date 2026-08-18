"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  contarAgendaFuturaProfissionalAction,
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
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [arquivarOpen, setArquivarOpen] = useState(false);
  const [agendaFutura, setAgendaFutura] = useState<number | null>(null);

  if (!canArchive && !canDelete) return null;

  async function abrirArquivar() {
    if (busyAction) return;
    setMsg(null);
    setOkMsg(null);
    setAgendaFutura(null);
    setArquivarOpen(true);
    try {
      const result = await contarAgendaFuturaProfissionalAction(profissionalId);
      if (!result.ok) throw new Error(result.error || "Erro ao consultar a agenda");
      setAgendaFutura(result.data.total);
    } catch (error) {
      setMsg(normalizeApiError(error));
      setArquivarOpen(false);
    }
  }

  async function desarquivar() {
    if (busyAction) return;
    const ok = window.confirm(`Desarquivar o profissional ${profissionalNome}?`);
    if (!ok) return;
    await aplicarStatus(true);
  }

  async function aplicarStatus(novoAtivo: boolean) {
    setBusyAction("archive");
    setMsg(null);
    setOkMsg(null);
    try {
      const result = await setProfissionalAtivoAction(profissionalId, novoAtivo);
      if (!result.ok) throw new Error(result.error || "Erro ao atualizar status");
      setArquivarOpen(false);
      setOkMsg(
        novoAtivo
          ? "Profissional desarquivado."
          : `Profissional arquivado. ${result.data.atendimentosCancelados} atendimento(s) futuro(s) cancelado(s).`
      );
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
            onClick={() => void (ativo ? abrirArquivar() : desarquivar())}
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
      {okMsg ? <p className="text-xs text-emerald-700">{okMsg}</p> : null}

      {arquivarOpen ? (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4"
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !busyAction) setArquivarOpen(false);
          }}
        >
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-[var(--marrom)]">Arquivar profissional</h3>
            <p className="mt-2 text-sm text-gray-700">
              Arquivar{" "}
              <span className="font-semibold text-[var(--marrom)]">{profissionalNome}</span>?
            </p>
            {agendaFutura === null ? (
              <p className="mt-3 text-sm text-gray-500">Verificando a agenda...</p>
            ) : agendaFutura > 0 ? (
              <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                <span className="font-semibold">{agendaFutura}</span> atendimento(s) agendado(s) a
                partir de amanha serao cancelados. Desarquivar depois nao restaura esses
                atendimentos.
              </p>
            ) : (
              <p className="mt-3 rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
                Nenhum atendimento futuro na agenda dele.
              </p>
            )}
            <p className="mt-3 text-xs text-gray-500">
              O historico de hoje e das datas anteriores e mantido para consulta.
            </p>

            <div className="mt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setArquivarOpen(false)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                disabled={busyAction !== null}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void aplicarStatus(false)}
                className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-60"
                disabled={busyAction !== null || agendaFutura === null}
              >
                {busyAction === "archive" ? "Arquivando..." : "Arquivar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
