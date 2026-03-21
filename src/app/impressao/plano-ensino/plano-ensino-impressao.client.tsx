"use client";

import { useEffect, useMemo, useState } from "react";
import { gerarRelatorioPlanoEnsinoAction } from "@/app/(protected)/relatorios/relatorios.actions";
import {
  normalizeRelatorioApiError,
  unwrapRelatorioAction,
} from "@/lib/relatorios/client-errors";

type PeriodPreset = "1m" | "custom";

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
      objetivoEspecifico: string | null;
      criterioSucesso: string | null;
    }>;
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
  const dateOnly = String(value).slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) {
    return `${dateOnly.slice(8, 10)}/${dateOnly.slice(5, 7)}/${dateOnly.slice(0, 4)}`;
  }
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("pt-BR");
}

function readApiError(json: unknown): string | null {
  if (!json || typeof json !== "object") return null;
  const record = json as Record<string, unknown>;
  return typeof record.error === "string" ? record.error : null;
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
              <SummaryCard label="Paciente" value={report.paciente.nome} helper={`ID ${report.paciente.id}`} />
              <SummaryCard
                label="Periodo avaliado"
                value={`${fmtDate(report.periodo.from)} a ${fmtDate(report.periodo.to)}`}
              />
              <SummaryCard label="CPF" value={report.paciente.cpf || "-"} />
            </div>
          </header>

          <div className="space-y-4 px-6 pb-5 sm:px-8">
            <section className="rounded-2xl border border-[#ece2d8] bg-[#fcfaf7] p-4">
              <h2 className="text-base font-semibold uppercase tracking-[0.08em] text-[#5e4632]">Resumo do periodo</h2>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <SummaryCard label="Planos" value={report.resumo.totalPlanos} />
                <SummaryCard label="Blocos" value={report.resumo.totalBlocos} />
                <SummaryCard
                  label="Ultima versao"
                  value={report.resumo.ultimoPlano ? report.resumo.ultimoPlano.version : "-"}
                  helper={report.resumo.ultimoPlano ? report.resumo.ultimoPlano.status : "Sem plano finalizado"}
                />
                <SummaryCard
                  label="Especialidade"
                  value={report.resumo.ultimoPlano?.especialidade || "-"}
                  helper="Plano mais recente"
                />
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-[#e7ddd2] bg-white p-3">
                  <p className="text-sm font-semibold text-[#4d392a]">Status</p>
                  <div className="mt-2 space-y-1 text-sm text-slate-700">
                    {report.resumo.status.length ? (
                      report.resumo.status.map((item) => (
                        <p key={item.label}>
                          {item.label}: <span className="font-semibold">{item.total}</span>
                        </p>
                      ))
                    ) : (
                      <p>Sem registros.</p>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-[#e7ddd2] bg-white p-3">
                  <p className="text-sm font-semibold text-[#4d392a]">Especialidades</p>
                  <div className="mt-2 space-y-1 text-sm text-slate-700">
                    {report.resumo.especialidades.length ? (
                      report.resumo.especialidades.slice(0, 10).map((item) => (
                        <p key={item.label}>
                          {item.label}: <span className="font-semibold">{item.total}</span>
                        </p>
                      ))
                    ) : (
                      <p>Sem registros.</p>
                    )}
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-semibold uppercase tracking-[0.08em] text-[#5e4632]">Planos encontrados</h2>

              {!report.planos.length ? (
                <div className="rounded-xl border border-[#e7ddd2] bg-white p-4 text-sm text-slate-700">
                  Nenhum plano de ensino encontrado para esse periodo.
                </div>
              ) : null}

              {report.planos.map((plano) => (
                <article key={plano.id} className="avoid-break rounded-xl border border-[#ddd1c4] bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#ece2d8] pb-2">
                    <p className="text-sm font-semibold text-[#4d392a]">
                      Plano #{plano.id} | Versao {plano.version}
                    </p>
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#9c8a78]">{plano.status}</p>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    <SummaryCard label="Especialidade" value={plano.especialidade || "-"} />
                    <SummaryCard label="Inicio" value={fmtDate(plano.dataInicio)} />
                    <SummaryCard label="Fim" value={fmtDate(plano.dataFinal)} />
                    <SummaryCard label="Blocos" value={plano.totalBlocos} />
                  </div>

                  <p className="mt-2 text-xs text-slate-600">
                    Autor: {plano.autorNome} | Criado: {fmtDate(plano.createdAt)} | Atualizado: {fmtDate(plano.updatedAt)}
                  </p>

                  <div className="mt-3 space-y-2">
                    {plano.blocos.length ? (
                      plano.blocos.map((bloco, index) => (
                        <div key={`${plano.id}-${index + 1}`} className="rounded-lg border border-[#ece2d8] bg-[#fcfaf7] p-3">
                          <p className="text-sm font-semibold text-[#4d392a]">Bloco {index + 1}</p>
                          <div className="mt-2 grid grid-cols-1 gap-2 text-sm text-slate-700 lg:grid-cols-2">
                            <p><span className="font-semibold">Habilidade:</span> {bloco.habilidade || "-"}</p>
                            <p><span className="font-semibold">Ensino:</span> {bloco.ensino || "-"}</p>
                            <p className="lg:col-span-2"><span className="font-semibold">Objetivo de ensino:</span> {bloco.objetivoEnsino || "-"}</p>
                            <p className="lg:col-span-2"><span className="font-semibold">Procedimento:</span> {bloco.procedimento || "-"}</p>
                            <p className="lg:col-span-2"><span className="font-semibold">Recursos:</span> {bloco.recursos || "-"}</p>
                            <p className="lg:col-span-2"><span className="font-semibold">Suportes:</span> {bloco.suportes || "-"}</p>
                            <p className="lg:col-span-2"><span className="font-semibold">Objetivo especifico:</span> {bloco.objetivoEspecifico || "-"}</p>
                            <p className="lg:col-span-2"><span className="font-semibold">Criterio de sucesso:</span> {bloco.criterioSucesso || "-"}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-slate-700">Sem blocos cadastrados.</p>
                    )}
                  </div>
                </article>
              ))}
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
