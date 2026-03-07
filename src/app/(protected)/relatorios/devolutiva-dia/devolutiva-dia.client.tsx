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
  evolucoes?: Array<{
    id: number;
    data: string;
    payload?: Record<string, unknown> | null;
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

type DesempenhoKey = "ajuda" | "nao_fez" | "independente";

function normalizeDesempenho(value: unknown): DesempenhoKey | null {
  if (typeof value !== "string") return null;
  const v = value.toLowerCase().trim().replace(/\s+/g, "_");
  if (v === "ajuda" || v === "nao_fez" || v === "independente") return v;
  return null;
}

export function DevolutivaDiaClient(props: {
  pacienteId: number;
  pacienteNome: string;
}) {
  const [dataRef, setDataRef] = useState(ymdToday());
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [copyMsg, setCopyMsg] = useState<string | null>(null);
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

    if (!total) {
      return `No dia ${dia}, nao houve devolutiva registrada para ${props.pacienteNome}.`;
    }

    const base = `No dia ${dia}, a equipe realizou o acompanhamento de ${props.pacienteNome}.`;

    const devolutivas = (report.atendimentos || [])
      .slice(0, 2)
      .map((a) => (a.resumo_repasse || a.observacoes || a.motivo || "").replace(/\s+/g, " ").trim())
      .filter(Boolean);

    if (!devolutivas.length) {
      return `${base} Nao houve devolutiva textual registrada pelos profissionais neste dia.`;
    }

    return `${base} Resumo clinico: ${devolutivas.join(" ")}`;
  }, [props.pacienteNome, report]);

  const desempenhoResumo = useMemo(() => {
    const counts: Record<DesempenhoKey, number> = {
      ajuda: 0,
      nao_fez: 0,
      independente: 0,
    };

    (report?.evolucoes || []).forEach((e) => {
      const payload = e?.payload;
      if (!payload || typeof payload !== "object") return;
      const itensRaw = Array.isArray(payload.itensDesempenho)
        ? payload.itensDesempenho
        : Array.isArray(payload.itens)
          ? payload.itens
          : [];

      itensRaw.forEach((item) => {
        if (!item || typeof item !== "object") return;
        const rec = item as Record<string, unknown>;
        const d = normalizeDesempenho(rec.desempenho ?? rec.performance);
        if (!d) return;
        counts[d] += 1;
      });
    });

    const total = counts.ajuda + counts.nao_fez + counts.independente;
    const percent = (value: number) => (total ? Math.round((value / total) * 100) : 0);
    return {
      total,
      rows: [
        { key: "independente", label: "Independente", value: counts.independente, pct: percent(counts.independente), bar: "bg-green-500" },
        { key: "ajuda", label: "Com ajuda", value: counts.ajuda, pct: percent(counts.ajuda), bar: "bg-amber-500" },
        { key: "nao_fez", label: "Nao fez", value: counts.nao_fez, pct: percent(counts.nao_fez), bar: "bg-rose-500" },
      ] as Array<{ key: DesempenhoKey; label: string; value: number; pct: number; bar: string }>,
    };
  }, [report]);

  const textoResumoParaPais = useMemo(() => {
    if (!report) return "";
    const linhas = [`Resumo do dia (${fmtDate(report.periodo.from)})`, resumoDia];
    if (desempenhoResumo.total) {
      linhas.push("Desempenho do dia:");
      desempenhoResumo.rows.forEach((row) => {
        linhas.push(`- ${row.label}: ${row.value} (${row.pct}%)`);
      });
    }
    const devolutivasProfissionais = (report.destaques?.ultimasObservacoes || [])
      .map((o) => ({
        data: fmtDate(o.data),
        terapeuta: (o.terapeuta_nome || "Profissional").replace(/\s+/g, " ").trim(),
        texto: String(o.texto || "").replace(/\s+/g, " ").trim(),
      }))
      .filter((o) => o.texto);
    if (devolutivasProfissionais.length) {
      linhas.push("Devolutiva do profissional:");
      devolutivasProfissionais.forEach((o) => {
        linhas.push(`- ${o.data} | ${o.terapeuta}: ${o.texto}`);
      });
    }
    return linhas.join("\n");
  }, [desempenhoResumo, report, resumoDia]);

  async function copiarResumo() {
    if (!textoResumoParaPais) return;
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(textoResumoParaPais);
      } else if (typeof document !== "undefined") {
        const ta = document.createElement("textarea");
        ta.value = textoResumoParaPais;
        ta.setAttribute("readonly", "");
        ta.style.position = "absolute";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      } else {
        throw new Error("Clipboard indisponivel");
      }
      setCopyMsg("Resumo copiado.");
      setTimeout(() => setCopyMsg(null), 1800);
    } catch {
      setCopyMsg("Nao foi possivel copiar.");
      setTimeout(() => setCopyMsg(null), 2200);
    }
  }

  async function consultar() {
    setLoading(true);
    setMsg(null);
    setCopyMsg(null);
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
    <main className="space-y-3">
      <div className="flex flex-wrap items-end justify-end gap-2">
        <div className="flex items-end gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-[var(--marrom)]">Dia</span>
            <input
              type="date"
              value={dataRef}
              onChange={(e) => setDataRef(e.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-1.5"
            />
          </label>
          <button
            type="button"
            onClick={() => void consultar()}
            disabled={loading}
            className="rounded-lg bg-[var(--laranja)] px-4 py-1.5 font-semibold text-white hover:bg-[#e6961f] disabled:opacity-60"
          >
            Consultar dia
          </button>
        </div>
      </div>
      {msg ? <p className="text-sm text-red-600">{msg}</p> : null}

      {loading ? (
        <section className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-600">Carregando devolutiva...</p>
        </section>
      ) : null}

      {report ? (
        <>
          <section className="rounded-xl bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-[var(--marrom)]">Resumo do dia</h2>
              <button
                type="button"
                onClick={() => void copiarResumo()}
                disabled={!textoResumoParaPais}
                className="rounded-lg border border-[var(--laranja)] px-3 py-1.5 text-sm font-semibold text-[var(--laranja)] hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Copiar resumo
              </button>
            </div>
            {copyMsg ? (
              <p className={`mt-2 text-xs ${copyMsg.includes("Nao") ? "text-red-600" : "text-green-700"}`}>{copyMsg}</p>
            ) : null}
            <p className="mt-2 text-sm text-gray-700">{resumoDia}</p>
          </section>

          <section className="rounded-xl bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-[var(--marrom)]">Desempenho do dia</h2>
              <p className="text-sm text-gray-600">{fmtDate(report.periodo.from)}</p>
            </div>
            <p className="mt-1 text-sm text-gray-600">
              Baseado nos registros de metas das evolucoes do dia ({desempenhoResumo.total} item(ns)).
            </p>
            {desempenhoResumo.total ? (
              <div className="mt-4 space-y-3">
                {desempenhoResumo.rows.map((row) => (
                  <div key={row.key}>
                    <div className="mb-1 flex items-center justify-between text-sm text-gray-700">
                      <span>{row.label}</span>
                      <span className="font-semibold">
                        {row.value} ({row.pct}%)
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                      <div className={`h-full rounded-full ${row.bar}`} style={{ width: `${row.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-gray-600">
                Nao ha dados de desempenho estruturado nas evolucoes deste dia.
              </p>
            )}
          </section>

          <section className="rounded-xl bg-white p-4 shadow-sm">
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

          <section className="rounded-xl bg-white p-4 shadow-sm">
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
