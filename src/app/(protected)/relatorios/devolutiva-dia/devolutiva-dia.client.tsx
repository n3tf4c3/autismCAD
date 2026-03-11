"use client";

import { useEffect, useMemo, useState } from "react";
import { ReportFilters } from "@/components/reports/report-filters";
import { RecentFeedbackList } from "@/components/reports/recent-feedback-list";
import { ReportSectionTabs } from "@/components/reports/report-section-tabs";
import { ReportSummaryCards } from "@/components/reports/report-summary-cards";
import { SkillsGrid } from "@/components/reports/skills-grid";
import { buildDesempenhoResumo } from "@/lib/relatorios/desempenho";

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

type ComportamentoLado = "negativo" | "positivo";
type ComportamentoResultado = "negativo" | "positivo" | "parcial";

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

function pickStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item ?? "").trim())
    .filter(Boolean);
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
    return buildDesempenhoResumo(report?.evolucoes);
  }, [report]);

  const comportamentoResumo = useMemo(() => {
    const resultado: Record<ComportamentoResultado, number> = {
      negativo: 0,
      positivo: 0,
      parcial: 0,
    };
    const mapNeg = new Map<string, { label: string; value: number }>();
    const mapPos = new Map<string, { label: string; value: number }>();

    const addItem = (lado: ComportamentoLado, rawValue: string, qty: number) => {
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

    const toRows = (
      map: Map<string, { label: string; value: number }>,
      totalRef: number
    ): Array<{ key: string; label: string; value: number; pct: number }> =>
      Array.from(map.entries())
        .map(([key, item]) => ({
          key,
          label: item.label,
          value: item.value,
          pct: percent(item.value, totalRef),
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 8);

    return {
      total,
      totalNegativo,
      totalPositivo,
      pctNegativo: percent(totalNegativo, total),
      pctPositivo: percent(totalPositivo, total),
      resultado,
      rowsNegativo: toRows(mapNeg, totalNegativo),
      rowsPositivo: toRows(mapPos, totalPositivo),
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
    if (comportamentoResumo.total) {
      linhas.push(
        `Comportamentos observados: ${comportamentoResumo.total} registro(s) no total (${comportamentoResumo.totalPositivo} positivos e ${comportamentoResumo.totalNegativo} negativos).`
      );
      const topNeg = comportamentoResumo.rowsNegativo[0];
      const topPos = comportamentoResumo.rowsPositivo[0];
      if (topPos) linhas.push(`- Destaque positivo: ${topPos.label} (${topPos.value})`);
      if (topNeg) linhas.push(`- Alerta comportamental: ${topNeg.label} (${topNeg.value})`);
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
  }, [comportamentoResumo, desempenhoResumo, report, resumoDia]);

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
    <main className="space-y-4">
      <ReportFilters
        title="Periodo"
        description="Selecione o dia para atualizar o resumo, as habilidades e os comentarios."
        label="Dia"
        type="date"
        value={dataRef}
        onChange={setDataRef}
        buttonLabel="Consultar dia"
        onSubmit={() => void consultar()}
        loading={loading}
        compact
      />

      {msg ? <p className="text-sm text-red-600">{msg}</p> : null}

      {loading ? (
        <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-700">Carregando devolutiva...</p>
        </section>
      ) : null}

      {report ? (
        <>
          <ReportSectionTabs
            items={[
              { id: "resumo", label: "Resumo" },
              { id: "habilidades", label: "Habilidades", badge: desempenhoResumo.rowsBySkill.length },
              { id: "devolutivas", label: "Devolutivas", badge: feedbackItems.length },
              { id: "comportamentos", label: "Comport.", badge: comportamentoResumo.total },
              { id: "atendimentos", label: "Atend.", badge: report.atendimentos.length },
            ]}
          />

          <section id="resumo" className="scroll-mt-24 rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-[var(--marrom)] sm:text-lg">Resumo rapido</h2>
                <p className="mt-1 text-sm text-gray-700">
                  Baseado nos registros de metas e atendimentos do dia {fmtDate(report.periodo.from)}.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void copiarResumo()}
                disabled={!textoResumoParaPais}
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
                items={desempenhoResumo.rows.map((row) => ({
                  label: row.label,
                  value: row.value,
                  description: `${row.pct}% do total avaliado.`,
                  tone: row.key === "independente" ? "success" : row.key === "ajuda" ? "warning" : "danger",
                }))}
              />
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
              <p className="text-sm text-gray-700">{resumoDia}</p>
              <details className="mt-3">
                <summary className="cursor-pointer text-sm font-semibold text-[var(--laranja)]">Ver resumo para compartilhar</summary>
                <p className="mt-2 whitespace-pre-line text-sm leading-6 text-gray-700">{textoResumoParaPais}</p>
              </details>
            </div>
          </section>

          <SkillsGrid
            sectionId="habilidades"
            compact
            rows={desempenhoResumo.rowsBySkill}
            title="Habilidades trabalhadas"
            subtitle="Cards mais compactos para leitura rapida no celular, mantendo comparacao clara entre os tres status."
            emptyMessage="Nao ha habilidades suficientes para montar o grafico deste dia."
          />

          <section id="devolutivas" className="scroll-mt-24 rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-[var(--marrom)] sm:text-lg">Devolutivas do profissional</h2>
                <p className="mt-1 text-sm text-gray-700">Comentarios com preview compacto e expansao sob demanda.</p>
              </div>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-gray-600">
                {feedbackItems.length} item(ns)
              </span>
            </div>
            <RecentFeedbackList
              items={feedbackItems}
              previewLength={180}
              emptyMessage="Sem devolutiva registrada para este dia."
            />
          </section>

          <section id="comportamentos" className="scroll-mt-24 rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-[var(--marrom)]">Grafico de comportamento</h2>
                <p className="mt-1 text-sm text-gray-700">
                  Distribuicao dos comportamentos registrados nas evolucoes do dia.
                </p>
              </div>
              <p className="text-sm font-medium text-gray-600">{fmtDate(report.periodo.from)}</p>
            </div>
            {comportamentoResumo.total ? (
              <div className="mt-4 space-y-4">
                <ReportSummaryCards
                  compact
                  columns={3}
                  items={[
                    {
                      label: "Negativos",
                      value: `${comportamentoResumo.totalNegativo} (${comportamentoResumo.pctNegativo}%)`,
                      description: "Ocorrencias classificadas como negativas.",
                      tone: "danger",
                    },
                    {
                      label: "Positivos",
                      value: `${comportamentoResumo.totalPositivo} (${comportamentoResumo.pctPositivo}%)`,
                      description: "Ocorrencias classificadas como positivas.",
                      tone: "success",
                    },
                    {
                      label: "Resultado geral",
                      value: `${comportamentoResumo.resultado.positivo}/${comportamentoResumo.resultado.parcial}/${comportamentoResumo.resultado.negativo}`,
                      description: "Positivo / Parcial / Negativo nas evolucoes.",
                      tone: "warning",
                    },
                  ]}
                />

                <div className="flex h-3 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full bg-rose-500"
                    style={{
                      width: `${comportamentoResumo.pctNegativo}%`,
                    }}
                  />
                  <div
                    className="h-full bg-green-500"
                    style={{
                      width: `${comportamentoResumo.pctPositivo}%`,
                    }}
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                  <div className="rounded-2xl border border-rose-100 bg-rose-50/50 p-4">
                    <p className="text-sm font-semibold text-[var(--marrom)]">Top comportamentos negativos</p>
                    <div className="mt-3 space-y-2">
                      {comportamentoResumo.rowsNegativo.length ? (
                        comportamentoResumo.rowsNegativo.map((row) => (
                          <div key={row.key}>
                            <div className="mb-1 flex items-center justify-between text-sm text-gray-700">
                              <span>{row.label}</span>
                              <span className="font-semibold">
                                {row.value} ({row.pct}%)
                              </span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                              <div className="h-full rounded-full bg-rose-500" style={{ width: `${row.pct}%` }} />
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-gray-700">Sem itens negativos registrados.</p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4">
                    <p className="text-sm font-semibold text-[var(--marrom)]">Top comportamentos positivos</p>
                    <div className="mt-3 space-y-2">
                      {comportamentoResumo.rowsPositivo.length ? (
                        comportamentoResumo.rowsPositivo.map((row) => (
                          <div key={row.key}>
                          <div className="mb-1 flex items-center justify-between text-sm text-gray-700">
                            <span>{row.label}</span>
                            <span className="font-semibold">
                              {row.value} ({row.pct}%)
                            </span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                              <div className="h-full rounded-full bg-green-500" style={{ width: `${row.pct}%` }} />
                          </div>
                        </div>
                        ))
                      ) : (
                        <p className="text-sm text-gray-700">Sem itens positivos registrados.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-sm text-gray-700">
                Nao ha registros de comportamentos estruturados nas evolucoes deste dia.
              </p>
            )}
          </section>

          <section id="atendimentos" className="scroll-mt-24 rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-[var(--marrom)]">Atendimentos do dia</h2>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm text-gray-600">
                {report.atendimentos.length} itens
              </span>
            </div>

            <div className="mt-4 space-y-3 lg:hidden">
              {report.atendimentos.length ? (
                report.atendimentos.map((a) => (
                  <article key={a.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[var(--marrom)]">
                          {fmtHour(a.hora_inicio)} - {fmtHour(a.hora_fim)}
                        </p>
                        <p className="mt-1 text-xs text-gray-600">{a.terapeuta_nome || "Profissional"}</p>
                      </div>
                      <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-700">
                        {a.presenca}
                      </span>
                    </div>
                    <p className="mt-3 text-xs text-gray-600">Duracao: {a.duracao_min || "-"} min</p>
                    <p className="mt-2 text-sm text-gray-700">
                      {(a.resumo_repasse || a.observacoes || a.motivo || "-").slice(0, 180)}
                    </p>
                  </article>
                ))
              ) : (
                <p className="text-sm text-gray-600">Nenhum atendimento registrado para este dia.</p>
              )}
            </div>

            <div className="mt-4 hidden overflow-x-auto rounded-2xl border border-slate-200 lg:block">
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
        </>
      ) : null}
    </main>
  );
}
