"use client";

import { useEffect, useMemo, useState } from "react";

type DiaReport = {
  paciente: { id: number; nome: string };
  periodo: { from: string; to: string };
  indicadores: {
    totalAtendimentos: number;
    presentes: number;
    ausentes: number;
    taxaPresencaPercent: number;
  };
  destaques: {
    ultimasObservacoes: Array<{ data: string; terapeuta_nome: string; texto: string; origem: string }>;
  };
  atendimentos: Array<{
    id: number;
    data: string;
    hora_inicio?: string | null;
    hora_fim?: string | null;
    terapeuta_nome: string | null;
    presenca: string;
    duracao_min: number;
    observacoes: string | null;
    resumo_repasse: string | null;
    motivo: string | null;
  }>;
};

function ymdToday(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function fmtDate(value?: string | null): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("pt-BR");
}

function fmtHour(value?: string | null): string {
  if (!value) return "-";
  const raw = String(value);
  if (/^\d{2}:\d{2}/.test(raw)) return raw.slice(0, 5);
  return raw;
}

function normalizeApiError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Erro ao consultar devolutiva do dia";
}

function readApiError(json: unknown): string | null {
  if (!json || typeof json !== "object") return null;
  const rec = json as Record<string, unknown>;
  return typeof rec.error === "string" ? rec.error : null;
}

