"use client";

import { useEffect, useMemo, useState } from "react";
import { DailyTimeline } from "@/components/reports/daily-timeline";
import { RecentFeedbackList } from "@/components/reports/recent-feedback-list";
import { ReportSectionTabs } from "@/components/reports/report-section-tabs";
import { ReportSummaryCards } from "@/components/reports/report-summary-cards";
import { SkillsGrid } from "@/components/reports/skills-grid";
import { buildDesempenhoResumo } from "@/lib/relatorios/desempenho";
import {
  gerarRelatorioEvolutivoAction,
  type ActionResult,
} from "@/app/(protected)/relatorios/relatorios.actions";

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
    ultimasObservacoes: Array<{
      data: string;
      profissional_nome?: string | null;
      texto: string;
      origem: string;
    }>;
  };
  atendimentos: Array<{
    id: number;
    data: string;
    hora_inicio?: string | null;
    hora_fim?: string | null;
    profissional_nome?: string | null;
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
type PeriodPreset = "1m" | "custom";

function ymdFromLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function ymNow(): string {
  return ymdFromLocalDate(new Date()).slice(0, 7);
}

function addMonths(ym: string, offset: number): string | null {
  if (!/^\d{4}-\d{2}$/.test(ym)) return null;
  const [ys, ms] = ym.split("-");
  const year = Number(ys);
  const month = Number(ms);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return null;
  const d = new Date(year, month - 1 + offset, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
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

function presetRange(referenceMonth: string, months: number): { from: string; to: string } | null {
  const end = monthRange(referenceMonth);
  if (!end) return null;
  const startMonth = addMonths(referenceMonth, -(months - 1));
  if (!startMonth) return null;
  const start = monthRange(startMonth);
  if (!start) return null;
  return { from: start.from, to: end.to };
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

function fmtPeriodLabel(from?: string | null, to?: string | null): string {
  if (!from || !to) return "periodo selecionado";
  const fromMonth = from.slice(0, 7);
  const toMonth = to.slice(0, 7);
  if (fromMonth === toMonth) return fmtMonth(fromMonth);
  return `${fmtMonth(fromMonth)} a ${fmtMonth(toMonth)}`;
}

function normalizeApiError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Erro ao consultar devolutiva do periodo";
}

function unwrapAction<T>(result: ActionResult<T>): T {
  if (!result.ok) throw new Error(result.error || "Erro ao consultar devolutiva do periodo");
  return result.data;
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
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>("1m");
  const [referenceMonth, setReferenceMonth] = useState(ymNow());
  const [customFrom, setCustomFrom] = useState(() => monthRange(ymNow())?.from ?? "");
  const [customTo, setCustomTo] = useState(() => monthRange(ymNow())?.to ?? "");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [copyMsg, setCopyMsg] = useState<string | null>(null);
  const [report, setReport] = useState<MensalReport | null>(null);

  const selectedRange = useMemo(() => {
    if (periodPreset === "custom") {
      if (!customFrom || !customTo || customFrom > customTo) return null;
      return { from: customFrom, to: customTo };
    }
    return presetRange(referenceMonth, 1);
  }, [customFrom, customTo, periodPreset, referenceMonth]);

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
    lines.push(`Resumo do periodo de ${props.pacienteNome} (${fmtPeriodLabel(report.periodo.from, report.periodo.to)}).`);
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
  }, [desempenhoMensal, props.pacienteNome, report]);

  const feedbackItems = useMemo(() => {
    return (report?.destaques?.ultimasObservacoes || []).map((item, index) => ({
      id: `${item.data}-${item.profissional_nome}-${index}`,
      dateLabel: fmtDate(item.data),
      professional: item.profissional_nome || "Profissional",
      origin: item.origem || "devolutiva",
      text: item.texto || "",
    }));
  }, [report]);

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
      setCopyMsg("Resumo do periodo copiado.");
      setTimeout(() => setCopyMsg(null), 1800);
    } catch {
      setCopyMsg("Nao foi possivel copiar.");
      setTimeout(() => setCopyMsg(null), 2200);
    }
  }

  async function consultar() {
    if (!selectedRange) {
      setMsg(periodPreset === "custom" ? "Periodo invalido." : "Referencia invalida.");
      return;
    }
    setLoading(true);
    setMsg(null);
    setCopyMsg(null);
    try {
      const filters = {
        pacienteId: props.pacienteId,
        from: selectedRange.from,
        to: selectedRange.to,
      };
      const data = unwrapAction(await gerarRelatorioEvolutivoAction(filters));
      setReport(data.report as MensalReport);
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
    <main className="space-y-4">
      <section className="rounded-[24px] border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-gray-600">Periodo</h2>
            <p className="hidden text-sm text-gray-700 sm:block">
              Escolha o mes de referencia ou use intervalo personalizado.
            </p>
          </div>

          <div className="flex w-full flex-col gap-3 lg:w-auto">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[200px_180px_180px_auto]">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-semibold text-[var(--marrom)]">Tipo de periodo</span>
                <select
                  value={periodPreset}
                  onChange={(event) => {
                    const next = event.target.value as PeriodPreset;
                    if (next === "custom" && selectedRange) {
                      setCustomFrom(selectedRange.from);
                      setCustomTo(selectedRange.to);
                    }
                    setPeriodPreset(next);
                  }}
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-[var(--laranja)] focus:ring-2 focus:ring-amber-100"
                >
                  <option value="1m">1 mes</option>
                  <option value="custom">Personalizado</option>
                </select>
              </label>

              {periodPreset === "custom" ? (
                <>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-semibold text-[var(--marrom)]">Inicio</span>
                    <input
                      type="date"
                      value={customFrom}
                      onChange={(event) => setCustomFrom(event.target.value)}
                      className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-[var(--laranja)] focus:ring-2 focus:ring-amber-100"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-semibold text-[var(--marrom)]">Fim</span>
                    <input
                      type="date"
                      value={customTo}
                      onChange={(event) => setCustomTo(event.target.value)}
                      className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-[var(--laranja)] focus:ring-2 focus:ring-amber-100"
                    />
                  </label>
                </>
              ) : (
                <label className="flex flex-col gap-1.5 sm:col-span-2">
                  <span className="text-sm font-semibold text-[var(--marrom)]">Mes de referencia</span>
                  <input
                    type="month"
                    value={referenceMonth}
                    onChange={(event) => setReferenceMonth(event.target.value)}
                    className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-[var(--laranja)] focus:ring-2 focus:ring-amber-100"
                  />
                </label>
              )}

              <button
                type="button"
                onClick={() => void consultar()}
                disabled={loading}
                className="min-h-10 rounded-xl bg-[var(--laranja)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#e6961f] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Consultar periodo
              </button>
            </div>

            {selectedRange ? (
              <p className="text-xs text-gray-500">
                Recorte atual: {fmtDate(selectedRange.from)} a {fmtDate(selectedRange.to)}.
              </p>
            ) : null}
          </div>
        </div>
      </section>

      {msg ? <p className="text-sm text-red-600">{msg}</p> : null}

      {loading ? (
        <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-700">Carregando relatorio do periodo...</p>
        </section>
      ) : null}

      {report ? (
        <>
          <ReportSectionTabs
            items={[
              { id: "resumo", label: "Resumo" },
              { id: "habilidades", label: "Habilidades", badge: desempenhoMensal.rowsBySkill.length },
              { id: "devolutivas", label: "Devolutivas", badge: feedbackItems.length },
              { id: "comportamentos", label: "Comport.", badge: comportamentoMensal.total },
              { id: "evolucao", label: "Evolucao", badge: desempenhoMensal.rowsByDay.length },
            ]}
          />

          <section id="resumo" className="scroll-mt-24 rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-[var(--marrom)] sm:text-lg">Resumo rapido</h2>
                <p className="mt-1 text-sm text-gray-700">
                  {desempenhoMensal.total
                    ? `${desempenhoMensal.total} metas avaliadas em ${desempenhoMensal.diasComRegistro} dia(s).`
                    : "Sem metas estruturadas nas devolutivas deste periodo."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void copiarResumo()}
                disabled={!resumoMensal}
                className="rounded-xl border border-[var(--laranja)] px-3 py-2 text-sm font-semibold text-[var(--laranja)] transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Copiar resumo
              </button>
            </div>
            {copyMsg ? (
              <p className={`mt-2 text-xs ${copyMsg.includes("Nao") ? "text-red-600" : "text-green-700"}`}>{copyMsg}</p>
            ) : null}

            <div className="mt-4">
              <ReportSummaryCards
                compact
                columns={3}
                items={desempenhoMensal.rows.map((row) => ({
                  label: row.label,
                  value: row.value,
                  description: `${row.pct}% do total avaliado.`,
                  tone: row.key === "independente" ? "success" : row.key === "ajuda" ? "warning" : "danger",
                }))}
              />
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
              <p className="text-sm text-gray-700">
                Periodo: {fmtDate(report.periodo.from)} a {fmtDate(report.periodo.to)}.
                {report.indicadores.primeiroAtendimento ? (
                  <> Primeiro atendimento: {fmtDate(report.indicadores.primeiroAtendimento)}.</>
                ) : null}
                {report.indicadores.ultimoAtendimento ? (
                  <> Ultimo atendimento: {fmtDate(report.indicadores.ultimoAtendimento)}.</>
                ) : null}
              </p>
              <details className="mt-3">
                <summary className="cursor-pointer text-sm font-semibold text-[var(--laranja)]">Ver resumo textual</summary>
                <p className="mt-2 whitespace-pre-line text-sm leading-6 text-gray-700">{resumoMensal}</p>
              </details>
            </div>
          </section>

          <SkillsGrid
            sectionId="habilidades"
            compact
            rows={desempenhoMensal.rowsBySkill}
            title="Habilidades trabalhadas"
            subtitle="Cards compactos com barra empilhada para comparar rapidamente o desempenho em cada habilidade."
            emptyMessage="Nao ha habilidades suficientes para montar o grafico deste periodo."
          />

          <section id="devolutivas" className="scroll-mt-24 rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-[var(--marrom)] sm:text-lg">Devolutivas recentes</h2>
                <p className="mt-1 text-sm text-gray-700">
                  Preview compacto com opcao de expandir o texto quando necessario.
                </p>
              </div>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-gray-600">
                {feedbackItems.length} item(ns)
              </span>
            </div>
            <RecentFeedbackList
              items={feedbackItems}
              previewLength={180}
              emptyMessage="Sem devolutiva registrada neste periodo."
            />
          </section>

          <section id="comportamentos" className="scroll-mt-24 rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-[var(--marrom)]">Comportamentos do periodo</h2>
                <p className="mt-1 text-sm text-gray-700">
                  Consolidado comportamental estruturado a partir das devolutivas do periodo selecionado.
                </p>
              </div>
              <p className="text-sm font-medium text-gray-600">{fmtPeriodLabel(report.periodo.from, report.periodo.to)}</p>
            </div>
            {comportamentoMensal.total ? (
              <div className="mt-4 space-y-4">
                <ReportSummaryCards
                  compact
                  columns={3}
                  items={[
                    {
                      label: "Negativos",
                      value: `${comportamentoMensal.totalNegativo} (${comportamentoMensal.pctNegativo}%)`,
                      description: "Ocorrencias classificadas como negativas no periodo.",
                      tone: "danger",
                    },
                    {
                      label: "Positivos",
                      value: `${comportamentoMensal.totalPositivo} (${comportamentoMensal.pctPositivo}%)`,
                      description: "Ocorrencias classificadas como positivas no periodo.",
                      tone: "success",
                    },
                    {
                      label: "Resultado geral",
                      value: `${comportamentoMensal.resultado.positivo}/${comportamentoMensal.resultado.parcial}/${comportamentoMensal.resultado.negativo}`,
                      description: "Positivo / Parcial / Negativo nas evolucoes.",
                      tone: "warning",
                    },
                  ]}
                />
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                  <div className="rounded-2xl border border-rose-100 bg-rose-50/50 p-4">
                    <p className="text-sm font-semibold text-[var(--marrom)]">Top negativos</p>
                    <div className="mt-3 space-y-2">
                      {comportamentoMensal.topNegativo.length ? (
                        comportamentoMensal.topNegativo.map((item) => (
                          <p key={item.key} className="text-sm text-gray-700">
                            {item.label}: <span className="font-semibold">{item.value}</span>
                          </p>
                        ))
                      ) : (
                        <p className="text-sm text-gray-700">Sem registros negativos.</p>
                      )}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4">
                    <p className="text-sm font-semibold text-[var(--marrom)]">Top positivos</p>
                    <div className="mt-3 space-y-2">
                      {comportamentoMensal.topPositivo.length ? (
                        comportamentoMensal.topPositivo.map((item) => (
                          <p key={item.key} className="text-sm text-gray-700">
                            {item.label}: <span className="font-semibold">{item.value}</span>
                          </p>
                        ))
                      ) : (
                        <p className="text-sm text-gray-700">Sem registros positivos.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-sm text-gray-700">
                Nao ha comportamentos estruturados registrados nas devolutivas deste periodo.
              </p>
            )}
          </section>

          <section id="evolucao" className="scroll-mt-24 rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-[var(--marrom)]">Evolucao por dia</h2>
                <p className="mt-1 text-sm text-gray-700">
                  No celular a distribuicao vira uma timeline compacta; no desktop a leitura analitica continua em tabela.
                </p>
              </div>
              <p className="text-sm font-medium text-gray-600">{fmtPeriodLabel(report.periodo.from, report.periodo.to)}</p>
            </div>
            <div className="mt-4">
              <DailyTimeline
                rows={desempenhoMensal.rowsByDay}
                formatDate={fmtDate}
                emptyMessage="Nao ha distribuicao diaria para este periodo."
              />
            </div>
          </section>
        </>
      ) : null}
    </main>
  );
}
