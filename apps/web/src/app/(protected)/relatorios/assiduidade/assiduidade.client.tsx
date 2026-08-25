"use client";

import Link from "next/link";
import { useState } from "react";
import { gerarRelatorioAssiduidadeAction } from "@/app/(protected)/relatorios/relatorios.actions";
import {
  normalizeRelatorioApiError,
  unwrapRelatorioAction,
} from "@/lib/relatorios/client-errors";

type Profissional = { id: number; nome: string };

type Report = {
  periodo: { from: string; to: string };
  filtros: {
    profissionalId: number | null;
    pacienteNome: string | null;
    presenca: string | null;
    role: string | null;
  };
  resumo: {
    total: number;
    presentes: number;
    faltas: number;
    semRegistro: number;
    devolutivasPendentes: number;
    taxa: number;
  };
  pendenciasDevolutiva: Array<{
    atendimentoId: number;
    pacienteId: number;
    pacienteNome: string;
    data: string;
    horaInicio: string;
    horaFim: string;
    profissionalId: number | null;
    profissionalNome: string;
  }>;
  linhas: Array<{
    pacienteNome: string;
    total: number;
    presencas: number;
    faltas: number;
    taxa: number;
    neutros: number;
    ultimo: string;
    profissionais: string;
  }>;
};

function ymdFromLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function ymdToday(): string {
  return ymdFromLocalDate(new Date());
}

function ymdMinusDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return ymdFromLocalDate(d);
}