export function DevolutivaDiaClient(props: {
  pacienteId: number;
  pacienteNome: string;
}) {
  const [dataRef, setDataRef] = useState(ymdToday());
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [report, setReport] = useState<DiaReport | null>(null);

  const query = useMemo(() => {
    const qs = new URLSearchParams();
    qs.set("pacienteId", String(props.pacienteId));
    qs.set("from", dataRef);
    qs.set("to", dataRef);
    return qs.toString();
  }, [dataRef, props.pacienteId]);

  const resumoDia = useMemo(() => {
    if (!report) return "";
    const dia = fmtDate(report.periodo.from);
    const total = report.indicadores.totalAtendimentos;
    const presentes = report.indicadores.presentes;
    const ausentes = report.indicadores.ausentes;
    const taxa = report.indicadores.taxaPresencaPercent;

    if (!total) {
      return `No dia ${dia}, nao houve atendimentos registrados para ${props.pacienteNome}.`;
    }

    const atendimentoLabel = total === 1 ? "atendimento" : "atendimentos";
    const presencaLabel = presentes === 1 ? "presenca" : "presencas";
    const faltaLabel = ausentes === 1 ? "falta" : "faltas";

    const base =
      `No dia ${dia}, ${props.pacienteNome} teve ${total} ${atendimentoLabel}, ` +
      `${presentes} ${presencaLabel} e ${ausentes} ${faltaLabel} (taxa de presenca ${taxa}%).`;

    const devolutivas = (report.destaques.ultimasObservacoes || [])
      .slice(0, 2)
      .map((o) => `${o.terapeuta_nome}: ${o.texto}`)
      .map((t) => (t.length > 170 ? `${t.slice(0, 170)}...` : t));

    if (!devolutivas.length) {
      return `${base} Nao houve devolutiva textual registrada pelos profissionais neste dia.`;
    }

    return `${base} Principais devolutivas: ${devolutivas.join(" | ")}`;
  }, [props.pacienteNome, report]);

  async function consultar() {
    setLoading(true);
    setMsg(null);
    try {
      const resp = await fetch(`/api/relatorios/evolutivo?${query}`, { cache: "no-store" });
      const json = (await resp.json().catch(() => null)) as unknown;
      if (!resp.ok) throw new Error(readApiError(json) || "Falha ao carregar devolutiva");
      setReport(json as DiaReport);
    } catch (err) {
      setReport(null);
      setMsg(normalizeApiError(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void consultar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="space-y-6">
      <section className="rounded-xl bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-gray-500">Acompanhamento diario</p>
            <h1 className="text-xl font-semibold text-[var(--marrom)]">Devolutiva do dia</h1>
            <p className="mt-1 text-sm text-gray-600">
              Paciente: <span className="font-semibold">{props.pacienteNome}</span> (#{props.pacienteId})
            </p>
          </div>
          <div className="flex items-end gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-sm font-semibold text-[var(--marrom)]">Dia</span>
              <input
                type="date"
                value={dataRef}
                onChange={(e) => setDataRef(e.target.value)}
                className="rounded-lg border border-gray-200 px-3 py-2"
              />
            </label>
            <button
              type="button"
              onClick={() => void consultar()}
              disabled={loading}
              className="rounded-lg bg-[var(--laranja)] px-4 py-2 font-semibold text-white hover:bg-[#e6961f] disabled:opacity-60"
            >
              Consultar dia
            </button>
          </div>
        </div>
        {msg ? <p className="mt-3 text-sm text-red-600">{msg}</p> : null}
      </section>

      {loading ? (
        <section className="rounded-xl bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-600">Carregando devolutiva...</p>
        </section>
      ) : null}

      {report ? (
        <>
          <section className="rounded-xl bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-[var(--marrom)]">Resumo do dia</h2>
            <p className="mt-2 text-sm text-gray-700">{resumoDia}</p>
          </section>

          <section className="rounded-xl bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-[var(--marrom)]">Frequencia do dia</h2>
              <p className="text-sm text-gray-600">{fmtDate(report.periodo.from)}</p>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                <p className="text-sm text-gray-500">Total de atendimentos</p>
                <p className="text-2xl font-bold text-[var(--marrom)]">{report.indicadores.totalAtendimentos}</p>
              </div>
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                <p className="text-sm text-gray-500">Presentes</p>
                <p className="text-2xl font-bold text-green-600">{report.indicadores.presentes}</p>
              </div>
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                <p className="text-sm text-gray-500">Ausentes</p>
                <p className="text-2xl font-bold text-red-600">{report.indicadores.ausentes}</p>
              </div>
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                <p className="text-sm text-gray-500">Taxa de presenca</p>
                <p className="text-2xl font-bold text-[var(--marrom)]">
                  {report.indicadores.taxaPresencaPercent}%
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-xl bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-[var(--marrom)]">Atendimentos do dia</h2>
              <span className="text-sm text-gray-500">{report.atendimentos.length} itens</span>
            </div>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left">Horario</th>
                    <th className="px-4 py-2 text-left">Profissional</th>
                    <th className="px-4 py-2 text-left">Presenca</th>
                    <th className="px-4 py-2 text-left">Duracao (min)</th>
                    <th className="px-4 py-2 text-left">Feedback</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {report.atendimentos.map((a) => (
                    <tr key={a.id}>
                      <td className="px-4 py-2">
                        {fmtHour(a.hora_inicio)} - {fmtHour(a.hora_fim)}
                      </td>
                      <td className="px-4 py-2">{a.terapeuta_nome || "Profissional"}</td>
                      <td className="px-4 py-2">{a.presenca}</td>
                      <td className="px-4 py-2">{a.duracao_min || "-"}</td>
                      <td className="px-4 py-2 text-gray-700">
                        {(a.resumo_repasse || a.observacoes || a.motivo || "-").slice(0, 180)}
                      </td>
                    </tr>
                  ))}
                  {!report.atendimentos.length ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-500">
                        Nenhum atendimento registrado para este dia.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-xl bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-[var(--marrom)]">Devolutiva do profissional</h2>
            <p className="mt-1 text-sm text-gray-600">
              Comentarios e registros clinicos feitos no dia selecionado.
            </p>
            <ul className="mt-3 space-y-2 text-sm text-gray-700">
              {(report.destaques.ultimasObservacoes || []).length ? (
                report.destaques.ultimasObservacoes.map((o, idx) => (
                  <li key={`${o.data}-${o.terapeuta_nome}-${idx}`} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                    <p className="text-xs text-gray-500">
                      {fmtDate(o.data)} - {o.terapeuta_nome} - {o.origem}
                    </p>
                    <p className="mt-1">{o.texto}</p>
                  </li>
                ))
              ) : (
                <li className="text-gray-500">Sem devolutiva registrada para este dia.</li>
              )}
            </ul>
          </section>
        </>
      ) : null}
    </main>
  );
}
