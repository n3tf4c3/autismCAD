"use client";

import { useEffect, useMemo, useState } from "react";
import { gerarRelatorioPlanoEnsinoAction } from "@/app/(protected)/relatorios/relatorios.actions";
import {
  normalizeRelatorioApiError,
  unwrapRelatorioAction,
} from "@/lib/relatorios/client-errors";

type PeriodPreset = "1m" | "custom";
type DesempenhoKey = "ajuda" | "nao_fez" | "independente";
type EnsinoDesempenhoRow = {
  evolucaoId: number;
  data: string;
  ensino: string | null;
  desempenho: DesempenhoKey | null;
  ajuda: string | null;
  tentativas: number;
  acertos: number;
};

type PlanoEnsinoReport = {
  paciente: {
    id: number;
    nome: string;
    cpf: string | null;
    dataNascimento: string | null;
  };
  periodo: { from: string; to: string };
  resumo: {
    totalPlanos: number;
    totalBlocos: number;
    status: Array<{ label: string; total: number }>;
    especialidades: Array<{ label: string; total: number }>;
    ultimoPlano:
      | {
          id: number;
          version: number;
          status: string;
          titulo: string;
          especialidade: string | null;
          dataInicio: string | null;
          dataFinal: string | null;
          totalBlocos: number;
          autorNome: string;
          createdAt: string | null;
          updatedAt: string | null;
        }
      | null;
  };
  planos: Array<{
    id: number;
    version: number;
    status: string;
    titulo: string;
    especialidade: string | null;
    dataInicio: string | null;
    dataFinal: string | null;
    totalBlocos: number;
    autorNome: string;
    createdAt: string | null;
    updatedAt: string | null;
    blocos: Array<{
      habilidade: string | null;
      ensino: string | null;
      objetivoEnsino: string | null;
      recursos: string | null;
      procedimento: string | null;
      suportes: string | null;
      alvo: string | null;
      objetivoEspecifico: string | null;
      criterioSucesso: string | null;
    }>;
  }>;
  desempenhoEnsino: EnsinoDesempenhoRow[];
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
  const dateOnly = String(value).slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) {
    return `${dateOnly.slice(8, 10)}/${dateOnly.slice(5, 7)}/${dateOnly.slice(0, 4)}`;
  }
  const d = new Date(String(value));
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

function readApiError(json: unknown): string | null {
  if (!json || typeof json !== "object") return null;
  const record = json as Record<string, unknown>;
  return typeof record.error === "string" ? record.error : null;
}

const AJUDA_LEGENDA = [
  { code: "MOD", label: "Modelo" },
  { code: "INS", label: "Instrucao" },
  { code: "SV", label: "Suporte Verbal" },
  { code: "SVG", label: "Suporte Verbal Gestual" },
  { code: "SG", label: "Suporte Gestual" },
  { code: "SFP", label: "Suporte Fisico Parcial" },
  { code: "SFT", label: "Suporte Fisico Total" },
] as const;

function fmtDateCompact(value?: string | null): string {
  if (!value) return "-";
  const dateOnly = String(value).slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOnly);
  if (!match) return fmtDate(value);
  const month = Number(match[2]);
  const labels = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const monthLabel = labels[month - 1] ?? match[2];
  return `${match[3]}/${monthLabel}`;
}

function desempenhoLabel(value: DesempenhoKey | null): string {
  if (value === "nao_fez") return "Nao faz";
  if (value === "ajuda") return "Ajuda";
  if (value === "independente") return "Independente";
  return "-";
}