function fmtDate(value?: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

export function AssiduidadeClient(props: {
  canChooseProfissional: boolean;
  canCreateEvolucao: boolean;
  initialProfissionais: Profissional[];
}) {
  const [pacienteNome, setPacienteNome] = useState("");
  const [profissionalId, setProfissionalId] = useState("");
  const [from, setFrom] = useState(ymdMinusDays(29));
  const [to, setTo] = useState(ymdToday());
  const [presenca, setPresenca] = useState("");

  const [profissionais] = useState<Profissional[]>(() => props.initialProfissionais);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [copyMsg, setCopyMsg] = useState<string | null>(null);
  const [report, setReport] = useState<Report | null>(null);

  async function gerar() {
    setLoading(true);
    setMsg(null);
    setCopyMsg(null);
    setReport(null);
    try {
      const filters = {
        pacienteNome: pacienteNome.trim() || undefined,
        profissionalId:
          props.canChooseProfissional && profissionalId ? Number(profissionalId) : undefined,
        from: from || undefined,
        to: to || undefined,
        presenca: presenca || undefined,
      };
      const data = unwrapRelatorioAction(await gerarRelatorioAssiduidadeAction(filters), "Erro ao gerar relatório");
      setReport(data.report as Report);
    } catch (err) {
      setMsg(normalizeRelatorioApiError(err, "Erro ao gerar relatório"));
    } finally {
      setLoading(false);
    }
  }

  const profissionalSelecionado = profissionais.find(
    (item) => String(item.id) === profissionalId
  );

  async function copiarPendencias() {
    if (!report?.pendenciasDevolutiva.length) return;
    const linhas = [
      `Pendências de devolutivas — ${fmtDate(report.periodo.from)} a ${fmtDate(report.periodo.to)}`,
      ...report.pendenciasDevolutiva.map((item) => {
        const horario = item.horaInicio
          ? `, ${item.horaInicio}${item.horaFim ? `-${item.horaFim}` : ""}`
          : "";
        return `- ${item.profissionalNome}: ${fmtDate(item.data)}${horario} — ${item.pacienteNome}`;
      }),
    ];

    try {
      if (!navigator.clipboard) throw new Error("Clipboard indisponível");
      await navigator.clipboard.writeText(linhas.join("\n"));
      setCopyMsg("Lista copiada. Agora você pode encaminhá-la aos terapeutas.");
    } catch {
      setCopyMsg("Não foi possível copiar automaticamente. Use Imprimir / Salvar PDF.");
    }
  }

  return (
    <main className="space-y-6 print:space-y-3">
      {/* Cabecalho que so existe no papel: a topbar do app fica print:hidden, entao
          o documento impresso precisa carregar por si o que foi filtrado. */}
      {report ? (
        <header className="hidden print:block">
          <h1 className="text-xl font-bold text-[var(--marrom)]">
            Relatório de assiduidade e presença
          </h1>
          <p className="mt-1 text-sm text-gray-700">
            Período: {fmtDate(report.periodo.from)} a {fmtDate(report.periodo.to)}
          </p>
          <p className="text-sm text-gray-700">
            Paciente: {report.filtros.pacienteNome || "todos"} · Profissional:{" "}
            {profissionalSelecionado?.nome || "todos"} · Presença:{" "}
            {report.filtros.presenca || "todas"}
          </p>
        </header>
      ) : null}

      <section className="rounded-xl bg-white p-6 shadow-sm print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="text-2xl">AS</div>
            <div>
              <h2 className="text-lg font-bold text-[var(--marrom)]">Relatório de assiduidade</h2>
              <p className="text-sm text-gray-600">
                Filtre por paciente, profissional e período para acompanhar presença e faltas.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-5">
          <label className="flex flex-col gap-2 md:col-span-2">
            <span className="text-sm font-semibold text-[var(--marrom)]">Paciente</span>
            <input
              value={pacienteNome}
              onChange={(e) => setPacienteNome(e.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
              placeholder="Nome do paciente"
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-[var(--marrom)]">Profissional</span>
            <select
              value={profissionalId}
              onChange={(e) => setProfissionalId(e.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30 disabled:bg-gray-50"
              disabled={!props.canChooseProfissional}
            >
              <option value="">Todos</option>
              {profissionais.map((t) => (
                <option key={t.id} value={String(t.id)}>
                  {t.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-[var(--marrom)]">Data inicio</span>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-[var(--marrom)]">Data fim</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-[var(--marrom)]">Presença</span>
            <select
              value={presenca}
              onChange={(e) => setPresenca(e.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
            >
              <option value="">Todas</option>
              <option value="Presente">Presente</option>
              <option value="Ausente">Ausente</option>
              <option value="Nao informado">Nao informado</option>
            </select>
          </label>
        </div>

        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={() => void gerar()}
            className="rounded-lg bg-[var(--laranja)] px-4 py-2.5 text-sm font-semibold text-[var(--texto-sobre-acao)] hover:bg-[#e6961f] disabled:opacity-60"
            disabled={loading}
          >
            Filtrar
          </button>
          <button
            type="button"
            onClick={() => {
              setPacienteNome("");
              setProfissionalId("");
              setFrom(ymdMinusDays(29));
              setTo(ymdToday());
              setPresenca("");
              setReport(null);
              setMsg(null);
              setCopyMsg(null);
            }}
            className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Limpar
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            disabled={!report}
            className="rounded-lg border border-[var(--laranja)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--laranja)] hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50"
            title={report ? undefined : "Gere o relatório antes de imprimir"}
          >
            Imprimir / Salvar PDF
          </button>
        </div>

        {msg ? <p className="mt-3 text-sm text-red-600">{msg}</p> : null}
        {loading ? <p className="mt-3 text-sm text-gray-600">Carregando...</p> : null}
      </section>

      <section className="relatorio-print-resumo grid grid-cols-1 gap-4 md:grid-cols-5">
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">Atendimentos no período</p>
          <p className="text-2xl font-bold text-[var(--marrom)]">{report?.resumo.total ?? 0}</p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">Presenças</p>
          <p className="text-2xl font-bold text-green-600">{report?.resumo.presentes ?? 0}</p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">Faltas</p>
          <p className="text-2xl font-bold text-red-600">{report?.resumo.faltas ?? 0}</p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">Sem registro</p>
          <p className="text-2xl font-bold text-gray-600">{report?.resumo.semRegistro ?? 0}</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
          <p className="text-sm text-amber-800">Devolutivas pendentes</p>
          <p className="text-2xl font-bold text-amber-800">
            {report?.resumo.devolutivasPendentes ?? 0}
          </p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm md:col-span-3">
          <p className="text-sm text-gray-500">Taxa de presença</p>
          <p className="text-2xl font-bold text-[var(--marrom)]">{report?.resumo.taxa ?? 0}%</p>
          <p className="text-xs text-gray-500">
            Base: presentes / (presentes + faltas)
          </p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm md:col-span-2">
          <p className="text-sm text-gray-500">Período</p>
          <p className="text-sm font-semibold text-[var(--marrom)]">
            {report ? `${fmtDate(report.periodo.from)} a ${fmtDate(report.periodo.to)}` : "-"}
          </p>
        </div>
      </section>

      <section className="relatorio-print-tabela overflow-hidden rounded-xl bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div>
            <h3 className="text-lg font-bold text-[var(--marrom)]">
              Controle de devolutivas pendentes
            </h3>
            <p className="text-sm text-gray-600">
              Presenças confirmadas que ainda não possuem evolução vinculada.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void copiarPendencias()}
            disabled={!report?.pendenciasDevolutiva.length}
            className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50 print:hidden"
          >
            Copiar lista para repassar
          </button>
        </div>
        {copyMsg ? (
          <p className="px-6 pb-3 text-sm text-gray-700 print:hidden" role="status">
            {copyMsg}
          </p>
        ) : null}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-amber-50 text-left text-xs font-semibold uppercase tracking-wide text-amber-900">
              <tr>
                <th className="px-6 py-3">Profissional</th>
                <th className="px-6 py-3">Data</th>
                <th className="px-6 py-3">Horário</th>
                <th className="px-6 py-3">Paciente</th>
                <th className="px-6 py-3">Situação</th>
                <th className="px-6 py-3 print:hidden">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {report?.pendenciasDevolutiva.length ? (
                report.pendenciasDevolutiva.map((item) => (
                  <tr key={item.atendimentoId}>
                    <td className="px-6 py-3 font-semibold text-[var(--marrom)]">
                      {item.profissionalNome}
                    </td>
                    <td className="px-6 py-3 text-gray-700">{fmtDate(item.data)}</td>
                    <td className="px-6 py-3 text-gray-700">
                      {item.horaInicio || "-"}
                      {item.horaFim ? ` - ${item.horaFim}` : ""}
                    </td>
                    <td className="px-6 py-3 text-gray-700">{item.pacienteNome}</td>
                    <td className="px-6 py-3">
                      <span className="inline-flex rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-900">
                        Falta lançamento
                      </span>
                    </td>
                    <td className="px-6 py-3 print:hidden">
                      {props.canCreateEvolucao ? (
                        <Link
                          href={`/prontuario/${item.pacienteId}/evolucao/nova?atendimentoId=${item.atendimentoId}`}
                          className="text-sm font-semibold text-[var(--laranja)] hover:underline"
                        >
                          Registrar
                        </Link>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-6 py-5 text-center text-gray-500" colSpan={6}>
                    {report
                      ? "Nenhuma devolutiva pendente no recorte selecionado."
                      : "Use os filtros acima para gerar o controle de devolutivas."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="relatorio-print-tabela overflow-hidden rounded-xl bg-white shadow-sm">
        <div className="flex items-center justify-between px-6 py-4">
          <div>
            <h3 className="text-lg font-bold text-[var(--marrom)]">Assiduidade por paciente</h3>
            <p className="text-sm text-gray-600">
              {report ? `${report.linhas.length} paciente${report.linhas.length === 1 ? "" : "s"} no recorte` : "0 pacientes no recorte"}
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 text-left text-xs font-semibold text-gray-600">
              <tr>
                <th className="px-6 py-3">Paciente</th>
                <th className="px-6 py-3">Total</th>
                <th className="px-6 py-3">Presenças</th>
                <th className="px-6 py-3">Ausências</th>
                <th className="px-6 py-3">Taxa</th>
                <th className="px-6 py-3">Sem registro</th>
                <th className="px-6 py-3">Último atendimento</th>
                <th className="px-6 py-3">Profissionais envolvidos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {report?.linhas?.length ? (
                report.linhas.map((l) => (
                  <tr key={l.pacienteNome}>
                    <td className="px-6 py-3 font-semibold text-[var(--marrom)]">{l.pacienteNome}</td>
                    <td className="px-6 py-3 text-gray-700">{l.total}</td>
                    <td className="px-6 py-3 font-semibold text-green-700">{l.presencas}</td>
                    <td className="px-6 py-3 font-semibold text-red-600">{l.faltas}</td>
                    <td className="px-6 py-3">
                      <span className="badge rounded-full px-2 py-1 text-xs font-semibold">
                        {l.taxa}%
                      </span>
                    </td>
                    <td className="px-6 py-3 text-gray-700">{l.neutros}</td>
                    <td className="px-6 py-3 text-gray-700">{fmtDate(l.ultimo)}</td>
                    <td className="px-6 py-3 text-gray-700">{l.profissionais || "-"}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-6 py-4 text-gray-500" colSpan={8}>
                    Nenhum atendimento no recorte selecionado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl bg-white p-6 shadow-sm print:hidden">
        <h4 className="text-base font-semibold text-[var(--marrom)]">Contexto clinico</h4>
        <p className="mt-2 text-sm text-gray-600">
          Assiduidade consistente e um marcador importante. Use este painel para identificar quedas
          de presença, investigar motivos registrados e agir junto à família.
        </p>
      </section>

      <style jsx global>{`
        @page {
          /* A tabela tem 8 colunas; retrato espremeria os nomes de profissional. */
          size: A4 landscape;
          margin: 10mm;
        }

        @media print {
          html,
          body {
            background: #ffffff !important;
          }

          /* Numeros do resumo e taxa perdem o sentido em cinza. */
          .relatorio-print-resumo,
          .relatorio-print-tabela {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .relatorio-print-resumo > div,
          .relatorio-print-tabela {
            border: 1px solid #e5e7eb;
            box-shadow: none !important;
            break-inside: avoid;
          }

          .relatorio-print-resumo {
            display: grid;
            grid-template-columns: repeat(5, minmax(0, 1fr));
            gap: 6px;
          }

          .relatorio-print-tabela .overflow-x-auto {
            overflow: visible !important;
          }

          /* Cabecalho da tabela se repete a cada pagina do recorte. */
          .relatorio-print-tabela thead {
            display: table-header-group;
          }

          .relatorio-print-tabela tr {
            break-inside: avoid;
          }

          .relatorio-print-tabela th,
          .relatorio-print-tabela td {
            padding: 4px 8px !important;
            font-size: 10px !important;
          }
        }
      `}</style>
    </main>
  );
}


