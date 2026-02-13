"use client";

import { useEffect, useMemo, useState } from "react";

type Terapeuta = { id: number; nome: string };

type EvolutivoReport = {
  paciente: { id: number; nome: string; cpf: string; convenio: string };
  periodo: { from: string; to: string };
  indicadores: {
    totalAtendimentos: number;
    presentes: number;
    ausentes: number;
    naoInformado: number;
    taxaPresencaPercent: number;
    tempoTotalMinutos: number;
    mediaMinutosPorSessao: number;
    primeiroAtendimento: string | null;
    ultimoAtendimento: string | null;
  };
  destaques: {
    ultimasObservacoes: Array<{ data: string; terapeuta_nome: string; texto: string; origem: string }>;
    principaisMotivosAusencia: Array<{ motivo: string; count: number }>;
  };
  resumoAutomatico: { texto: string; regrasDisparadas: string[] };
  atendimentos: Array<{
    id: number;
    data: string;
    terapeuta_nome: string | null;
    presenca: string;
    duracao_min: number;
    observacoes: string | null;
    resumo_repasse: string | null;
    motivo: string | null;
  }>;
};

function ymdToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function ymdMinusDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function fmtDate(d?: string | null): string {
  if (!d) return "-";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return String(d);
  return dt.toLocaleDateString("pt-BR");
}

function normalizeApiError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Erro ao gerar relatorio";
}

