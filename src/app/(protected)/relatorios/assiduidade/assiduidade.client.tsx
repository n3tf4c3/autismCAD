"use client";

import { useEffect, useMemo, useState } from "react";

type Terapeuta = { id: number; nome: string };

type Report = {
  periodo: { from: string; to: string };
  filtros: {
    terapeutaId: number | null;
    pacienteNome: string | null;
    presenca: string | null;
    role: string | null;
  };
  resumo: {
    total: number;
    presentes: number;
    faltas: number;
    semRegistro: number;
    taxa: number;
  };
  linhas: Array<{
    pacienteNome: string;
    total: number;
    presencas: number;
    faltas: number;
    taxa: number;
    neutros: number;
    ultimo: string;
    terapeutas: string;
  }>;
};

function ymdToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function ymdMinusDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function fmtDate(value?: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

function normalizeApiError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Erro ao gerar relatorio";
}

export function AssiduidadeClient(props: { canChooseTerapeuta: boolean }) {
  const [pacienteNome, setPacienteNome] = useState("");
  const [terapeutaId, setTerapeutaId] = useState("");
  const [from, setFrom] = useState(ymdMinusDays(29));
  const [to, setTo] = useState(ymdToday());
  const [presenca, setPresenca] = useState("");

  const [terapeutas, setTerapeutas] = useState<Terapeuta[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [report, setReport] = useState<Report | null>(null);

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (pacienteNome.trim()) p.set("pacienteNome", pacienteNome.trim());
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    if (presenca) p.set("presenca", presenca);
    if (props.canChooseTerapeuta && terapeutaId) p.set("terapeutaId", terapeutaId);
    return p.toString();
  }, [from, pacienteNome, presenca, props.canChooseTerapeuta, terapeutaId, to]);

  useEffect(() => {
    if (!props.canChooseTerapeuta) return;
    let alive = true;
    async function loadTerapeutas() {
      try {
        const resp = await fetch("/api/terapeutas", { cache: "no-store" });
        const data = (await resp.json().catch(() => [])) as Terapeuta[];
        if (!resp.ok) return;
        if (!alive) return;
        setTerapeutas(Array.isArray(data) ? data : []);
      } catch {
        // ignore
      }
    }
    void loadTerapeutas();
    return () => {
      alive = false;
    };
  }, [props.canChooseTerapeuta]);

  async function gerar() {
    setLoading(true);
    setMsg(null);
    setReport(null);
    try {
      const resp = await fetch(`/api/relatorios/assiduidade?${qs}`, { cache: "no-store" });
      const data = (await resp.json().catch(() => ({}))) as Report & { error?: string };
      if (!resp.ok) throw new Error(data.error || "Erro ao gerar relatorio");
      setReport(data);
    } catch (err) {
      setMsg(normalizeApiError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="space-y-6">
      <section className="rounded-xl bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="text-2xl">📊</div>
            <div>
              <h2 className="text-lg font-bold text-[var(--marrom)]">Relatorio de assiduidade</h2>
              <p className="text-sm text-gray-600">
                Filtre por paciente, terapeuta e periodo para acompanhar presenca e faltas.
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
            <span className="text-sm font-semibold text-[var(--marrom)]">Terapeuta</span>
            <select
              value={terapeutaId}
              onChange={(e) => setTerapeutaId(e.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30 disabled:bg-gray-50"
              disabled={!props.canChooseTerapeuta}
            >
              <option value="">Todos</option>
              {terapeutas.map((t) => (
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
            <span className="text-sm font-semibold text-[var(--marrom)]">Presenca</span>
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
            className="rounded-lg bg-[var(--laranja)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#e6961f] disabled:opacity-60"
            disabled={loading}
          >
            Filtrar
          </button>
          <button
            type="button"
            onClick={() => {
              setPacienteNome("");
              setTerapeutaId("");
              setFrom(ymdMinusDays(29));
              setTo(ymdToday());
              setPresenca("");
              setReport(null);
              setMsg(null);
            }}
            className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Limpar
          </button>
        </div>

        {msg ? <p className="mt-3 text-sm text-red-600">{msg}</p> : null}
        {loading ? <p className="mt-3 text-sm text-gray-600">Carregando...</p> : null}
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">Atendimentos no periodo</p>
          <p className="text-2xl font-bold text-[var(--marrom)]">{report?.resumo.total ?? 0}</p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">Presencas</p>
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
        <div className="rounded-xl bg-white p-4 shadow-sm md:col-span-2">
          <p className="text-sm text-gray-500">Taxa de presenca</p>
          <p className="text-2xl font-bold text-[var(--marrom)]">{report?.resumo.taxa ?? 0}%</p>
          <p className="text-xs text-gray-500">
            Base: presentes / (presentes + faltas)
          </p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm md:col-span-2">
          <p className="text-sm text-gray-500">Periodo</p>
          <p className="text-sm font-semibold text-[var(--marrom)]">
            {report ? `${fmtDate(report.periodo.from)} a ${fmtDate(report.periodo.to)}` : "-"}
          </p>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl bg-white shadow-sm">
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
                <th className="px-6 py-3">Presencas</th>
                <th className="px-6 py-3">Ausencias</th>
                <th className="px-6 py-3">Taxa</th>
                <th className="px-6 py-3">Sem registro</th>
                <th className="px-6 py-3">Ultimo atendimento</th>
                <th className="px-6 py-3">Terapeutas envolvidos</th>
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
                    <td className="px-6 py-3 text-gray-700">{l.terapeutas || "-"}</td>
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

      <section className="rounded-xl bg-white p-6 shadow-sm">
        <h4 className="text-base font-semibold text-[var(--marrom)]">Contexto clinico</h4>
        <p className="mt-2 text-sm text-gray-600">
          Assiduidade consistente e um marcador importante. Use este painel para identificar quedas
          de presenca, investigar motivos registrados e agir junto a familia.
        </p>
      </section>
    </main>
  );
}