function AcertividadeChart(props: { rows: EnsinoDesempenhoRow[] }) {
  if (!props.rows.length) {
    return <p className="text-sm text-slate-700">Sem dados de desempenho para gerar grafico de acertividade.</p>;
  }

  const rows = props.rows.slice(-10);
  const maxValue = Math.max(...rows.map((row) => row.tentativas + row.acertos), 1);
  const axisMax = Math.max(10, Math.ceil(maxValue / 2) * 2);
  const tickStep = axisMax <= 16 ? 2 : axisMax <= 30 ? 5 : 10;
  const ticks: number[] = [];
  for (let value = 0; value <= axisMax; value += tickStep) {
    ticks.push(value);
  }

  const leftPad = 36;
  const rightPad = 28;
  const topPad = 18;
  const bottomPad = 30;
  const rowGap = 24;
  const barHeight = 10;
  const chartWidth = 740;
  const chartHeight = topPad + rowGap * rows.length + bottomPad;
  const plotWidth = chartWidth - leftPad - rightPad;
  const xFor = (value: number) => leftPad + (Math.max(0, value) / axisMax) * plotWidth;

  return (
    <div className="avoid-break rounded-xl border border-[#e7ddd2] bg-[#fcfaf7] p-3">
      <h3 className="text-center text-lg font-semibold text-[#4d392a]">Desempenho de Acertos</h3>
      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        className="mt-3 block w-full"
        preserveAspectRatio="xMinYMin meet"
        role="img"
        aria-label="Grafico horizontal de tentativas e acertos"
      >
        <rect x="0" y="0" width={chartWidth} height={chartHeight} rx="10" fill="#fcfaf7" />

        {ticks.map((tick) => {
          const x = xFor(tick);
          return (
            <g key={`tick-${tick}`}>
              <line x1={x} y1={topPad - 8} x2={x} y2={chartHeight - bottomPad + 4} stroke="#ddd1c4" strokeWidth="1" />
              <text x={x} y={chartHeight - 6} textAnchor="middle" fontSize="11" fill="#7c6a58">
                {tick}
              </text>
            </g>
          );
        })}

        {rows.map((row, index) => {
          const y = topPad + index * rowGap;
          const seq = rows.length - index;
          const tentWidth = Math.max(0, xFor(row.tentativas) - leftPad);
          const acertosX = xFor(row.tentativas);
          const acertosWidth = Math.max(0, xFor(row.tentativas + row.acertos) - acertosX);
          return (
            <g key={`${row.evolucaoId}-${row.data}-${index}`}>
              <text x={leftPad - 10} y={y + barHeight - 1} textAnchor="end" fontSize="12" fill="#4d392a" fontWeight="600">
                {seq}
              </text>
              <rect x={leftPad} y={y} width={tentWidth} height={barHeight} fill="#f2bd28" rx="2" />
              <rect x={acertosX} y={y} width={acertosWidth} height={barHeight} fill="#1376bf" rx="2" />
            </g>
          );
        })}
      </svg>
      <div className="mt-3 flex flex-wrap justify-center gap-4 text-xs text-slate-700">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-[#f2bd28]" />
          Tentativas
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-[#1376bf]" />
          Acertos
        </span>
      </div>
    </div>
  );
}

function NivelIndependenciaChart(props: { naoFez: number; ajuda: number; independente: number }) {
  const values = [
    { key: "nao-faz", label: "Nao faz", value: props.naoFez },
    { key: "ajuda", label: "Ajuda", value: props.ajuda },
    { key: "independente", label: "Independencia", value: props.independente },
  ];
  const maxValue = Math.max(...values.map((item) => item.value), 1);
  const axisMax = Math.max(4, maxValue + 1);
  const ticks = [0, 1, 2, 3, 4].filter((tick) => tick <= axisMax);
  if (ticks[ticks.length - 1] !== axisMax) ticks.push(axisMax);

  const chartWidth = 620;
  const chartHeight = 320;
  const leftPad = 36;
  const rightPad = 16;
  const topPad = 24;
  const bottomPad = 52;
  const plotHeight = chartHeight - topPad - bottomPad;
  const slotWidth = (chartWidth - leftPad - rightPad) / values.length;
  const barWidth = 70;
  const yFor = (value: number) => topPad + plotHeight - (Math.max(0, value) / axisMax) * plotHeight;

  return (
    <div className="avoid-break rounded-xl border border-[#e7ddd2] bg-[#fcfaf7] p-3">
      <h3 className="text-center text-lg font-semibold text-[#4d392a]">Nivel de Independencia</h3>
      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        className="mt-4 block w-full"
        preserveAspectRatio="xMidYMin meet"
        role="img"
        aria-label="Grafico de colunas do nivel de independencia"
      >
        <rect x="0" y="0" width={chartWidth} height={chartHeight} rx="10" fill="#fcfaf7" />

        {ticks.map((tick) => {
          const y = yFor(tick);
          return (
            <g key={`niv-tick-${tick}`}>
              <line x1={leftPad} y1={y} x2={chartWidth - rightPad} y2={y} stroke="#ddd1c4" strokeWidth="1" />
              <text x={leftPad - 8} y={y + 4} textAnchor="end" fontSize="11" fill="#7c6a58">
                {tick}
              </text>
            </g>
          );
        })}

        {values.map((item, index) => {
          const centerX = leftPad + slotWidth * index + slotWidth / 2;
          const barX = centerX - barWidth / 2;
          const barY = yFor(item.value);
          const barHeight = topPad + plotHeight - barY;
          return (
            <g key={item.key}>
              <text x={centerX} y={barY - 8} textAnchor="middle" fontSize="18" fontWeight="700" fill="#4d392a">
                {item.value}
              </text>
              <rect x={barX} y={barY} width={barWidth} height={barHeight} rx="2" fill="#1f6b89" />
              <text x={centerX} y={chartHeight - 14} textAnchor="middle" fontSize="12.5" fontWeight="600" fill="#6b5a49">
                {item.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function SummaryCard(props: { label: string; value: string | number; helper?: string }) {
  return (
    <div className="rounded-[14px] border border-[#ddd1c4] bg-[#fffdfa] px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#9c8a78]">{props.label}</p>
      <p className="mt-1.5 text-lg font-semibold text-[#3d3127]">{props.value}</p>
      {props.helper ? <p className="mt-0.5 text-xs text-slate-600">{props.helper}</p> : null}
    </div>
  );
}

export function PlanoEnsinoImpressaoClient(props: {
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
  const [report, setReport] = useState<PlanoEnsinoReport | null>(null);

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

  const desempenhoRows = useMemo(() => report?.desempenhoEnsino ?? [], [report]);

  const nivelIndependencia = useMemo(() => {
    return desempenhoRows.reduce(
      (acc, row) => {
        if (row.desempenho === "nao_fez") acc.naoFez += 1;
        if (row.desempenho === "ajuda") acc.ajuda += 1;
        if (row.desempenho === "independente") acc.independente += 1;
        return acc;
      },
      { naoFez: 0, ajuda: 0, independente: 0 }
    );
  }, [desempenhoRows]);

  async function consultar() {
    if (!selectedRange) {
      setMsg(periodPreset === "custom" ? "Periodo invalido." : "Referencia invalida.");
      return;
    }

    setLoading(true);
    setMsg(null);

    try {
      const data = unwrapRelatorioAction(
        await gerarRelatorioPlanoEnsinoAction({
          pacienteId: props.pacienteId,
          from: selectedRange.from,
          to: selectedRange.to,
        }),
        "Erro ao carregar relatorio de plano de ensino"
      );
      setReport(data.report as PlanoEnsinoReport);
    } catch (error) {
      setReport(null);
      setMsg(normalizeRelatorioApiError(error, "Erro ao carregar relatorio de plano de ensino"));
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
      const resp = await fetch(`/api/relatorios/plano-ensino/docx?${query}`);
      if (!resp.ok) {
        const json = (await resp.json().catch(() => null)) as unknown;
        throw new Error(readApiError(json) || "Falha ao gerar DOCX");
      }

      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `relatorio-plano-ensino-${props.pacienteId}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 3000);
    } catch (error) {
      setMsg(normalizeRelatorioApiError(error, "Falha ao gerar DOCX"));
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
              Selecione o periodo, gere a pagina e use os botoes para imprimir, salvar PDF
              ou baixar o DOCX.
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
          <p className="text-sm text-slate-600">Carregando relatorio de plano de ensino...</p>
        </section>
      ) : null}

      {report ? (
        <article className="print-page overflow-hidden rounded-[20px] border border-[#d8c7b8] bg-white">
          <header className="px-6 pb-4 pt-5 sm:px-8">
            <div className="flex items-start justify-between gap-4 border-b border-[#e8ddd2] pb-4">
              <div className="space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#d1a06c]">Clinica Girassois</p>
                <h1 className="max-w-3xl text-2xl font-semibold uppercase tracking-[0.06em] text-[#4d392a] sm:text-3xl">
                  Relatorio de Plano de Ensino
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
              <SummaryCard label="Paciente" value={report.paciente.nome} />
              <SummaryCard
                label="Periodo avaliado"
                value={fmtPeriodLabel(report.periodo.from, report.periodo.to)}
                helper={`${fmtDate(report.periodo.from)} a ${fmtDate(report.periodo.to)}`}
              />
              <SummaryCard label="Emissao" value={fmtNowPtBr()} />
            </div>
          </header>

          <div className="space-y-4 px-6 pb-5 sm:px-8">
            <section className="rounded-2xl border border-[#ece2d8] bg-[#fcfaf7] p-4">
              <h2 className="text-base font-semibold uppercase tracking-[0.08em] text-[#5e4632]">Desempenho do ensino</h2>
              <p className="mt-1 text-sm text-slate-600">
                Consolidado a partir das evolucoes do periodo com foco em desempenho, tipo de ajuda, tentativas e acertos.
              </p>

              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {AJUDA_LEGENDA.map((item) => (
                  <div key={item.code} className="rounded-lg border border-[#e7ddd2] bg-white px-3 py-2 text-sm text-[#4d392a]">
                    <span className="font-semibold">{item.code}</span> - {item.label}
                  </div>
                ))}
              </div>

              {desempenhoRows.length ? (
                <div className="mt-4 space-y-4">
                  <div className="overflow-x-auto">
                    <table className="min-w-full border-collapse text-sm text-slate-700">
                      <thead>
                        <tr className="bg-[#fbf6f0] text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-[#907b68]">
                          <th className="px-3 py-2">Data</th>
                          <th className="px-3 py-2">Ensino</th>
                          <th className="px-3 py-2">Desempenho</th>
                          <th className="px-3 py-2">Ajuda</th>
                          <th className="px-3 py-2">Tentativas</th>
                          <th className="px-3 py-2">Acertos</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#ece2d8] bg-white">
                        {desempenhoRows.map((row, index) => (
                          <tr key={`${row.evolucaoId}-${row.data}-${index}`}>
                            <td className="px-3 py-2">{fmtDateCompact(row.data)}</td>
                            <td className="px-3 py-2">{row.ensino || "-"}</td>
                            <td className="px-3 py-2">{desempenhoLabel(row.desempenho)}</td>
                            <td className="px-3 py-2">{row.ajuda || "-"}</td>
                            <td className="px-3 py-2">{row.tentativas}</td>
                            <td className="px-3 py-2">{row.acertos}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="grid gap-4 xl:grid-cols-2">
                    <AcertividadeChart rows={desempenhoRows} />
                    <NivelIndependenciaChart
                      naoFez={nivelIndependencia.naoFez}
                      ajuda={nivelIndependencia.ajuda}
                      independente={nivelIndependencia.independente}
                    />
                  </div>
                </div>
              ) : (
                <div className="mt-3 rounded-xl border border-[#e7ddd2] bg-white p-4 text-sm text-slate-700">
                  Sem evolucoes com metas de desempenho no periodo selecionado.
                </div>
              )}
            </section>
          </div>
        </article>
      ) : null}

      <style jsx global>{`
        @page {
          size: A4;
          margin: 12mm 10mm 14mm 10mm;
        }

        .avoid-break {
          break-inside: avoid;
          page-break-inside: avoid;
        }

        @media print {
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

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
