"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { AccessibleDialog } from "@/components/ui/accessible-dialog";
import { buscarPacientesParaClonarPlanoAction } from "@/app/(protected)/prontuario/plano-ensino.actions";

type Props = { documentoId: number; pacienteId: number };

function ClonarPlanoDialog(props: Props & { onClose: () => void }) {
  const router = useRouter();
  const titleId = useId();
  const radioName = useId();
  const [outroPaciente, setOutroPaciente] = useState(false);
  const [nome, setNome] = useState("");
  const [pacientes, setPacientes] = useState<{ id: number; nome: string }[]>([]);
  const [destino, setDestino] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [mensagem, setMensagem] = useState<string | null>(null);

  async function buscar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (buscando) return;
    setBuscando(true);
    setMensagem(null);
    setDestino("");
    setPacientes([]);
    try {
      const result = await buscarPacientesParaClonarPlanoAction(nome.trim());
      if (!result.ok) throw new Error(result.error);
      const outros = result.data.filter((paciente) => paciente.id !== props.pacienteId);
      setPacientes(outros);
      setMensagem(outros.length ? `${outros.length} paciente(s) encontrado(s). Selecione o destino.` : "Nenhum outro paciente encontrado para esta busca.");
    } catch (error) {
      setMensagem(error instanceof Error ? error.message : "Falha ao buscar pacientes.");
    } finally {
      setBuscando(false);
    }
  }

  function continuar() {
    const pacienteId = outroPaciente ? Number(destino) : props.pacienteId;
    if (!pacienteId || buscando) return;
    router.push(`/prontuario/${pacienteId}/plano-ensino?clonarDe=${props.documentoId}`);
  }

  return (
    <AccessibleDialog titleId={titleId} onClose={props.onClose} className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl sm:p-6">
      <h2 id={titleId} className="text-xl font-bold text-[var(--marrom)]">Clonar plano de ensino</h2>
      <p className="mt-2 text-sm text-gray-600">Escolha para quem será a cópia. O formulário será preenchido com o plano atual para você revisar e salvar como um novo plano.</p>
      <fieldset className="mt-4 space-y-3">
        <legend className="mb-2 text-sm font-semibold text-[var(--marrom)]">Paciente de destino</legend>
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" name={radioName} checked={!outroPaciente} onChange={() => setOutroPaciente(false)} data-dialog-initial-focus />
          Mesmo paciente — criar um novo plano
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" name={radioName} checked={outroPaciente} onChange={() => setOutroPaciente(true)} />
          Outro paciente
        </label>
      </fieldset>
      {outroPaciente ? (
        <div className="mt-4 space-y-3">
          <form onSubmit={buscar} className="flex flex-wrap items-end gap-2">
            <label className="min-w-0 flex-1 text-sm">
              <span className="mb-1 block font-semibold text-[var(--marrom)]">Nome do paciente</span>
              <input value={nome} onChange={(event) => setNome(event.target.value)} disabled={buscando} className="w-full rounded-lg border border-gray-200 px-3 py-2" />
            </label>
            <button type="submit" disabled={buscando} className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold disabled:opacity-50">{buscando ? "Buscando…" : "Buscar"}</button>
          </form>
          <p className="text-xs text-gray-500">A busca mostra apenas pacientes aos quais você tem acesso. Refine pelo nome se necessário.</p>
          {pacientes.length ? (
            <label className="block text-sm">
              <span className="mb-1 block font-semibold text-[var(--marrom)]">Selecione o paciente</span>
              <select value={destino} onChange={(event) => setDestino(event.target.value)} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2">
                <option value="">Selecione</option>
                {pacientes.map((paciente) => <option key={paciente.id} value={paciente.id}>{paciente.nome} #{paciente.id}</option>)}
              </select>
            </label>
          ) : null}
          {mensagem ? <p role="status" className="text-sm text-gray-600">{mensagem}</p> : null}
        </div>
      ) : null}
      <p className="mt-4 text-sm text-gray-600">Revise as datas, o responsável técnico e o conteúdo antes de salvar. O plano original será preservado.</p>
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <button type="button" onClick={props.onClose} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold">Cancelar</button>
        <button type="button" onClick={continuar} disabled={buscando || (outroPaciente && !destino)} className="rounded-lg bg-[var(--laranja)] px-4 py-2 text-sm font-semibold text-[var(--texto-sobre-acao)] disabled:opacity-50">Continuar com a cópia</button>
      </div>
    </AccessibleDialog>
  );
}

export function ClonarPlanoEnsinoClient(props: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-[var(--marrom)] hover:bg-amber-50">Clonar plano</button>
      {open ? <ClonarPlanoDialog {...props} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
