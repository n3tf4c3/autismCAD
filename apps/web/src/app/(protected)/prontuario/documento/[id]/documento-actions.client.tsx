"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { excluirDocumentoProntuarioAction } from "@/app/(protected)/prontuario/prontuario.actions";

function unwrapAction<T>(result: { ok: true; data: T } | { ok: false; error: string }): T {
  if (!result.ok) throw new Error(result.error || "Erro ao excluir documento");
  return result.data;
}

export function DocumentoActionsClient(props: { documentoId: number; pacienteId: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleDelete() {
    if (!window.confirm("Deseja excluir este plano de ensino?")) return;
    setBusy(true);
    try {
      unwrapAction(await excluirDocumentoProntuarioAction(props.documentoId));
      router.push(`/prontuario/${props.pacienteId}`);
      router.refresh();
    } catch (error) {
      const err = error as { message?: string };
      window.alert(err.message || "Falha ao excluir plano de ensino");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleDelete()}
      disabled={busy}
      className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
    >
      {busy ? "Excluindo..." : "Excluir"}
    </button>
  );
}

