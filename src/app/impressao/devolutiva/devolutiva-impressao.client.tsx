"use client";

import { useEffect, useMemo, useState } from "react";
import { buildDesempenhoResumo } from "@/lib/relatorios/desempenho";
import {
  gerarRelatorioEvolutivoAction,
  type ActionResult,
} from "@/app/(protected)/relatorios/relatorios.actions";

type PeriodPreset = "1m" | "custom";
type ComportamentoResultado = "negativo" | "positivo" | "parcial";

type ImpressaoReport = {
  paciente: { id: number; nome: string; cpf: string };
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
  return new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function normalizeApiError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Erro ao carregar relatorio de impressao";
}

function unwrapAction<T>(result: ActionResult<T>): T {
  if (!result.ok) throw new Error(result.error || "Erro ao carregar relatorio de impressao");
  return result.data;
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

function DocumentField(props: {
  label: string;
  value: React.ReactNode;
  helper?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-[14px] border border-[#ddd1c4] bg-[#fffdfa] px-3 py-2.5 ${props.className ?? ""}`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#9c8a78]">{props.label}</p>
      <div className="mt-1.5 text-sm font-semibold leading-6 text-[#3d3127]">{props.value}</div>
      {props.helper ? <div className="mt-0.5 text-xs leading-5 text-slate-600">{props.helper}</div> : null}
    </div>
  );
}

function DocumentSection(props: { title: string; subtitle?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`document-section border border-[#ddd1c4] bg-white px-4 py-4 ${props.className ?? ""}`}>
      <div className="border-b border-[#ece2d8] pb-2">
        <h2 className="text-base font-semibold uppercase tracking-[0.08em] text-[#5e4632]">{props.title}</h2>
        {props.subtitle ? <p className="mt-1 text-sm leading-6 text-slate-600">{props.subtitle}</p> : null}
      </div>
      <div className="pt-3">{props.children}</div>
    </section>
  );
}

function splitLabelLines(label: string, maxChars = 16): string[] {
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

function AttendanceDistributionChart(props: { present: number; absent: number; other: number }) {
  const total = props.present + props.absent + props.other;
  const rows = [
    {
      key: "present",
      label: "Presencas confirmadas",
      value: props.present,
      pct: total ? Math.round((props.present / total) * 100) : 0,
      color: "#4cc8d3",
    },
    {
      key: "absent",
      label: "Ausencias",
      value: props.absent,
      pct: total ? Math.round((props.absent / total) * 100) : 0,
      color: "#ff6b8a",
    },
    {
      key: "other",
      label: "Nao informado",
      value: props.other,
      pct: total ? Math.round((props.other / total) * 100) : 0,
      color: "#f2c94c",
    },
  ];

  const donutStyle = {
    background: `conic-gradient(${rows[0].color} 0 ${rows[0].pct}%, ${rows[1].color} ${rows[0].pct}% ${
      rows[0].pct + rows[1].pct
    }%, ${rows[2].color} ${rows[0].pct + rows[1].pct}% 100%)`,
  };

  return (
    <div className="rounded-[16px] border border-[#e7ddd2] bg-[#fcfaf7] p-3">
      <div className="grid items-center gap-2 sm:grid-cols-[128px_minmax(0,1fr)]">
        <div className="relative mx-auto h-24 w-24 rounded-full sm:h-24 sm:w-24" style={donutStyle}>
          <div className="absolute inset-[11px] flex flex-col items-center justify-center rounded-full bg-[#fcfaf7] text-center">
            <p className="text-2xl font-bold leading-none text-[#3d4960]">{total}</p>
          </div>
        </div>

        <div className="space-y-1">
          {rows.map((row) => (
            <div key={row.key} className="flex items-center justify-between gap-2 border-b border-[#eee4d8] pb-1 text-[13px] text-slate-700 last:border-b-0 last:pb-0">
              <div className="flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: row.color }} />
                <span className="font-medium">{row.label}</span>
              </div>
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#7c6a58]">
                {row.pct}% | {row.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
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
    return <p className="text-sm leading-7 text-slate-700">Nao ha habilidades suficientes para gerar o grafico neste periodo.</p>;
  }

  const chartHeight = 220;
  const chartTop = 22;
  const chartBottom = 78;
  const leftPad = 42;
  const rightPad = 14;
  const groupWidth = 74;
  const barWidth = 12;
  const groupBarGap = 4;
  const svgWidth = leftPad + props.rows.length * groupWidth + rightPad;
  const svgHeight = chartTop + chartHeight + chartBottom;
  const yLevels = [0, 25, 50, 75, 100];

  const yForPct = (pct: number) => chartTop + chartHeight - (chartHeight * pct) / 100;

  return (
    <div className="avoid-break space-y-4 rounded-[18px] border border-[#e7ddd2] bg-[#fcfaf7] p-4">
      <div className="flex flex-wrap gap-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7c6a58]">
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[#1f6fb2]" />
          Independente
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[#e5a93b]" />
          Com ajuda
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[#d95550]" />
          Nao fez
        </span>
      </div>

      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="block w-full"
        preserveAspectRatio="xMinYMin meet"
        role="img"
        aria-label="Grafico de barras por habilidade trabalhada"
      >
        <rect x="0" y="0" width={svgWidth} height={svgHeight} rx="18" fill="#fcfaf7" />

        {yLevels.map((level) => {
          const y = yForPct(level);
          return (
            <g key={level}>
              <line x1={leftPad} y1={y} x2={svgWidth - rightPad} y2={y} stroke="#ddd1c4" strokeWidth="1" />
              <text x={leftPad - 8} y={y + 4} textAnchor="end" fontSize="10.5" fill="#7c6a58">
                {level}%
              </text>
            </g>
          );
        })}

        <line x1={leftPad} y1={chartTop} x2={leftPad} y2={chartTop + chartHeight} stroke="#bda996" strokeWidth="1.2" />
        <line
          x1={leftPad}
          y1={chartTop + chartHeight}
          x2={svgWidth - rightPad}
          y2={chartTop + chartHeight}
          stroke="#bda996"
          strokeWidth="1.2"
        />

        {props.rows.map((row, index) => {
          const groupX = leftPad + index * groupWidth + 12;
          const x1 = groupX;
          const x2 = x1 + barWidth + groupBarGap;
          const x3 = x2 + barWidth + groupBarGap;
          const labelLines = splitLabelLines(row.label, 13);
          const labelX = groupX + barWidth + groupBarGap;

          return (
            <g key={row.key}>
              <rect
                x={x1}
                y={yForPct(row.pctIndependente)}
                width={barWidth}
                height={(chartHeight * row.pctIndependente) / 100}
                fill="#1f6fb2"
                rx="2"
              />
              <rect
                x={x2}
                y={yForPct(row.pctAjuda)}
                width={barWidth}
                height={(chartHeight * row.pctAjuda) / 100}
                fill="#e5a93b"
                rx="2"
              />
              <rect
                x={x3}
                y={yForPct(row.pctNaoFez)}
                width={barWidth}
                height={(chartHeight * row.pctNaoFez) / 100}
                fill="#d95550"
                rx="2"
              />

              <text x={labelX} y={chartTop + chartHeight + 16} textAnchor="middle" fontSize="9.8" fill="#4d392a" fontWeight="600">
                {labelLines.map((line, lineIndex) => (
                  <tspan key={`${row.key}-${lineIndex}`} x={labelX} dy={lineIndex === 0 ? 0 : 11}>
                    {line}
                  </tspan>
                ))}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="grid gap-2 text-xs text-slate-600 sm:grid-cols-3">
        <p>Azul: respostas independentes.</p>
        <p>Amarelo: execucao com ajuda.</p>
        <p>Vermelho: metas nao realizadas.</p>
      </div>
    </div>
  );
}

function BehaviorHorizontalChart(props: {
  rows: Array<{
    key: string;
    label: string;
    value: number;
  }>;
}) {
  if (!props.rows.length) {
    return <p className="text-sm leading-7 text-slate-700">Nao ha comportamentos estruturados suficientes para gerar o grafico neste periodo.</p>;
  }

  const maxValue = Math.max(...props.rows.map((row) => row.value), 1);
  const leftPad = 138;
  const rightPad = 28;
  const topPad = 10;
  const bottomPad = 8;
  const rowGap = 24;
  const barHeight = 10;
  const chartWidth = 680;
  const chartHeight = topPad + bottomPad + props.rows.length * rowGap;
  const barWidth = chartWidth - leftPad - rightPad;

  return (
    <div className="avoid-break rounded-[18px] border border-[#e7ddd2] bg-[#fcfaf7] p-4">
      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        className="block w-full"
        preserveAspectRatio="xMinYMin meet"
        role="img"
        aria-label="Grafico horizontal de comportamentos observados"
      >
        <rect x="0" y="0" width={chartWidth} height={chartHeight} rx="14" fill="#fcfaf7" />

        {props.rows.map((row, index) => {
          const y = topPad + index * rowGap;
          const fillWidth = Math.max((row.value / maxValue) * barWidth, row.value > 0 ? 6 : 0);
          return (
            <g key={row.key}>
              <text x="0" y={y + 9} fontSize="11.5" fill="#4d392a" fontWeight="500">
                {row.label}
              </text>
              <rect
                x={leftPad}
                y={y}
                width={barWidth}
                height={barHeight}
                rx="4"
                fill="#ffffff"
                stroke="#e2d7cb"
              />
              <rect
                x={leftPad}
                y={y}
                width={fillWidth}
                height={barHeight}
                rx="4"
                fill="#1f6fb2"
              />
              <text x={chartWidth - 2} y={y + 9} textAnchor="end" fontSize="11.5" fill="#4d392a" fontWeight="700">
                {row.value}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function DevolutivaImpressaoClient(props: {
  pacienteId: number;
  pacienteNome: string;
  canExportDocx?: boolean;
}) {
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>("1m");
  const [referenceMonth, setReferenceMonth] = useState(ymNow());
  const [customFrom, setCustomFrom] = useState(() => monthRange(ymNow())?.from ?? "");
  const [customTo, setCustomTo] = useState(() => monthRange(ymNow())?.to ?? "");
  const [loading, setLoading] = useState(false);
  const [exportingDocx, setExportingDocx] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [report, setReport] = useState<ImpressaoReport | null>(null);

  const selectedRange = useMemo(() => {
    if (periodPreset === "custom") {
      if (!customFrom || !customTo || customFrom > customTo) return null;
      return { from: customFrom, to: customTo };
    }
    return presetRange(referenceMonth, 1);
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
  const topSkillRows = desempenhoResumo.rowsBySkill.slice(0, 8);
  const behaviorRows = comportamentoResumo.rowsGeral.slice(0, 10);

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
    if (!selectedRange) {
      setMsg(periodPreset === "custom" ? "Periodo invalido." : "Referencia invalida.");
      return;
    }
    setLoading(true);
    setMsg(null);
    try {
      const data = unwrapAction(
        await gerarRelatorioEvolutivoAction({
          pacienteId: props.pacienteId,
          from: selectedRange.from,
          to: selectedRange.to,
        })
      );
      setReport(data.report as ImpressaoReport);
    } catch (error) {
      setReport(null);
      setMsg(normalizeApiError(error));
    } finally {
      setLoading(false);
    }
  }

  async function exportDocx() {
    if (!query) {
      setMsg(periodPreset === "custom" ? "Periodo invalido." : "Referencia invalida.");
      return;
    }

    setExportingDocx(true);
    setMsg(null);

    try {
      const resp = await fetch(`/api/relatorios/evolutivo/docx?${query}`);
      if (!resp.ok) {
        const json = (await resp.json().catch(() => null)) as unknown;
        throw new Error(readApiError(json) || "Falha ao gerar DOCX");
      }

      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `relatorio-devolutivo-${props.pacienteId}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 3000);
    } catch (error) {
      setMsg(normalizeApiError(error));
    } finally {
      setExportingDocx(false);
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
              Selecione o periodo, gere a pagina e use os botoes de exportacao para imprimir, salvar em PDF ou baixar
              o DOCX.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 xl:grid-cols-[220px_190px_190px_auto_auto_auto]">
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

            {props.canExportDocx ? (
              <button
                type="button"
                onClick={() => void exportDocx()}
                disabled={!query || exportingDocx}
                className="min-h-11 rounded-xl border border-[#4d392a] bg-[#4d392a] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#3c2d21] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {exportingDocx ? "Gerando DOCX..." : "Salvar DOCX"}
              </button>
            ) : null}
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
        <article className="print-page overflow-hidden rounded-[20px] border border-[#d8c7b8] bg-white">
          <header className="document-header px-6 pb-4 pt-5 sm:px-8">
            <div className="flex items-start justify-between gap-4 border-b border-[#e8ddd2] pb-4">
              <div className="space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#d1a06c]">Clinica Girassois</p>
                <h1 className="max-w-3xl text-2xl font-semibold uppercase tracking-[0.06em] text-[#4d392a] sm:text-3xl">
                  Relatorio devolutivo interdisciplinar
                </h1>
              </div>

              <div className="shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/girassois.svg"
                  alt="Clinica Girassois"
                  className="h-20 w-auto max-w-[180px] object-contain sm:h-24 sm:max-w-[220px]"
                />
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-[1.6fr_1fr_1fr]">
              <DocumentField
                label="Paciente"
                value={<p className="text-base font-semibold text-[#3d3127]">{report.paciente.nome}</p>}
              />
              <DocumentField
                label="Periodo avaliado"
                value={fmtPeriodLabel(report.periodo.from, report.periodo.to)}
                helper={`${fmtDate(report.periodo.from)} a ${fmtDate(report.periodo.to)}`}
              />
              <DocumentField label="Emissao" value={fmtNowPtBr()} />
            </div>
          </header>

          <div className="space-y-4 px-6 pb-5 sm:px-8">
            <DocumentSection title="Sintese clinica do periodo">
              <div className="space-y-2 text-sm leading-6 text-slate-700">
                {sinteseClinica.map((paragraph, index) => (
                  <p key={`${paragraph}-${index}`}>{paragraph}</p>
                ))}
              </div>
            </DocumentSection>

            <div className="grid items-start gap-5 xl:grid-cols-[1.15fr_0.85fr]">
              <DocumentSection title="Frequencia e continuidade assistencial">
                <div className="space-y-2.5">
                  <AttendanceDistributionChart
                    present={report.indicadores.presentes}
                    absent={report.indicadores.ausentes}
                    other={report.indicadores.naoInformado}
                  />

                  <div className="overflow-x-auto">
                    <table className="document-table min-w-full border-collapse text-[13px] text-slate-700">
                      <thead>
                        <tr className="bg-[#fbf6f0] text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-[#907b68]">
                          <th className="px-3 py-2">Indicador</th>
                          <th className="px-3 py-2">Valor</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#ece2d8]">
                        <tr>
                          <td className="px-3 py-2">Presencas confirmadas</td>
                          <td className="px-3 py-2 font-semibold">{report.indicadores.presentes}</td>
                        </tr>
                        <tr>
                          <td className="px-3 py-2">Ausencias</td>
                          <td className="px-3 py-2 font-semibold">{report.indicadores.ausentes}</td>
                        </tr>
                        <tr>
                          <td className="px-3 py-2">Nao informado</td>
                          <td className="px-3 py-2 font-semibold">{report.indicadores.naoInformado}</td>
                        </tr>
                        <tr>
                          <td className="px-3 py-2">Taxa de presenca</td>
                          <td className="px-3 py-2 font-semibold">{report.indicadores.taxaPresencaPercent}%</td>
                        </tr>
                        <tr>
                          <td className="px-3 py-2">Media por sessao</td>
                          <td className="px-3 py-2 font-semibold">{report.indicadores.mediaMinutosPorSessao} min</td>
                        </tr>
                        <tr>
                          <td className="px-3 py-2">Tempo clinico total</td>
                          <td className="px-3 py-2 font-semibold">{report.indicadores.tempoTotalMinutos} min</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </DocumentSection>

              <DocumentSection title="Intercorrencias e ausencias">
                <div className="space-y-3 text-sm text-slate-700">
                  {motivosAusencia.length ? (
                    motivosAusencia.map((item) => (
                      <div key={item.motivo} className="flex items-start justify-between gap-4 border-b border-[#eee4d8] pb-3">
                        <span className="leading-6">{item.motivo}</span>
                        <span className="min-w-10 text-right font-semibold">{item.count}</span>
                      </div>
                    ))
                  ) : (
                    <p className="leading-7">Nao houve faltas com motivo estruturado registrado no periodo.</p>
                  )}
                </div>
              </DocumentSection>
            </div>

            <DocumentSection title="Habilidades com maior volume de registro">
              {topSkillRows.length ? (
                <div className="space-y-4">
                  <SkillDistributionChart rows={topSkillRows} />

                  <div className="overflow-x-auto">
                    <table className="document-table min-w-full border-collapse text-sm text-slate-700">
                      <thead>
                        <tr className="bg-[#fbf6f0] text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-[#907b68]">
                          <th className="px-3 py-3">Habilidade</th>
                          <th className="px-3 py-3">Registros</th>
                          <th className="px-3 py-3">Independente</th>
                          <th className="px-3 py-3">Com ajuda</th>
                          <th className="px-3 py-3">Nao fez</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#ece2d8]">
                        {topSkillRows.map((row) => (
                          <tr key={row.key}>
                            <td className="px-3 py-3 font-medium">{row.label}</td>
                            <td className="px-3 py-3">{row.total}</td>
                            <td className="px-3 py-3">{row.pctIndependente}%</td>
                            <td className="px-3 py-3">{row.pctAjuda}%</td>
                            <td className="px-3 py-3">{row.pctNaoFez}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <p className="text-sm leading-7 text-slate-700">Nao ha habilidades com volume suficiente para consolidacao neste recorte.</p>
              )}
            </DocumentSection>

            <DocumentSection title="Comportamentos observados">
              {behaviorRows.length ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <DocumentField
                      label="Total consolidado"
                      value={comportamentoResumo.total}
                      helper="Ocorrencias comportamentais com registro estruturado."
                    />
                    <DocumentField
                      label="Registros positivos"
                      value={comportamentoResumo.totalPositivo}
                      helper={`${comportamentoResumo.pctPositivo}% do total comportamental.`}
                    />
                    <DocumentField
                      label="Registros negativos"
                      value={comportamentoResumo.totalNegativo}
                      helper={`${comportamentoResumo.pctNegativo}% do total comportamental.`}
                    />
                  </div>

                  <BehaviorHorizontalChart
                    rows={behaviorRows.map((row) => ({
                      key: row.key,
                      label: row.label,
                      value: row.value,
                    }))}
                  />

                  <div className="overflow-x-auto">
                    <table className="document-table min-w-full border-collapse text-sm text-slate-700">
                      <thead>
                        <tr className="bg-[#fbf6f0] text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-[#907b68]">
                          <th className="px-3 py-3">Comportamento</th>
                          <th className="px-3 py-3">Registros</th>
                          <th className="px-3 py-3">Positivos</th>
                          <th className="px-3 py-3">Negativos</th>
                          <th className="px-3 py-3">Participacao</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#ece2d8]">
                        {behaviorRows.map((row) => (
                          <tr key={row.key}>
                            <td className="px-3 py-3 font-medium">{row.label}</td>
                            <td className="px-3 py-3">{row.value}</td>
                            <td className="px-3 py-3">{row.positivo}</td>
                            <td className="px-3 py-3">{row.negativo}</td>
                            <td className="px-3 py-3">{row.pct}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <p className="text-sm leading-7 text-slate-700">Nao ha comportamentos estruturados suficientes para consolidacao neste periodo.</p>
              )}
            </DocumentSection>

            <DocumentSection title="Observacoes clinicas selecionadas">
              {feedbackItems.length ? (
                <div className="space-y-3">
                  {feedbackItems.map((item, index) => (
                    <article
                      key={`${item.data}-${item.terapeuta_nome}-${index}`}
                      className="border border-[#e7ddd2] bg-[#fffdfa] px-4 py-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8b7764]">
                        <span>{fmtDate(item.data)}</span>
                        <span>{item.terapeuta_nome || "Profissional"}</span>
                        <span>{item.origem || "registro clinico"}</span>
                      </div>
                      <p className="mt-3 text-sm leading-7 text-slate-700">{item.texto || "-"}</p>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="text-sm leading-7 text-slate-700">Sem observacoes textuais selecionadas para o periodo analisado.</p>
              )}
            </DocumentSection>
          </div>

          <footer className="border-t border-[#e4d3c1] bg-[#fcfaf7]">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 px-6 py-2 text-[13px] leading-5 text-[#6b4a4a] sm:px-8">
              <span className="inline-flex items-center gap-2 whitespace-nowrap">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#d7a269]" />
                (65) 3622-2826
              </span>
              <span className="inline-flex items-center gap-2 whitespace-nowrap">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#d7a269]" />
                @clinicagirassois
              </span>
              <span className="inline-flex items-center gap-2 whitespace-nowrap">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#d7a269]" />
                girassoisclinica@gmail.com
              </span>
            </div>
            <div className="bg-[#6f111b] px-6 py-2 text-center text-[13px] font-medium leading-5 text-white sm:px-8">
              Av. Portugal, 337 - Jardim Tropical, Cuiaba - MT, 78065-145
            </div>
          </footer>
        </article>
      ) : null}

      <style jsx global>{`
        @page {
          size: A4;
          margin: 12mm 10mm 14mm 10mm;
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
