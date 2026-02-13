"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type AtendimentoOption = { id: number; data: string; hora_inicio: string; hora_fim: string };

type Initial = {
  data?: string | null;
  atendimento_id?: number | null;
  payload?: Record<string, unknown> | null;
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function EvolucaoFormClient(props: {
  pacienteId: number;
  evolucaoId?: number | null;
  initial?: Initial | null;
}) {
  const router = useRouter();
  const isEdit = !!props.evolucaoId;

  const initialPayload = (props.initial?.payload ?? {}) as Record<string, unknown>;
  const [data, setData] = useState<string>(props.initial?.data ?? todayIso());
  const [atendimentoId, setAtendimentoId] = useState<string>(
    props.initial?.atendimento_id ? String(props.initial.atendimento_id) : ""
  );
  const [titulo, setTitulo] = useState<string>(String(initialPayload.titulo ?? ""));
  const [conduta, setConduta] = useState<string>(String(initialPayload.conduta ?? ""));
  const [descricao, setDescricao] = useState<string>(String(initialPayload.descricao ?? ""));
  const [atendimentos, setAtendimentos] = useState<AtendimentoOption[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const payload = useMemo(
    () => ({
      titulo: titulo.trim() || null,
      conduta: conduta.trim() || null,
      descricao: descricao.trim() || null,
    }),
    [conduta, descricao, titulo]
  );

  useEffect(() => {
    let alive = true;
    async function loadAtendimentos() {
      try {
        const qs = new URLSearchParams({ pacienteId: String(props.pacienteId) }).toString();
        const resp = await fetch(`/api/atendimentos?${qs}`);
        const data = (await resp.json().catch(() => [])) as AtendimentoOption[];
        if (!resp.ok) return;
        if (!alive) return;
        setAtendimentos(Array.isArray(data) ? data : []);
      } catch {
        // ignore
      }
    }
    loadAtendimentos();
    return () => {
      alive = false;
    };
  }, [props.pacienteId]);

  async function submit() {
    setBusy(true);
    setMsg(null);
    try {
      const body = {
        data,
        atendimentoId: atendimentoId ? Number(atendimentoId) : null,
        payload,
      };
      const url = isEdit
        ? `/api/prontuario/evolucao/${props.evolucaoId}`
        : `/api/prontuario/evolucao/${props.pacienteId}`;
      const method = isEdit ? "PUT" : "POST";

      const resp = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const dataResp = (await resp.json().catch(() => ({}))) as { error?: string };
      if (!resp.ok) throw new Error(dataResp.error || "Falha ao salvar evolucao");
      setMsg(isEdit ? "Evolucao atualizada." : "Evolucao registrada.");
      setTimeout(() => router.push(`/prontuario/${props.pacienteId}`), 650);
    } catch (e) {
      const err = e as { message?: string };
      setMsg(err.message || "Erro ao salvar evolucao");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!props.evolucaoId) return;
    if (!confirm("Deseja excluir esta evolucao?")) return;
    setBusy(true);
    setMsg(null);
    try {
      const resp = await fetch(`/api/prontuario/evolucao/${props.evolucaoId}`, { method: "DELETE" });
      const dataResp = (await resp.json().catch(() => ({}))) as { error?: string };
      if (!resp.ok) throw new Error(dataResp.error || "Falha ao excluir evolucao");
      setMsg("Evolucao excluida.");
      setTimeout(() => router.push(`/prontuario/${props.pacienteId}`), 650);
    } catch (e) {
      const err = e as { message?: string };
      setMsg(err.message || "Erro ao excluir evolucao");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-bold text-[var(--marrom)]">
        {isEdit ? "Editar evolucao" : "Nova evolucao"}
      </h1>

      <div className="mt-5 space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-semibold text-[var(--marrom)]">Data</label>
            <input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2"
            />
          </div>
          <div className="flex flex-col gap-1 md:col-span-2">
            <label className="text-sm font-semibold text-[var(--marrom)]">Atendimento</label>
            <select
              value={atendimentoId}
              onChange={(e) => setAtendimentoId(e.target.value)}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2"
            >
              <option value="">Sem vinculo</option>
              {atendimentos.map((a) => (
                <option key={a.id} value={String(a.id)}>
                  {String(a.data).slice(0, 10)} {a.hora_inicio}-{a.hora_fim} (#{a.id})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-semibold text-[var(--marrom)]">Titulo</label>
            <input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
              placeholder="Ex: Psicologia"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-semibold text-[var(--marrom)]">Conduta</label>
            <input
              value={conduta}
              onChange={(e) => setConduta(e.target.value)}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
              placeholder="Encaminhamentos, combinados."
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-[var(--marrom)]">Descricao clinica</label>
          <textarea
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            rows={4}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
            placeholder="Evolucao da sessao, respostas a intervencoes."
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          {isEdit ? (
            <button
              type="button"
              onClick={remove}
              disabled={busy}
              className="text-sm font-semibold text-red-600 disabled:opacity-60"
            >
              Excluir evolucao
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="rounded-lg bg-[var(--laranja)] px-4 py-2 font-semibold text-white hover:bg-[#e6961f] disabled:opacity-60"
          >
            Salvar evolucao
          </button>
        </div>

        {msg ? <p className="text-sm text-gray-700">{msg}</p> : null}
      </div>
    </section>
  );
}

