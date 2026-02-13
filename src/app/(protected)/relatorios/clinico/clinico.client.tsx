"use client";

import { useMemo, useState } from "react";

type ClinicoReport = {
  paciente: { id: number; nome: string; cpf: string; convenio: string };
  anamnese: { version: number; status: string; created_at: string } | null;
  atendimentos: {
    total: number;
    presentes: number;
    ausentes: number;
    taxaPresenca: number;
    observacoes: Array<{
      data: string;
      hora_inicio: string;
      presenca: string;
      observacoes: string | null;
      motivo: string | null;
    }>;
  };
};

function normalizeApiError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Erro ao gerar relatorio";
}

export function RelatorioClinicoClient() {
  const [pacienteId, setPacienteId] = useState("");
  const [version, setVersion] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [terapeutaId, setTerapeutaId] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [report, setReport] = useState<ClinicoReport | null>(null);

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (pacienteId) p.set("pacienteId", pacienteId);
    if (version) p.set("version", version);
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    if (terapeutaId) p.set("terapeutaId", terapeutaId);
    return p.toString();
  }, [from, pacienteId, terapeutaId, to, version]);

  async function gerar() {
    setLoading(true);
    setMsg(null);
    setReport(null);
    try {
      const resp = await fetch(`/api/relatorios/clinico?${qs}`, { cache: "no-store" });
      const data = (await resp.json().catch(() => ({}))) as ClinicoReport & { error?: string };
      if (!resp.ok) throw new Error(data.error || "Erro ao gerar relatorio");
      setReport(data);
    } catch (err) {
      setMsg(normalizeApiError(err));
    } finally {
      setLoading(false);
    }
  }

  async function pdf() {
    setMsg(null);
    try {
      const resp = await fetch(`/api/relatorios/clinico/pdf?${qs}`);
      if (!resp.ok) {
        const data = (await resp.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || "Erro ao gerar PDF");
      }
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "relatorio-clinico.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (err) {
      setMsg(normalizeApiError(err));
    }
  }

  return (
    <main className="space-y-6">
      <section className="rounded-xl bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="text-3xl">📄</div>
          <div>
            <h3 className="text-lg font-bold text-[var(--marrom)]">Filtros</h3>
            <p className="text-sm text-gray-600">
              Informe o paciente e periodo para gerar o relatorio.
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-5">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-[var(--marrom)]">Paciente ID *</span>
            <input
              value={pacienteId}
              onChange={(e) => setPacienteId(e.target.value)}
              inputMode="numeric"
              className="rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-[var(--marrom)]">Versao</span>
            <input
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              inputMode="numeric"
              className="rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-[var(--marrom)]">De</span>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-[var(--marrom)]">Ate</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-[var(--marrom)]">Terapeuta ID</span>
            <input
              value={terapeutaId}
              onChange={(e) => setTerapeutaId(e.target.value)}
              inputMode="numeric"
              className="rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
            />
          </label>
        </div>

        <div className="mt-4 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => void pdf()}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
            disabled={!pacienteId || loading}
          >
            Exportar PDF
          </button>
          <button
            type="button"
            onClick={() => void gerar()}
            className="rounded-lg bg-[var(--laranja)] px-5 py-2.5 font-semibold text-white hover:bg-[#e6961f] disabled:opacity-60"
            disabled={!pacienteId || loading}
          >
            Gerar
          </button>
        </div>

        {msg ? <p className="mt-3 text-sm text-red-600">{msg}</p> : null}
        {loading ? <p className="mt-3 text-sm text-gray-600">Carregando...</p> : null}
      </section>

      {report ? (
        <section className="space-y-4 rounded-xl bg-white p-6 shadow-sm">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="rounded-lg border border-gray-100 bg-[#fffaf0] p-4">
              <p className="text-sm text-gray-600">Total atendimentos</p>
              <p className="text-2xl font-bold text-[var(--marrom)]">
                {report.atendimentos?.total ?? 0}
              </p>
            </div>
            <div className="rounded-lg border border-gray-100 bg-[#f1f8ff] p-4">
              <p className="text-sm text-gray-600">Presencas</p>
              <p className="text-2xl font-bold text-[var(--marrom)]">
                {report.atendimentos?.presentes ?? 0}
              </p>
            </div>
            <div className="rounded-lg border border-gray-100 bg-[#ffe8e8] p-4">
              <p className="text-sm text-gray-600">Faltas</p>
              <p className="text-2xl font-bold text-[var(--marrom)]">
                {report.atendimentos?.ausentes ?? 0}
              </p>
            </div>
            <div className="rounded-lg border border-gray-100 bg-[#f0fff4] p-4">
              <p className="text-sm text-gray-600">Taxa de presenca</p>
              <p className="text-2xl font-bold text-[var(--marrom)]">
                {report.atendimentos?.taxaPresenca ?? 0}%
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-gray-100 p-4">
              <h4 className="font-semibold text-[var(--marrom)]">Paciente</h4>
              <p className="text-sm text-gray-700">
                {report.paciente?.nome || ""} (CPF: {report.paciente?.cpf || "-"})
              </p>
            </div>
            <div className="rounded-lg border border-gray-100 p-4">
              <h4 className="font-semibold text-[var(--marrom)]">Anamnese</h4>
              <p className="text-sm text-gray-700">
                {report.anamnese
                  ? `Versao ${report.anamnese.version} - ${report.anamnese.status || ""} - ${report.anamnese.created_at || ""}`
                  : "Sem anamnese encontrada"}
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-gray-100 p-4">
            <h4 className="mb-2 font-semibold text-[var(--marrom)]">Observacoes recentes</h4>
            <ul className="space-y-2 text-sm text-gray-700">
              {report.atendimentos?.observacoes?.length ? (
                report.atendimentos.observacoes.map((o, idx) => (
                  <li key={`${o.data}-${idx}`} className="rounded-md border bg-gray-50 p-2">
                    {o.data || ""} {o.hora_inicio || ""} - {o.presenca || ""} -{" "}
                    {(o.observacoes || o.motivo || "-").trim()}
                  </li>
                ))
              ) : (
                <li>Sem observacoes</li>
              )}
            </ul>
          </div>
        </section>
      ) : null}
    </main>
  );
}

