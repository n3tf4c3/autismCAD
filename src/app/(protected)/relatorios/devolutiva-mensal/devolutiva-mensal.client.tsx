"use client";

import { useEffect, useMemo, useState } from "react";
import { DailyTimeline } from "@/components/reports/daily-timeline";
import { ReportFilters } from "@/components/reports/report-filters";
import { RecentFeedbackList } from "@/components/reports/recent-feedback-list";
import { ReportSectionTabs } from "@/components/reports/report-section-tabs";
import { ReportSummaryCards } from "@/components/reports/report-summary-cards";
import { SkillsGrid } from "@/components/reports/skills-grid";
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

  const feedbackItems = useMemo(() => {
    return (report?.destaques?.ultimasObservacoes || []).map((item, index) => ({
      id: `${item.data}-${item.terapeuta_nome}-${index}`,
      dateLabel: fmtDate(item.data),
      professional: item.terapeuta_nome || "Profissional",
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
    <main className="space-y-4">
      <ReportFilters
        title="Periodo"
        description="Selecione o mes para atualizar o consolidado sem sair da tela."
        label="Mes"
        type="month"
        value={monthRef}
        onChange={setMonthRef}
        buttonLabel="Consultar mes"
        onSubmit={() => void consultar()}
        loading={loading}
        compact
      />

      {msg ? <p className="text-sm text-red-600">{msg}</p> : null}

      {loading ? (
        <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-700">Carregando relatorio mensal...</p>
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
                    : "Sem metas estruturadas nas devolutivas deste mes."}
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

            <div className="mt-3">
              <ReportSummaryCards
                compact
                items={[
                  {
                    label: "Atendimentos",
                    value: report.indicadores.totalAtendimentos,
                    description: `${report.indicadores.tempoTotalMinutos} min no periodo.`,
                    tone: "brand",
                  },
                  {
                    label: "Presencas",
                    value: report.indicadores.presentes,
                    description: "Compare com o total do mes.",
                    tone: "success",
                  },
                  {
                    label: "Ausencias",
                    value: report.indicadores.ausentes,
                    description: "Atendimentos sem presenca.",
                    tone: "danger",
                  },
                  {
                    label: "Taxa",
                    value: `${report.indicadores.taxaPresencaPercent}%`,
                    description: `${report.indicadores.mediaMinutosPorSessao} min por sessao.`,
                    tone: "warning",
                  },
                ]}
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
            title="Habilidades avaliadas"
            subtitle="Cards compactos com barra empilhada para comparar rapidamente o desempenho em cada habilidade."
            emptyMessage="Nao ha habilidades suficientes para montar o grafico deste mes."
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
              emptyMessage="Sem devolutiva registrada neste mes."
            />
          </section>

          <section id="comportamentos" className="scroll-mt-24 rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-[var(--marrom)]">Comportamentos do mes</h2>
                <p className="mt-1 text-sm text-gray-700">
                  Consolidado comportamental estruturado a partir das devolutivas do periodo selecionado.
                </p>
              </div>
              <p className="text-sm font-medium text-gray-600">{fmtMonth(monthRef)}</p>
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
                      description: "Ocorrencias classificadas como negativas no mes.",
                      tone: "danger",
                    },
                    {
                      label: "Positivos",
                      value: `${comportamentoMensal.totalPositivo} (${comportamentoMensal.pctPositivo}%)`,
                      description: "Ocorrencias classificadas como positivas no mes.",
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
                Nao ha comportamentos estruturados registrados nas devolutivas deste mes.
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
              <p className="text-sm font-medium text-gray-600">{fmtMonth(monthRef)}</p>
            </div>
            <div className="mt-4">
              <DailyTimeline
                rows={desempenhoMensal.rowsByDay}
                formatDate={fmtDate}
                emptyMessage="Nao ha distribuicao diaria para este mes."
              />
            </div>
          </section>
        </>
      ) : null}
    </main>
  );
}
