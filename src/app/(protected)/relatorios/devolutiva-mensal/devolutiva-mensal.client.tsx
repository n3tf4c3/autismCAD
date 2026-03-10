"use client";

import { useEffect, useMemo, useState } from "react";
import { DesempenhoPorHabilidadeChart } from "@/components/desempenho-por-habilidade-chart";
import { buildDesempenhoResumo } from "@/lib/relatorios/desempenho";

type MensalReport = {
  paciente: { id: number; nome: string };
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

type ComportamentoResultado = "negativo" | "positivo" | "parcial";

function ymdFromLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function ymNow(): string {
  return ymdFromLocalDate(new Date()).slice(0, 7);
}

function monthRange(ym: string): { from: string; to: string } | null {
  if (!/^\d{4}-\d{2}$/.test(ym)) return null;
  const [ys, ms] = ym.split("-");
  const year = Number(ys);
  const month = Number(ms);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return null;
  const lastDay = new Date(year, month, 0).getDate();
  return {
    from: `${ys}-${ms}-01`,
    to: `${ys}-${ms}-${String(lastDay).padStart(2, "0")}`,
  };
}

function fmtDate(value?: string | null): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("pt-BR");
}

function fmtMonth(ym: string): string {
  if (!/^\d{4}-\d{2}$/.test(ym)) return ym;
  const [y, m] = ym.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

function normalizeApiError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Erro ao consultar devolutiva mensal";
}

function readApiError(json: unknown): string | null {
  if (!json || typeof json !== "object") return null;
  const rec = json as Record<string, unknown>;
  return typeof rec.error === "string" ? rec.error : null;
}

function normalizeComportamentoResultado(value: unknown): ComportamentoResultado | null {
  if (typeof value !== "string") return null;
  const v = value.toLowerCase().trim().replace(/\s+/g, "_");
  if (v === "negativo" || v === "positivo" || v === "parcial") return v;
  return null;
}

function normalizeComportamentoKey(value: string): string {
  return value.toLowerCase().trim().replace(/\s+/g, "_");
}

function asPositiveInt(value: unknown, fallback = 1): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.trunc(n);
}

function pickStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item ?? "").trim())
    .filter(Boolean);
}

const COMPORTAMENTO_LABELS: Record<string, string> = {
  autoagressao: "Autoagressao",
  heteroagressao: "Hetero agressao",
  estereotipia_vocal: "Estereotipia Vocal",
  estereotipia_motora: "Estereotipia Motora",
  ecolalia_imediata: "Ecolalia Imediata",
  ecolalia_tardia: "Ecolalia Tardia",
  fugas_esquivas: "Fugas/Esquivas",
  agitacao_motora: "Agitacao Motora",
  demanda_atencao: "Demanda de Atencao",
  crise_ausencia: "Crise de ausencia",
  isolamento: "Isolamento",
  comportamento_desafiador: "Comportamento Desafiador",
  baixo_interesse: "Baixo Interesse",
  desregulacao_emocional: "Desregulacao emocional (crise)",
  calmo: "Calmo",
  animado: "Animado (alegre, sorridente)",
  alto_interesse: "Alto interesse",
  foco_atencao: "Foco/Atencao",
  compartilhamento: "Compartilhamento",
  empatia: "Empatia",
  autonomia: "Autonomia",
};