export function EvolutivoReportClient(props: {
  initialPacienteId?: number | null;
  canChooseTerapeuta: boolean;
}) {
  const [pacienteId, setPacienteId] = useState<string>(props.initialPacienteId ? String(props.initialPacienteId) : "");
  const [from, setFrom] = useState<string>(ymdMinusDays(29));
  const [to, setTo] = useState<string>(ymdToday());
  const [terapeutaId, setTerapeutaId] = useState<string>("");
  const [terapeutas, setTerapeutas] = useState<Terapeuta[]>([]);
  const [report, setReport] = useState<EvolutivoReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (pacienteId) p.set("pacienteId", pacienteId);
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    if (props.canChooseTerapeuta && terapeutaId) p.set("terapeutaId", terapeutaId);
    return p.toString();
  }, [from, pacienteId, props.canChooseTerapeuta, terapeutaId, to]);

  useEffect(() => {
    if (!props.canChooseTerapeuta) return;
    let alive = true;
    async function loadTerapeutas() {
      try {
        const resp = await fetch("/api/terapeutas", { cache: "no-store" });
        const data = (await resp.json().catch(() => [])) as Terapeuta[];
        if (!resp.ok) return;
        if (!alive) return;
        setTerapeutas(Array.isArray(data) ? data : []);
      } catch {
        // ignore
      }
    }
    void loadTerapeutas();
    return () => {
      alive = false;
    };
  }, [props.canChooseTerapeuta]);

  async function gerar() {
    setMsg(null);
    setLoading(true);
    setReport(null);
    try {
      const resp = await fetch(`/api/relatorios/evolutivo?${qs}`, { cache: "no-store" });
      const data = (await resp.json().catch(() => ({}))) as EvolutivoReport & { error?: string };
      if (!resp.ok) throw new Error(data.error || "Erro ao gerar relatorio");
      setReport(data);
    } catch (err) {
      setMsg(normalizeApiError(err));
    } finally {
      setLoading(false);
    }
  }

  async function exportPdf() {
    setMsg(null);
    try {
      const resp = await fetch(`/api/relatorios/evolutivo/pdf?${qs}`);
      if (!resp.ok) {
        const data = (await resp.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || "Falha ao gerar PDF");
      }
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.target = "_blank";
      a.download = `relatorio-evolutivo-${pacienteId || "paciente"}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 3000);
    } catch (err) {
      setMsg(normalizeApiError(err));
    }
  }

  return (
    <main className="space-y-6">
      <section className="rounded-xl bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase text-gray-500">Filtros</p>
            <h1 className="text-lg font-semibold text-[var(--marrom)]">Periodo e terapeuta</h1>
          </div>
          <button
            type="button"
            onClick={() => void gerar()}
            className="rounded-lg bg-[var(--laranja)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#e6961f]"
            disabled={loading}
          >
            Gerar relatorio
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-4">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-[var(--marrom)]">Paciente ID</span>
            <input
              value={pacienteId}
              onChange={(e) => setPacienteId(e.target.value)}
              inputMode="numeric"
              className="rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
              placeholder="Ex: 12"
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-[var(--marrom)]">Inicio</span>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-[var(--marrom)]">Fim</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-2"
            />
          </label>
          {props.canChooseTerapeuta ? (
            <label className="flex flex-col gap-2 md:col-span-1">
              <span className="text-sm font-semibold text-[var(--marrom)]">Terapeuta (opcional)</span>
              <select
                value={terapeutaId}
                onChange={(e) => setTerapeutaId(e.target.value)}
                className="rounded-lg border border-gray-200 px-3 py-2"
              >
                <option value="">Todos</option>
                {terapeutas.map((t) => (
                  <option key={t.id} value={String(t.id)}>
                    {t.nome}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div className="hidden md:block" />
          )}
        </div>

        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={() => void exportPdf()}
            className="rounded-lg border border-[var(--laranja)] px-4 py-2.5 text-sm font-semibold text-[var(--laranja)] hover:bg-amber-50 disabled:opacity-60"
            disabled={loading || !pacienteId}
          >
            Exportar PDF
          </button>
        </div>

        {msg ? <p className="mt-3 text-sm text-red-600">{msg}</p> : null}
        {loading ? <p className="mt-3 text-sm text-gray-600">Gerando...</p> : null}
      </section>

      {report ? (
        <>
          <section className="rounded-xl bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-semibold text-[var(--marrom)]">Indicadores</h2>
              <p className="text-sm text-gray-600">
                Paciente: <span className="font-semibold">{report.paciente.nome}</span> (#{report.paciente.id}) · Periodo{" "}
                {fmtDate(report.periodo.from)} a {fmtDate(report.periodo.to)}
              </p>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                <p className="text-sm text-gray-500">Total</p>
                <p className="text-2xl font-bold text-[var(--marrom)]">{report.indicadores.totalAtendimentos}</p>
              </div>
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                <p className="text-sm text-gray-500">Presencas</p>
                <p className="text-2xl font-bold text-green-600">{report.indicadores.presentes}</p>
              </div>
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                <p className="text-sm text-gray-500">Ausencias</p>
                <p className="text-2xl font-bold text-red-600">{report.indicadores.ausentes}</p>
              </div>
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                <p className="text-sm text-gray-500">Taxa de presenca</p>
                <p className="text-2xl font-bold text-[var(--marrom)]">{report.indicadores.taxaPresencaPercent}%</p>
              </div>
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                <p className="text-sm text-gray-500">Tempo total (min)</p>
                <p className="text-2xl font-bold text-[var(--marrom)]">{report.indicadores.tempoTotalMinutos}</p>
              </div>
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                <p className="text-sm text-gray-500">Media (min)</p>
                <p className="text-2xl font-bold text-[var(--marrom)]">{report.indicadores.mediaMinutosPorSessao}</p>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-xl bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-[var(--marrom)]">Ultimas observacoes</h3>
              <ul className="mt-3 space-y-2 text-sm text-gray-700">
                {(report.destaques.ultimasObservacoes || []).length ? (
                  report.destaques.ultimasObservacoes.map((o, idx) => (
                    <li key={`${o.data}-${idx}`} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                      <p className="text-xs text-gray-500">
                        {fmtDate(o.data)} · {o.terapeuta_nome} · {o.origem}
                      </p>
                      <p className="mt-1">{o.texto}</p>
                    </li>
                  ))
                ) : (
                  <li className="text-gray-600">Sem observacoes registradas.</li>
                )}
              </ul>
            </div>

            <div className="rounded-xl bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-[var(--marrom)]">Resumo automatico</h3>
              <p className="mt-3 whitespace-pre-line text-sm text-gray-700">
                {report.resumoAutomatico?.texto || "-"}
              </p>
              <p className="mt-3 text-xs text-gray-500">
                Regras:{" "}
                {Array.isArray(report.resumoAutomatico?.regrasDisparadas) && report.resumoAutomatico.regrasDisparadas.length
                  ? report.resumoAutomatico.regrasDisparadas.join(", ")
                  : "-"}
              </p>

              <h4 className="mt-5 text-sm font-semibold text-[var(--marrom)]">Principais motivos de ausencia</h4>
              <ul className="mt-2 space-y-1 text-sm text-gray-700">
                {(report.destaques.principaisMotivosAusencia || []).length ? (
                  report.destaques.principaisMotivosAusencia.map((m) => (
                    <li key={m.motivo}>
                      {m.motivo} <span className="text-gray-500">({m.count})</span>
                    </li>
                  ))
                ) : (
                  <li className="text-gray-600">Sem faltas registradas.</li>
                )}
              </ul>
            </div>
          </section>

          <section className="rounded-xl bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-[var(--marrom)]">Atendimentos</h3>
              <span className="text-sm text-gray-500">{report.atendimentos?.length || 0} itens</span>
            </div>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left">Data</th>
                    <th className="px-4 py-2 text-left">Terapeuta</th>
                    <th className="px-4 py-2 text-left">Presenca</th>
                    <th className="px-4 py-2 text-left">Duracao (min)</th>
                    <th className="px-4 py-2 text-left">Observacao</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(report.atendimentos || []).map((a) => (
                    <tr key={a.id}>
                      <td className="px-4 py-2">{fmtDate(a.data)}</td>
                      <td className="px-4 py-2">{a.terapeuta_nome || "Terapeuta"}</td>
                      <td className="px-4 py-2">{a.presenca}</td>
                      <td className="px-4 py-2">{a.duracao_min || "-"}</td>
                      <td className="px-4 py-2 text-gray-700">
                        {(a.observacoes || a.resumo_repasse || a.motivo || "").slice(0, 120)}
                      </td>
                    </tr>
                  ))}
                  {!report.atendimentos?.length ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-500">
                        Nenhum atendimento no periodo.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </main>
  );
}

