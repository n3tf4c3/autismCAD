"use client";

import { useEffect, useMemo, useState } from "react";
import { buildDesempenhoResumo } from "@/lib/relatorios/desempenho";

type PeriodPreset = "1m" | "3m" | "6m" | "12m" | "custom";
type ComportamentoResultado = "negativo" | "positivo" | "parcial";

type ImpressaoReport = {
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
  resumoAutomatico: { texto: string; regrasDisparadas: string[] };
  destaques: {
    ultimasObservacoes: Array<{ data: string; terapeuta_nome: string; texto: string; origem: string }>;
    principaisMotivosAusencia: Array<{ motivo: string; count: number }>;
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

type BehaviorRow = {
  key: string;
  label: string;
  value: number;
  pct: number;
  positivo: number;
  negativo: number;
};

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

function fmtNowPtBr(): string {
  return new Date().toLocaleString("pt-BR");
}

function normalizeApiError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Erro ao carregar relatorio de impressao";
}

function readApiError(json: unknown): string | null {
  if (!json || typeof json !== "object") return null;
  const record = json as Record<string, unknown>;
  return typeof record.error === "string" ? record.error : null;
}

function normalizeComportamentoResultado(value: unknown): ComportamentoResultado | null {
  if (typeof value !== "string") return null;
  const normalized = value.toLowerCase().trim().replace(/\s+/g, "_");
  if (normalized === "negativo" || normalized === "positivo" || normalized === "parcial") return normalized;
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
  return value.map((item) => String(item ?? "").trim()).filter(Boolean);
}

const COMPORTAMENTO_LABELS: Record<string, string> = {
  autoagressao: "Autoagressao",
  heteroagressao: "Hetero agressao",
  estereotipia_vocal: "Estereotipia vocal",
  estereotipia_motora: "Estereotipia motora",
  ecolalia_imediata: "Ecolalia imediata",
  ecolalia_tardia: "Ecolalia tardia",
  fugas_esquivas: "Fugas / esquivas",
  agitacao_motora: "Agitacao motora",
  demanda_atencao: "Demanda de atencao",
  crise_ausencia: "Crise de ausencia",
  isolamento: "Isolamento",
  comportamento_desafiador: "Comportamento desafiador",
  baixo_interesse: "Baixo interesse",
  desregulacao_emocional: "Desregulacao emocional",
  calmo: "Calmo",
  animado: "Animado",
  alto_interesse: "Alto interesse",
  foco_atencao: "Foco / atencao",
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

function buildChartWidth(pct: number): string {
  if (pct <= 0) return "0%";
  return `${Math.max(pct, 4)}%`;
}

function ScreenMetric(props: { label: string; value: string | number; helper: string }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{props.label}</p>
      <p className="mt-2 text-2xl font-bold text-[var(--marrom)]">{props.value}</p>
      <p className="mt-1 text-sm text-slate-600">{props.helper}</p>
    </article>
  );
}

function PrintSection(props: { title: string; subtitle?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-[28px] border border-[#eadfd6] bg-white p-5 ${props.className ?? ""}`}>
      <div className="mb-4 space-y-1">
        <h2 className="text-lg font-semibold text-[var(--marrom)]">{props.title}</h2>
        {props.subtitle ? <p className="text-sm text-slate-600">{props.subtitle}</p> : null}
      </div>
      {props.children}
    </section>
  );
}

function AttendanceChart(props: { present: number; absent: number; other: number }) {
  const total = props.present + props.absent + props.other;
  const pctPresent = total ? Math.round((props.present / total) * 100) : 0;
  const pctAbsent = total ? Math.round((props.absent / total) * 100) : 0;
  const pctOther = Math.max(0, 100 - pctPresent - pctAbsent);
  const donutStyle = {
    background: `conic-gradient(#1f7a8c 0 ${pctPresent}%, #ef4444 ${pctPresent}% ${pctPresent + pctAbsent}%, #f7b32b ${pctPresent + pctAbsent}% 100%)`,
  };

  const legend = [
    { label: "Presente", value: props.present, pct: pctPresent, color: "#1f7a8c" },
    { label: "Ausente", value: props.absent, pct: pctAbsent, color: "#ef4444" },
    { label: "Nao informado", value: props.other, pct: pctOther, color: "#f7b32b" },
  ];

  return (
    <div className="grid gap-5 md:grid-cols-[220px_1fr] md:items-center">
      <div className="mx-auto flex h-52 w-52 items-center justify-center rounded-full" style={donutStyle}>
        <div className="flex h-28 w-28 flex-col items-center justify-center rounded-full bg-white text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Frequencia</p>
          <p className="mt-1 text-2xl font-bold text-[var(--marrom)]">{total}</p>
          <p className="text-sm text-slate-500">atendimentos</p>
        </div>
      </div>

      <div className="space-y-3">
        {legend.map((item) => (
          <div key={item.label} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center justify-between gap-3 text-sm">
              <div className="flex items-center gap-2 font-semibold text-slate-700">
                <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                {item.label}
              </div>
              <span className="text-slate-600">
                {item.value} registro(s) - {item.pct}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function splitLabelLines(label: string, maxChars = 15): string[] {
  const words = label.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxChars) {
      current = next;
      return;
    }
    if (current) lines.push(current);
    current = word;
  });

  if (current) lines.push(current);
  return lines.slice(0, 3);
}

function SkillDistributionChart(props: {
  rows: Array<{
    key: string;
    label: string;
    total: number;
    ajuda: number;
    nao_fez: number;
    independente: number;
    pctAjuda: number;
    pctNaoFez: number;
    pctIndependente: number;
  }>;
}) {
  if (!props.rows.length) {
    return <p className="text-sm text-slate-600">Nao ha habilidades suficientes para o grafico deste periodo.</p>;
  }

  const chartHeight = 240;
  const chartTop = 24;
  const chartBottom = 76;
  const leftPad = 52;
  const rightPad = 24;
  const groupWidth = 92;
  const barWidth = 16;
  const groupBarGap = 4;
  const svgWidth = leftPad + props.rows.length * groupWidth + rightPad;
  const svgHeight = chartTop + chartHeight + chartBottom;
  const yLevels = [0, 25, 50, 75, 100];

  const yForPct = (pct: number) => chartTop + chartHeight - (chartHeight * pct) / 100;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[#1d70b8]" />
          Independente
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[#f7b32b]" />
          Com ajuda
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ef4444]" />
          Nao fez
        </span>
      </div>

      <div className="overflow-x-auto rounded-[24px] border border-slate-200 bg-slate-50 p-4">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="min-w-[780px]"
          role="img"
          aria-label="Grafico de barras verticais por habilidade"
        >
          {yLevels.map((level) => {
            const y = yForPct(level);
            return (
              <g key={level}>
                <line x1={leftPad} y1={y} x2={svgWidth - rightPad} y2={y} stroke="#d7dbe2" strokeWidth="1" />
                <text x={leftPad - 8} y={y + 4} textAnchor="end" fontSize="11" fill="#6b7280">
                  {level}%
                </text>
              </g>
            );
          })}

          <line
            x1={leftPad}
            y1={chartTop}
            x2={leftPad}
            y2={chartTop + chartHeight}
            stroke="#94a3b8"
            strokeWidth="1.2"
          />
          <line
            x1={leftPad}
            y1={chartTop + chartHeight}
            x2={svgWidth - rightPad}
            y2={chartTop + chartHeight}
            stroke="#94a3b8"
            strokeWidth="1.2"
          />

          {props.rows.map((row, index) => {
            const groupX = leftPad + index * groupWidth + 14;
            const firstBarX = groupX;
            const secondBarX = firstBarX + barWidth + groupBarGap;
            const thirdBarX = secondBarX + barWidth + groupBarGap;
            const labelLines = splitLabelLines(row.label);
            return (
              <g key={row.key}>
                <rect
                  x={firstBarX}
                  y={yForPct(row.pctIndependente)}
                  width={barWidth}
                  height={(chartHeight * row.pctIndependente) / 100}
                  fill="#1d70b8"
                  rx="2"
                />
                <rect
                  x={secondBarX}
                  y={yForPct(row.pctNaoFez)}
                  width={barWidth}
                  height={(chartHeight * row.pctNaoFez) / 100}
                  fill="#ef4444"
                  rx="2"
                />
                <rect
                  x={thirdBarX}
                  y={yForPct(row.pctAjuda)}
                  width={barWidth}
                  height={(chartHeight * row.pctAjuda) / 100}
                  fill="#f7b32b"
                  rx="2"
                />

                <text
                  x={groupX + barWidth + groupBarGap}
                  y={chartTop + chartHeight + 18}
                  textAnchor="middle"
                  fontSize="10.5"
                  fill="#334155"
                  fontWeight="600"
                >
                  {labelLines.map((line, lineIndex) => (
                    <tspan key={`${row.key}-${lineIndex}`} x={groupX + barWidth + groupBarGap} dy={lineIndex === 0 ? 0 : 12}>
                      {line}
                    </tspan>
                  ))}
                </text>
              </g>
            );
          })}
        </svg>

        <div className="mt-4 grid gap-2 text-xs text-slate-600 sm:grid-cols-3">
          <p>Azul: respostas independentes.</p>
          <p>Vermelho: metas nao realizadas.</p>
          <p>Amarelo: execucao com ajuda.</p>
        </div>
      </div>
    </div>
  );
}

function BehaviorRanking(props: { title: string; rows: BehaviorRow[]; barClass: string; empty: string }) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
      <h3 className="text-base font-semibold text-[var(--marrom)]">{props.title}</h3>
      <div className="mt-4 space-y-3">
        {props.rows.length ? (
          props.rows.map((row) => (
            <div key={row.key}>
              <div className="mb-1 flex items-center justify-between gap-3 text-sm text-slate-700">
                <span>{row.label}</span>
                <span className="font-semibold">
                  {row.value} ({row.pct}%)
                </span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-white">
                <div className={`h-full rounded-full ${props.barClass}`} style={{ width: buildChartWidth(row.pct) }} />
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-slate-600">{props.empty}</p>
        )}
      </div>
    </div>
  );
}

export function DevolutivaImpressaoClient(props: {
  pacienteId: number;
  pacienteNome: string;
}) {
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>("1m");
  const [referenceMonth, setReferenceMonth] = useState(ymNow());
  const [customFrom, setCustomFrom] = useState(() => monthRange(ymNow())?.from ?? "");
  const [customTo, setCustomTo] = useState(() => monthRange(ymNow())?.to ?? "");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [report, setReport] = useState<ImpressaoReport | null>(null);
  const [hideFooterLogo, setHideFooterLogo] = useState(false);

  const selectedRange = useMemo(() => {
    if (periodPreset === "custom") {
      if (!customFrom || !customTo || customFrom > customTo) return null;
      return { from: customFrom, to: customTo };
    }
    const monthsByPreset: Record<Exclude<PeriodPreset, "custom">, number> = {
      "1m": 1,
      "3m": 3,
      "6m": 6,
      "12m": 12,
    };
    return presetRange(referenceMonth, monthsByPreset[periodPreset]);
  }, [customFrom, customTo, periodPreset, referenceMonth]);

  const query = useMemo(() => {
    if (!selectedRange) return "";
    const search = new URLSearchParams();
    search.set("pacienteId", String(props.pacienteId));
    search.set("from", selectedRange.from);
    search.set("to", selectedRange.to);
    return search.toString();
  }, [props.pacienteId, selectedRange]);

  const desempenhoResumo = useMemo(() => buildDesempenhoResumo(report?.evolucoes), [report]);

  const comportamentoResumo = useMemo(() => {
    const resultado: Record<ComportamentoResultado, number> = {
      negativo: 0,
      positivo: 0,
      parcial: 0,
    };
    const mapNeg = new Map<string, { label: string; value: number }>();
    const mapPos = new Map<string, { label: string; value: number }>();

    const addItem = (side: "negativo" | "positivo", rawValue: string, qty: number) => {
      const key = normalizeComportamentoKey(rawValue);
      if (!key) return;
      const target = side === "negativo" ? mapNeg : mapPos;
      const current = target.get(key);
      if (current) {
        current.value += qty;
        return;
      }
      target.set(key, { label: behaviorLabelFromValue(rawValue), value: qty });
    };

    (report?.evolucoes || []).forEach((evolucao) => {
      const payload = evolucao?.payload;
      if (!payload || typeof payload !== "object") return;
      const comportamentoRaw = payload.comportamentos ?? payload.comportamento;
      if (!comportamentoRaw || typeof comportamentoRaw !== "object") return;
      const comportamento = comportamentoRaw as Record<string, unknown>;

      const result = normalizeComportamentoResultado(comportamento.resultado);
      if (result) resultado[result] += 1;

      const quantidades =
        comportamento.quantidades && typeof comportamento.quantidades === "object"
          ? (comportamento.quantidades as Record<string, unknown>)
          : null;
      const qtyNeg =
        quantidades?.negativo && typeof quantidades.negativo === "object"
          ? (quantidades.negativo as Record<string, unknown>)
          : null;
      const qtyPos =
        quantidades?.positivo && typeof quantidades.positivo === "object"
          ? (quantidades.positivo as Record<string, unknown>)
          : null;

      pickStringList(comportamento.negativos).forEach((item) => {
        const key = normalizeComportamentoKey(item);
        const qty = asPositiveInt((qtyNeg?.[item] ?? qtyNeg?.[key]) as unknown, 1);
        addItem("negativo", item, qty);
      });

      pickStringList(comportamento.positivos).forEach((item) => {
        const key = normalizeComportamentoKey(item);
        const qty = asPositiveInt((qtyPos?.[item] ?? qtyPos?.[key]) as unknown, 1);
        addItem("positivo", item, qty);
      });
    });

    const totalNegativo = Array.from(mapNeg.values()).reduce((acc, item) => acc + item.value, 0);
    const totalPositivo = Array.from(mapPos.values()).reduce((acc, item) => acc + item.value, 0);
    const total = totalNegativo + totalPositivo;
    const percent = (value: number, totalRef: number) => (totalRef ? Math.round((value / totalRef) * 100) : 0);

    const rowsNegativo = Array.from(mapNeg.entries())
      .map(([key, item]) => ({ key, label: item.label, value: item.value, pct: percent(item.value, totalNegativo), positivo: 0, negativo: item.value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    const rowsPositivo = Array.from(mapPos.entries())
      .map(([key, item]) => ({ key, label: item.label, value: item.value, pct: percent(item.value, totalPositivo), positivo: item.value, negativo: 0 }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    const allKeys = new Set([...mapNeg.keys(), ...mapPos.keys()]);
    const rowsGeral = Array.from(allKeys)
      .map((key) => {
        const neg = mapNeg.get(key)?.value ?? 0;
        const pos = mapPos.get(key)?.value ?? 0;
        const label = mapNeg.get(key)?.label ?? mapPos.get(key)?.label ?? key;
        return {
          key,
          label,
          value: neg + pos,
          pct: percent(neg + pos, total),
          positivo: pos,
          negativo: neg,
        };
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    return {
      total,
      totalNegativo,
      totalPositivo,
      pctNegativo: percent(totalNegativo, total),
      pctPositivo: percent(totalPositivo, total),
      resultado,
      rowsNegativo,
      rowsPositivo,
      rowsGeral,
    };
  }, [report]);

  const motivosAusencia = report?.destaques?.principaisMotivosAusencia ?? [];
  const feedbackItems = report?.destaques?.ultimasObservacoes ?? [];

  const sinteseClinica = useMemo(() => {
    if (!report) return [];
    const lines: string[] = [];
    lines.push(
      `Paciente acompanhado no periodo de ${fmtDate(report.periodo.from)} a ${fmtDate(report.periodo.to)}, com ${report.indicadores.totalAtendimentos} atendimento(s) registrado(s) e taxa de presenca de ${report.indicadores.taxaPresencaPercent}%.`
    );
    if (report.resumoAutomatico?.texto) {
      lines.push(...report.resumoAutomatico.texto.split("\n").map((line) => line.trim()).filter(Boolean));
    }
    if (desempenhoResumo.total) {
      const topSkill = desempenhoResumo.rowsBySkill[0];
      if (topSkill) {
        lines.push(
          `A habilidade com maior volume de avaliacao foi ${topSkill.label}, com ${topSkill.total} registro(s) e ${topSkill.pctIndependente}% de respostas independentes.`
        );
      }
    }
    if (comportamentoResumo.total) {
      const topNeg = comportamentoResumo.rowsNegativo[0];
      const topPos = comportamentoResumo.rowsPositivo[0];
      lines.push(
        `Foram consolidados ${comportamentoResumo.total} registro(s) comportamentais, sendo ${comportamentoResumo.totalPositivo} positivo(s) e ${comportamentoResumo.totalNegativo} negativo(s).`
      );
      if (topPos) lines.push(`Principal destaque positivo: ${topPos.label} (${topPos.value} ocorrencia(s)).`);
      if (topNeg) lines.push(`Principal ponto de atencao: ${topNeg.label} (${topNeg.value} ocorrencia(s)).`);
    }
    return lines;
  }, [comportamentoResumo, desempenhoResumo, report]);

  async function consultar() {
    if (!query) {
      setMsg(periodPreset === "custom" ? "Periodo invalido." : "Referencia invalida.");
      return;
    }
    setLoading(true);
    setMsg(null);
    try {
      const resp = await fetch(`/api/relatorios/evolutivo?${query}`, { cache: "no-store" });
      const json = (await resp.json().catch(() => null)) as unknown;
      if (!resp.ok) throw new Error(readApiError(json) || "Falha ao carregar relatorio");
      setReport(json as ImpressaoReport);
    } catch (error) {
      setReport(null);
      setMsg(normalizeApiError(error));
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
      <section className="print:hidden rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Parametros do relatorio</p>
            <h2 className="mt-2 text-lg font-semibold text-[var(--marrom)]">Recorte para impressao</h2>
            <p className="mt-1 text-sm text-slate-600">
              Selecione o periodo, gere a pagina e use o botao de impressao do navegador para salvar em PDF.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 xl:grid-cols-[220px_190px_190px_auto_auto]">
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
                <option value="3m">Trimestral</option>
                <option value="6m">Semestral</option>
                <option value="12m">Anual</option>
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
              <label className="flex flex-col gap-1.5 xl:col-span-2">
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
              className="min-h-11 rounded-xl bg-[var(--laranja)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#e6961f] disabled:cursor-not-allowed disabled:opacity-60"
            >
              Atualizar relatorio
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              disabled={!report}
              className="min-h-11 rounded-xl border border-[var(--laranja)] bg-white px-4 py-2 text-sm font-semibold text-[var(--laranja)] transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Imprimir / Salvar PDF
            </button>
          </div>

          {selectedRange ? (
            <p className="text-sm text-slate-500">
              Paciente: <span className="font-medium">{props.pacienteNome}</span> | Recorte atual: {fmtDate(selectedRange.from)} a {fmtDate(selectedRange.to)}.
            </p>
          ) : null}
        </div>
      </section>

      {msg ? <p className="print:hidden text-sm text-red-600">{msg}</p> : null}

      {loading ? (
        <section className="print:hidden rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-600">Carregando relatorio para impressao...</p>
        </section>
      ) : null}

      {report ? (
        <article className="print-page overflow-hidden rounded-[32px] border border-[#eadfd6] bg-white shadow-[0_30px_80px_rgba(102,73,44,0.15)] print:rounded-none print:border-0 print:shadow-none">
          <header className="border-b border-[#eadfd6] bg-[linear-gradient(180deg,#fffdf9_0%,#fbf6f0_100%)] px-6 py-6 sm:px-8">
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(280px,420px)] xl:items-start">
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#c89b67]">Clinica Girassois</p>
                  <h1 className="mt-2 max-w-xl text-3xl font-bold leading-tight text-[var(--marrom)] sm:text-4xl">
                    Relatorio Devolutivo para Impressao
                  </h1>
                  <p className="mt-2 max-w-2xl text-sm leading-8 text-slate-600 sm:text-base">
                    Documento resumido para acompanhamento interdisciplinar, com indicadores do periodo, devolutivas dos
                    profissionais e sintese clinica para compartilhamento com responsaveis e especialistas.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-3 xl:items-end">
                <div className="w-full rounded-[28px] bg-[linear-gradient(90deg,#101725_0%,#0c1a2d_100%)] px-5 py-4 text-right shadow-[0_8px_24px_rgba(15,23,42,0.25)]">
                  <p className="text-2xl font-bold tracking-wide text-[#efc7a3] sm:text-4xl">CLINICA GIRASSOIS</p>
                  <p className="mt-2 text-[10px] uppercase tracking-[0.32em] text-[#efc7a3] sm:text-[11px]">
                    Desenvolvimento infanto juvenil intervencao ABA e Denver
                  </p>
                </div>
                <div className="self-start rounded-full bg-[#f3e4d6] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--marrom)] xl:self-end">
                  Documento para encaminhamento clinico
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-2xl border border-[#eadfd6] bg-white/90 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Paciente</p>
                <p className="mt-2 break-words text-xl font-semibold leading-8 text-[var(--marrom)]">{report.paciente.nome}</p>
                <p className="mt-1 text-sm text-slate-600">ID #{report.paciente.id}</p>
              </div>
              <div className="rounded-2xl border border-[#eadfd6] bg-white/90 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Periodo</p>
                <p className="mt-2 text-xl font-semibold leading-8 text-[var(--marrom)]">
                  {fmtPeriodLabel(report.periodo.from, report.periodo.to)}
                </p>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  {fmtDate(report.periodo.from)} a {fmtDate(report.periodo.to)}
                </p>
              </div>
              <div className="rounded-2xl border border-[#eadfd6] bg-white/90 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Emissao</p>
                <p className="mt-2 break-words text-xl font-semibold leading-8 text-[var(--marrom)]">{fmtNowPtBr()}</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">Documento clinico para compartilhamento medico</p>
              </div>
            </div>
          </header>

          <div className="space-y-6 px-6 py-6 sm:px-8">
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <ScreenMetric
                label="Atendimentos"
                value={report.indicadores.totalAtendimentos}
                helper={`${report.indicadores.tempoTotalMinutos} min registrados no periodo.`}
              />
              <ScreenMetric
                label="Presenca"
                value={`${report.indicadores.taxaPresencaPercent}%`}
                helper={`${report.indicadores.presentes} presentes, ${report.indicadores.ausentes} ausentes.`}
              />
              <ScreenMetric
                label="Metas avaliadas"
                value={desempenhoResumo.total}
                helper={`${desempenhoResumo.diasComRegistro} dia(s) com registro de desempenho.`}
              />
              <ScreenMetric
                label="Comportamentos"
                value={comportamentoResumo.total}
                helper={`${comportamentoResumo.totalPositivo} positivos e ${comportamentoResumo.totalNegativo} negativos.`}
              />
            </section>

            <div className="grid gap-6 xl:grid-cols-[1.35fr_1fr]">
              <PrintSection
                title="Sintese clinica do periodo"
                subtitle="Texto pensado para leitura por neuro, psiquiatra, equipe interdisciplinar e responsaveis."
              >
                <div className="space-y-3 text-sm leading-7 text-slate-700">
                  {sinteseClinica.map((paragraph, index) => (
                    <p key={`${paragraph}-${index}`}>{paragraph}</p>
                  ))}
                </div>
              </PrintSection>

              <PrintSection
                title="Frequencia de atendimentos"
                subtitle="Distribuicao de presenca no periodo selecionado."
              >
                <AttendanceChart
                  present={report.indicadores.presentes}
                  absent={report.indicadores.ausentes}
                  other={report.indicadores.naoInformado}
                />
              </PrintSection>
            </div>

            <PrintSection
              title="Habilidades avaliadas"
              subtitle="Grafico em barras verticais com comparacao entre independencia, ajuda e nao realizacao por habilidade."
            >
              <SkillDistributionChart rows={desempenhoResumo.rowsBySkill.slice(0, 10)} />
            </PrintSection>

            <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
              <PrintSection
                title="Comportamentos apresentados"
                subtitle="Ranking consolidado das ocorrencias registradas nas evolucoes do periodo."
              >
                {comportamentoResumo.rowsGeral.length ? (
                  <div className="space-y-3">
                    {comportamentoResumo.rowsGeral.map((row) => (
                      <div key={row.key} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                        <div className="mb-1 flex items-center justify-between gap-3 text-sm text-slate-700">
                          <span className="font-semibold">{row.label}</span>
                          <span>
                            {row.value} total - {row.positivo} positivo(s) / {row.negativo} negativo(s)
                          </span>
                        </div>
                        <div className="flex h-3 overflow-hidden rounded-full bg-white">
                          <div className="bg-emerald-500" style={{ width: buildChartWidth(row.positivo ? Math.round((row.positivo / row.value) * 100) : 0) }} />
                          <div className="bg-rose-500" style={{ width: buildChartWidth(row.negativo ? Math.round((row.negativo / row.value) * 100) : 0) }} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-600">Nao ha comportamentos estruturados neste periodo.</p>
                )}
              </PrintSection>

              <div className="space-y-6">
                <BehaviorRanking
                  title="Top positivos"
                  rows={comportamentoResumo.rowsPositivo}
                  barClass="bg-emerald-500"
                  empty="Sem registros positivos estruturados."
                />
                <BehaviorRanking
                  title="Top negativos"
                  rows={comportamentoResumo.rowsNegativo}
                  barClass="bg-rose-500"
                  empty="Sem registros negativos estruturados."
                />
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
              <PrintSection
                title="Devolutivas selecionadas"
                subtitle="Recortes recentes das observacoes registradas pelos profissionais."
              >
                {feedbackItems.length ? (
                  <div className="space-y-3">
                    {feedbackItems.map((item, index) => (
                      <article key={`${item.data}-${item.terapeuta_nome}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                          <span>{fmtDate(item.data)}</span>
                          <span>{item.terapeuta_nome || "Profissional"}</span>
                          <span>{item.origem || "devolutiva"}</span>
                        </div>
                        <p className="mt-3 text-sm leading-7 text-slate-700">{item.texto || "-"}</p>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-600">Sem devolutivas textuais registradas no periodo.</p>
                )}
              </PrintSection>

              <PrintSection
                title="Alertas e pontos de atencao"
                subtitle="Itens de ausencia e observacoes rapidas para acompanhamento."
              >
                <div className="space-y-4">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-[var(--marrom)]">Motivos de ausencia</p>
                    <div className="mt-3 space-y-2 text-sm text-slate-700">
                      {motivosAusencia.length ? (
                        motivosAusencia.map((item) => (
                          <div key={item.motivo} className="flex items-center justify-between gap-3">
                            <span>{item.motivo}</span>
                            <span className="font-semibold">{item.count}</span>
                          </div>
                        ))
                      ) : (
                        <p>Sem faltas com motivo registrado.</p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-[var(--marrom)]">Dados de sessao</p>
                    <div className="mt-3 grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
                      <p>Primeiro atendimento: {fmtDate(report.indicadores.primeiroAtendimento)}</p>
                      <p>Ultimo atendimento: {fmtDate(report.indicadores.ultimoAtendimento)}</p>
                      <p>Media por sessao: {report.indicadores.mediaMinutosPorSessao} min</p>
                      <p>Total de tempo clinico: {report.indicadores.tempoTotalMinutos} min</p>
                    </div>
                  </div>
                </div>
              </PrintSection>
            </div>
          </div>

          <footer className="border-t border-[#eadfd6] bg-[#fffaf6]">
            <div className="grid gap-4 px-6 py-5 text-sm text-[#b19898] sm:grid-cols-[1.3fr_1fr] sm:px-8">
              <div className="space-y-2">
                <p className="text-sm font-semibold tracking-[0.2em] text-[#d8b18a]">CLINICA GIRASSOIS</p>
                <p>(65) 3622-2826</p>
                <p>@clinicagirassois</p>
                <p>girassoisclinica@gmail.com</p>
              </div>
              <div className="flex items-end justify-start sm:justify-end">
                <div className="text-right">
                  {!hideFooterLogo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src="/logo-girassois.png"
                      alt="Logo Clinica Girassois"
                      className="ml-auto h-20 w-auto object-contain"
                      onError={() => setHideFooterLogo(true)}
                    />
                  ) : (
                    <>
                      <p className="text-sm font-semibold tracking-[0.2em] text-[#d8b18a]">DOCUMENTO CLINICO</p>
                      <p className="mt-2 max-w-[260px] text-xs leading-6 sm:text-sm">
                        Material de acompanhamento para compartilhamento com medico e equipe interdisciplinar.
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="bg-[#b09097] px-6 py-4 text-center text-base font-semibold text-white sm:px-8">
              Av. Portugal, 337 - Jardim Tropical, Cuiaba - MT, 78065-145
            </div>
          </footer>
        </article>
      ) : null}

      <style jsx global>{`
        @page {
          size: A4;
          margin: 12mm;
        }

        @media print {
          html,
          body {
            background: #ffffff !important;
          }

          .print-page {
            width: auto !important;
            margin: 0 !important;
          }
        }
      `}</style>
    </main>
  );
}