function behaviorLabelFromValue(value: string): string {
  const key = normalizeComportamentoKey(value);
  if (COMPORTAMENTO_LABELS[key]) return COMPORTAMENTO_LABELS[key];
  const clean = value.trim().replace(/_/g, " ");
  if (!clean) return "-";
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

export function DevolutivaMensalClient(props: {
  pacienteId: number;
  pacienteNome: string;
}) {
  const [monthRef, setMonthRef] = useState(ymNow());
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [copyMsg, setCopyMsg] = useState<string | null>(null);
  const [report, setReport] = useState<MensalReport | null>(null);

  const query = useMemo(() => {
    const range = monthRange(monthRef);
    if (!range) return "";
    const qs = new URLSearchParams();
    qs.set("pacienteId", String(props.pacienteId));
    qs.set("from", range.from);
    qs.set("to", range.to);
    return qs.toString();
  }, [monthRef, props.pacienteId]);

  const desempenhoMensal = useMemo(() => {
    return buildDesempenhoResumo(report?.evolucoes);
  }, [report]);

  const comportamentoMensal = useMemo(() => {
    const resultado: Record<ComportamentoResultado, number> = {
      negativo: 0,
      positivo: 0,
      parcial: 0,
    };
    const mapNeg = new Map<string, { label: string; value: number }>();
    const mapPos = new Map<string, { label: string; value: number }>();

    const addItem = (lado: "negativo" | "positivo", rawValue: string, qty: number) => {
      const key = normalizeComportamentoKey(rawValue);
      if (!key) return;
      const target = lado === "negativo" ? mapNeg : mapPos;
      const current = target.get(key);
      if (current) {
        current.value += qty;
        return;
      }
      target.set(key, {
        label: behaviorLabelFromValue(rawValue),
        value: qty,
      });
    };

    (report?.evolucoes || []).forEach((e) => {
      const payload = e?.payload;
      if (!payload || typeof payload !== "object") return;
      const compRaw = payload.comportamentos ?? payload.comportamento;
      if (!compRaw || typeof compRaw !== "object") return;
      const comp = compRaw as Record<string, unknown>;

      const r = normalizeComportamentoResultado(comp.resultado);
      if (r) resultado[r] += 1;

      const quantidades =
        comp.quantidades && typeof comp.quantidades === "object"
          ? (comp.quantidades as Record<string, unknown>)
          : null;
      const qtyNeg =
        quantidades?.negativo && typeof quantidades.negativo === "object"
          ? (quantidades.negativo as Record<string, unknown>)
          : null;
      const qtyPos =
        quantidades?.positivo && typeof quantidades.positivo === "object"
          ? (quantidades.positivo as Record<string, unknown>)
          : null;

      const negativos = pickStringList(comp.negativos);
      const positivos = pickStringList(comp.positivos);

      negativos.forEach((item) => {
        const key = normalizeComportamentoKey(item);
        const qty = asPositiveInt((qtyNeg?.[item] ?? qtyNeg?.[key]) as unknown, 1);
        addItem("negativo", item, qty);
      });
      positivos.forEach((item) => {
        const key = normalizeComportamentoKey(item);
        const qty = asPositiveInt((qtyPos?.[item] ?? qtyPos?.[key]) as unknown, 1);
        addItem("positivo", item, qty);
      });
    });

    const totalNegativo = Array.from(mapNeg.values()).reduce((acc, item) => acc + item.value, 0);
    const totalPositivo = Array.from(mapPos.values()).reduce((acc, item) => acc + item.value, 0);
    const total = totalNegativo + totalPositivo;
    const percent = (value: number, totalRef: number) =>
      totalRef ? Math.round((value / totalRef) * 100) : 0;

    return {
      total,
      totalNegativo,
      totalPositivo,
      pctNegativo: percent(totalNegativo, total),
      pctPositivo: percent(totalPositivo, total),
      resultado,
      topNegativo: Array.from(mapNeg.entries())
        .map(([key, item]) => ({ key, label: item.label, value: item.value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 6),
      topPositivo: Array.from(mapPos.entries())
        .map(([key, item]) => ({ key, label: item.label, value: item.value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 6),
    };
  }, [report]);

  const resumoMensal = useMemo(() => {
    if (!report) return "";
    const lines: string[] = [];
    lines.push(`Resumo mensal de ${props.pacienteNome} (${fmtMonth(monthRef)}).`);
    lines.push(
      `Atendimentos: ${report.indicadores.totalAtendimentos} (Presencas: ${report.indicadores.presentes}, Ausencias: ${report.indicadores.ausentes}).`
    );
    lines.push(`Taxa de presenca: ${report.indicadores.taxaPresencaPercent}%.`);
    if (desempenhoMensal.total) {
      lines.push(`Metas avaliadas nas devolutivas: ${desempenhoMensal.total}.`);
      desempenhoMensal.rows.forEach((row) => {
        lines.push(`- ${row.label}: ${row.value} (${row.pct}%)`);
      });
    }
    return lines.join("\n");
  }, [desempenhoMensal, monthRef, props.pacienteNome, report]);

  async function copiarResumo() {
    if (!resumoMensal) return;
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(resumoMensal);
      } else if (typeof document !== "undefined") {
        const ta = document.createElement("textarea");
        ta.value = resumoMensal;
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
      setCopyMsg("Resumo mensal copiado.");
      setTimeout(() => setCopyMsg(null), 1800);
    } catch {
      setCopyMsg("Nao foi possivel copiar.");
      setTimeout(() => setCopyMsg(null), 2200);
    }
  }

  async function consultar() {
    if (!query) {
      setMsg("Mes invalido.");
      return;
    }
    setLoading(true);
    setMsg(null);
    setCopyMsg(null);
    try {
      const resp = await fetch(`/api/relatorios/evolutivo?${query}`, { cache: "no-store" });
      const json = (await resp.json().catch(() => null)) as unknown;
      if (!resp.ok) throw new Error(readApiError(json) || "Falha ao carregar relatorio mensal");
      setReport(json as MensalReport);
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
      <section className="rounded-xl bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[var(--marrom)]">Relatorio mensal de desempenho</h2>
            <p className="text-sm text-gray-600">
              Consolidado mensal construido a partir das devolutivas diarias registradas no prontuario.
            </p>
          </div>
          <div className="flex items-end gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-sm font-semibold text-[var(--marrom)]">Mes</span>
              <input
                type="month"
                value={monthRef}
                onChange={(e) => setMonthRef(e.target.value)}
                className="rounded-lg border border-gray-200 px-3 py-1.5"
              />
            </label>
            <button
              type="button"
              onClick={() => void consultar()}
              disabled={loading}
              className="rounded-lg bg-[var(--laranja)] px-4 py-1.5 font-semibold text-white hover:bg-[#e6961f] disabled:opacity-60"
            >
              Consultar mes
            </button>
          </div>
        </div>
        {msg ? <p className="mt-2 text-sm text-red-600">{msg}</p> : null}
      </section>

      {loading ? (
        <section className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-600">Carregando relatorio mensal...</p>
        </section>
      ) : null}

      {report ? (
        <>
          <section className="rounded-xl bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-[var(--marrom)]">Resumo do mes</h2>
              <button
                type="button"
                onClick={() => void copiarResumo()}
                disabled={!resumoMensal}
                className="rounded-lg border border-[var(--laranja)] px-3 py-1.5 text-sm font-semibold text-[var(--laranja)] hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Copiar resumo
              </button>
            </div>
            {copyMsg ? (
              <p className={`mt-2 text-xs ${copyMsg.includes("Nao") ? "text-red-600" : "text-green-700"}`}>{copyMsg}</p>
            ) : null}

            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Atendimentos</p>
                <p className="text-xl font-semibold text-[var(--marrom)]">{report.indicadores.totalAtendimentos}</p>
              </div>
              <div className="rounded-lg border border-green-100 bg-green-50 px-3 py-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-green-700">Presencas</p>
                <p className="text-xl font-semibold text-green-700">{report.indicadores.presentes}</p>
              </div>
              <div className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">Ausencias</p>
                <p className="text-xl font-semibold text-rose-700">{report.indicadores.ausentes}</p>
              </div>
              <div className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Taxa de presenca</p>
                <p className="text-xl font-semibold text-amber-700">{report.indicadores.taxaPresencaPercent}%</p>
              </div>
            </div>
            <p className="mt-3 text-sm text-gray-600">
              Periodo: {fmtDate(report.periodo.from)} a {fmtDate(report.periodo.to)}.
              {report.indicadores.primeiroAtendimento ? (
                <> Primeiro atendimento: {fmtDate(report.indicadores.primeiroAtendimento)}.</>
              ) : null}
              {report.indicadores.ultimoAtendimento ? (
                <> Ultimo atendimento: {fmtDate(report.indicadores.ultimoAtendimento)}.</>
              ) : null}
            </p>
          </section>

          <section className="rounded-xl bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-[var(--marrom)]">Desempenho no mes</h2>
              <p className="text-sm text-gray-600">{fmtMonth(monthRef)}</p>
            </div>
            <p className="mt-1 text-sm text-gray-600">
              {desempenhoMensal.total
                ? `${desempenhoMensal.total} metas avaliadas em ${desempenhoMensal.diasComRegistro} dia(s) com devolutiva.`
                : "Sem metas estruturadas nas devolutivas deste mes."}
            </p>

            {desempenhoMensal.total ? (
              <div className="mt-4 space-y-3">
                {desempenhoMensal.rows.map((row) => (
                  <div key={row.key}>
                    <div className="mb-1 flex items-center justify-between text-sm text-gray-700">
                      <span>{row.label}</span>
                      <span className="font-semibold">
                        {row.value} ({row.pct}%)
                      </span>
                    </div>
                    <div className={`h-2 overflow-hidden rounded-full ${row.track}`}>
                      <div className={`h-full rounded-full ${row.bar}`} style={{ width: `${row.pct}%` }} />
                    </div>
                  </div>
                ))}

                <DesempenhoPorHabilidadeChart
                  rows={desempenhoMensal.rowsBySkill}
                  title="Grafico por habilidade"
                  subtitle="Distribuicao mensal das habilidades registradas, mantendo barras horizontais."
                  emptyMessage="Nao ha habilidades suficientes para montar o grafico deste mes."
                />
              </div>
            ) : null}

            {desempenhoMensal.rowsByDay.length ? (
              <div className="mt-5 overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left">Dia</th>
                      <th className="px-3 py-2 text-left">Total</th>
                      <th className="px-3 py-2 text-left">Distribuicao</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {desempenhoMensal.rowsByDay.map((row) => (
                      <tr key={row.date}>
                        <td className="px-3 py-2">{fmtDate(row.date)}</td>
                        <td className="px-3 py-2">{row.total}</td>
                        <td className="px-3 py-2">
                          <div className="mb-1 flex h-2 overflow-hidden rounded-full bg-gray-100">
                            <div className="h-full bg-green-500" style={{ width: `${row.pctIndependente}%` }} />
                            <div className="h-full bg-amber-500" style={{ width: `${row.pctAjuda}%` }} />
                            <div className="h-full bg-rose-500" style={{ width: `${row.pctNaoFez}%` }} />
                          </div>
                          <p className="text-xs text-gray-600">
                            Indep: {row.independente} ({row.pctIndependente}%) | Ajuda: {row.ajuda} ({row.pctAjuda}
                            %) | Nao fez: {row.nao_fez} ({row.pctNaoFez}%)
                          </p>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </section>

          <section className="rounded-xl bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-[var(--marrom)]">Comportamentos do mes</h2>
              <p className="text-sm text-gray-600">{fmtMonth(monthRef)}</p>
            </div>
            {comportamentoMensal.total ? (
              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <div className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">Negativos</p>
                    <p className="text-lg font-semibold text-rose-700">
                      {comportamentoMensal.totalNegativo} ({comportamentoMensal.pctNegativo}%)
                    </p>
                  </div>
                  <div className="rounded-lg border border-green-100 bg-green-50 px-3 py-2 text-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-green-700">Positivos</p>
                    <p className="text-lg font-semibold text-green-700">
                      {comportamentoMensal.totalPositivo} ({comportamentoMensal.pctPositivo}%)
                    </p>
                  </div>
                  <div className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Resultado geral</p>
                    <p className="text-sm font-semibold text-amber-800">
                      Negativo: {comportamentoMensal.resultado.negativo} | Positivo:{" "}
                      {comportamentoMensal.resultado.positivo} | Parcial:{" "}
                      {comportamentoMensal.resultado.parcial}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-[var(--marrom)]">Top negativos</p>
                    {comportamentoMensal.topNegativo.length ? (
                      comportamentoMensal.topNegativo.map((item) => (
                        <p key={item.key} className="text-sm text-gray-700">
                          {item.label}: <span className="font-semibold">{item.value}</span>
                        </p>
                      ))
                    ) : (
                      <p className="text-sm text-gray-600">Sem registros negativos.</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-[var(--marrom)]">Top positivos</p>
                    {comportamentoMensal.topPositivo.length ? (
                      comportamentoMensal.topPositivo.map((item) => (
                        <p key={item.key} className="text-sm text-gray-700">
                          {item.label}: <span className="font-semibold">{item.value}</span>
                        </p>
                      ))
                    ) : (
                      <p className="text-sm text-gray-600">Sem registros positivos.</p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-sm text-gray-600">
                Nao ha comportamentos estruturados registrados nas devolutivas deste mes.
              </p>
            )}
          </section>

          <section className="rounded-xl bg-white p-4 shadow-sm">
            <h2 className="text-lg font-semibold text-[var(--marrom)]">Devolutivas recentes do mes</h2>
            <p className="mt-1 text-sm text-gray-600">
              Comentarios e registros clinicos feitos pelos profissionais no periodo selecionado.
            </p>
            <ul className="mt-3 space-y-2 text-sm text-gray-700">
              {(report.destaques.ultimasObservacoes || []).length ? (
                report.destaques.ultimasObservacoes.map((o, idx) => (
                  <li
                    key={`${o.data}-${o.terapeuta_nome}-${idx}`}
                    className="rounded-lg border border-gray-100 bg-gray-50 p-3"
                  >
                    <p className="text-xs text-gray-500">
                      {fmtDate(o.data)} - {o.terapeuta_nome} - {o.origem}
                    </p>
                    <p className="mt-1">{o.texto}</p>
                  </li>
                ))
              ) : (
                <li className="text-gray-500">Sem devolutiva registrada neste mes.</li>
              )}
            </ul>
          </section>
        </>
      ) : null}
    </main>
  );
}
