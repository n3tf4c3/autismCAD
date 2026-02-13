"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Objetivo = { id: string; texto: string };

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function DocFormClient(props: { pacienteId: number; defaultTipo: string }) {
  const router = useRouter();
  const search = useSearchParams();
  const tipoFromQuery = search.get("tipo");
  const initialTipo = (tipoFromQuery || props.defaultTipo || "ANAMNESE").toUpperCase();

  const [tipo, setTipo] = useState(initialTipo);
  const [titulo, setTitulo] = useState("");
  const [introducao, setIntroducao] = useState("");
  const [avaliacao, setAvaliacao] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [objetivos, setObjetivos] = useState<Objetivo[]>([{ id: uid(), texto: "" }]);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const objetivosClean = useMemo(
    () => objetivos.map((o) => o.texto.trim()).filter(Boolean),
    [objetivos]
  );

  function addObjetivo() {
    setObjetivos((cur) => [...cur, { id: uid(), texto: "" }]);
  }

  function updateObjetivo(id: string, texto: string) {
    setObjetivos((cur) => cur.map((o) => (o.id === id ? { ...o, texto } : o)));
  }

  function removeObjetivo(id: string) {
    setObjetivos((cur) => cur.filter((o) => o.id !== id));
  }

  async function submit(status: "Rascunho" | "Finalizado") {
    setBusy(true);
    setMsg(null);
    try {
      const payload = {
        tipo,
        status,
        titulo: titulo.trim() || null,
        payload: {
          introducao: introducao.trim() || null,
          avaliacao: avaliacao.trim() || null,
          objetivos: objetivosClean,
          observacoes: observacoes.trim() || null,
        },
      };

      const resp = await fetch(`/api/prontuario/documento/${props.pacienteId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await resp.json().catch(() => ({}))) as {
        error?: string;
        id?: number;
        version?: number;
      };
      if (!resp.ok) throw new Error(data.error || "Erro ao salvar documento");
      setMsg(`Documento salvo. Versao ${data.version ?? "-"}.`);
      setTimeout(() => router.push(`/prontuario/${props.pacienteId}`), 650);
    } catch (e) {
      const err = e as { message?: string };
      setMsg(err.message || "Falha ao salvar documento");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-bold text-[var(--marrom)]">Novo documento</h1>
      <p className="mt-1 text-sm text-gray-600">Versao sera criada automaticamente.</p>

      <div className="mt-5 space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-semibold text-[var(--marrom)]">Tipo</label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value.toUpperCase())}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2"
            >
              <option value="ANAMNESE">Anamnese</option>
              <option value="PLANO_TERAPEUTICO">Plano terapeutico</option>
              <option value="RELATORIO_MULTIPROFISSIONAL">Relatorio multiprofissional</option>
              <option value="OUTRO">Outro</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-semibold text-[var(--marrom)]">Titulo</label>
            <input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2"
              placeholder="Titulo do documento"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-[var(--marrom)]">Introducao</label>
            <textarea
              value={introducao}
              onChange={(e) => setIntroducao(e.target.value)}
              rows={4}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
              placeholder="Contextualize brevemente."
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-[var(--marrom)]">Avaliacao clinica</label>
            <textarea
              value={avaliacao}
              onChange={(e) => setAvaliacao(e.target.value)}
              rows={4}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
              placeholder="Principais achados, hipoteses, pontos de atencao."
            />
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[var(--marrom)]">Objetivos terapeuticos</p>
              <p className="text-xs text-gray-500">Liste metas claras e mensuraveis.</p>
            </div>
            <button
              type="button"
              onClick={addObjetivo}
              className="rounded-lg border border-[var(--laranja)] bg-white px-3 py-2 text-sm font-semibold text-[var(--laranja)] hover:bg-amber-50"
            >
              + Adicionar objetivo
            </button>
          </div>

          <div className="mt-3 space-y-2">
            {objetivos.map((o, idx) => (
              <div key={o.id} className="flex gap-2">
                <input
                  value={o.texto}
                  onChange={(e) => updateObjetivo(o.id, e.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                  placeholder={`Objetivo ${idx + 1}`}
                />
                {objetivos.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => removeObjetivo(o.id)}
                    className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    Remover
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-[var(--marrom)]">Observacoes finais</label>
          <textarea
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            rows={4}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
            placeholder="Condutas, combinados, monitoracao."
          />
        </div>

        <div className="flex flex-wrap justify-end gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => submit("Rascunho")}
            className="rounded-lg border border-[var(--laranja)] bg-white px-4 py-2 font-semibold text-[var(--laranja)] hover:bg-amber-50 disabled:opacity-60"
          >
            Salvar rascunho
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => submit("Finalizado")}
            className="rounded-lg bg-[var(--laranja)] px-4 py-2 font-semibold text-white hover:bg-[#e6961f] disabled:opacity-60"
          >
            Finalizar
          </button>
        </div>

        {msg ? <p className="text-sm text-gray-700">{msg}</p> : null}
      </div>
    </section>
  );
}

