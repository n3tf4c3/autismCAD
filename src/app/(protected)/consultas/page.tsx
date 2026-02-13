"use client";

import { useEffect, useMemo, useState } from "react";

type Terapeuta = { id: number; nome: string };
type Paciente = { id: number; nome: string };

type Atendimento = {
  id: number;
  paciente_id: number;
  terapeuta_id: number | null;
  pacienteNome: string;
  terapeutaNome: string | null;
  data: string;
  hora_inicio: string;
  hora_fim: string;
  turno: string;
  presenca: string;
  motivo: string | null;
  observacoes: string | null;
};

function normalizeApiError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Erro na requisicao";
}

function ymdToday(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function ConsultasPage() {
  const [terapeutas, setTerapeutas] = useState<Terapeuta[]>([]);
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [items, setItems] = useState<Atendimento[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [terapeutaId, setTerapeutaId] = useState<string>("");
  const [dataIni, setDataIni] = useState<string>(ymdToday());
  const [dataFim, setDataFim] = useState<string>(ymdToday());

  const [novoPacienteId, setNovoPacienteId] = useState<string>("");
  const [novoTerapeutaId, setNovoTerapeutaId] = useState<string>("");
  const [novoData, setNovoData] = useState<string>(ymdToday());
  const [novoInicio, setNovoInicio] = useState<string>("08:00");
  const [novoFim, setNovoFim] = useState<string>("09:00");
  const [novoObs, setNovoObs] = useState<string>("");

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (terapeutaId) params.set("terapeutaId", terapeutaId);
    if (dataIni) params.set("dataIni", dataIni);
    if (dataFim) params.set("dataFim", dataFim);
    return params.toString();
  }, [terapeutaId, dataIni, dataFim]);

  async function bootstrap() {
    try {
      const [tResp, pResp] = await Promise.all([
        fetch("/api/terapeutas", { cache: "no-store" }),
        fetch("/api/pacientes", { cache: "no-store" }),
      ]);
      const [tData, pData] = await Promise.all([tResp.json(), pResp.json()]);
      setTerapeutas(Array.isArray(tData) ? tData : []);
      setPacientes(Array.isArray(pData) ? pData : []);
    } catch {
      // optional
    }
  }

  async function loadAtendimentos() {
    setLoading(true);
    setError(null);
    try {
      const url = queryString ? `/api/atendimentos?${queryString}` : "/api/atendimentos";
      const resp = await fetch(url, { cache: "no-store" });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || "Erro ao listar atendimentos");
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(normalizeApiError(err));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  async function criarAtendimento() {
    setError(null);
    try {
      const resp = await fetch("/api/atendimentos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pacienteId: novoPacienteId,
          terapeutaId: novoTerapeutaId,
          data: novoData,
          horaInicio: novoInicio,
          horaFim: novoFim,
          turno: Number(novoInicio.split(":")[0]) < 12 ? "Matutino" : "Vespertino",
          presenca: "Nao informado",
          observacoes: novoObs || null,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || "Erro ao criar atendimento");
      await loadAtendimentos();
      setNovoObs("");
    } catch (err) {
      setError(normalizeApiError(err));
    }
  }

  useEffect(() => {
    void bootstrap();
    void loadAtendimentos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="space-y-4">
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[var(--marrom)]">Consultas</h1>
            <p className="text-sm text-gray-600">Atendimentos registrados</p>
          </div>
          <button
            type="button"
            onClick={() => void loadAtendimentos()}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Recarregar
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <label className="text-sm">
            <span className="mb-1 block font-semibold text-[var(--marrom)]">Terapeuta</span>
            <select
              className="w-full rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
              value={terapeutaId}
              onChange={(e) => setTerapeutaId(e.target.value)}
            >
              <option value="">Todos</option>
              {terapeutas.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-semibold text-[var(--marrom)]">Data inicio</span>
            <input
              type="date"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
              value={dataIni}
              onChange={(e) => setDataIni(e.target.value)}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-semibold text-[var(--marrom)]">Data fim</span>
            <input
              type="date"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
            />
          </label>
          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={() => void loadAtendimentos()}
              className="w-full rounded-lg bg-[var(--laranja)] px-3 py-2 font-semibold text-white hover:bg-[#e6961f]"
            >
              Filtrar
            </button>
            <button
              type="button"
              onClick={() => {
                setTerapeutaId("");
                setDataIni(ymdToday());
                setDataFim(ymdToday());
                void loadAtendimentos();
              }}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 font-semibold text-gray-700 hover:bg-gray-50"
            >
              Limpar
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-[var(--marrom)]">Reservar horario</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-6">
          <label className="text-sm md:col-span-2">
            <span className="mb-1 block font-semibold text-[var(--marrom)]">Paciente</span>
            <select
              className="w-full rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
              value={novoPacienteId}
              onChange={(e) => setNovoPacienteId(e.target.value)}
            >
              <option value="">Selecione</option>
              {pacientes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.id} - {p.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm md:col-span-2">
            <span className="mb-1 block font-semibold text-[var(--marrom)]">Terapeuta</span>
            <select
              className="w-full rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
              value={novoTerapeutaId}
              onChange={(e) => setNovoTerapeutaId(e.target.value)}
            >
              <option value="">Selecione</option>
              {terapeutas.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-semibold text-[var(--marrom)]">Data</span>
            <input
              type="date"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
              value={novoData}
              onChange={(e) => setNovoData(e.target.value)}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-semibold text-[var(--marrom)]">Inicio</span>
            <input
              type="time"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
              value={novoInicio}
              onChange={(e) => setNovoInicio(e.target.value)}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-semibold text-[var(--marrom)]">Fim</span>
            <input
              type="time"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
              value={novoFim}
              onChange={(e) => setNovoFim(e.target.value)}
            />
          </label>
          <label className="text-sm md:col-span-4">
            <span className="mb-1 block font-semibold text-[var(--marrom)]">Observacoes</span>
            <input
              className="w-full rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
              value={novoObs}
              onChange={(e) => setNovoObs(e.target.value)}
              placeholder="Opcional"
            />
          </label>
          <div className="flex items-end md:col-span-2">
            <button
              type="button"
              onClick={() => void criarAtendimento()}
              className="w-full rounded-lg bg-[var(--laranja)] px-3 py-2 font-semibold text-white hover:bg-[#e6961f]"
              disabled={!novoPacienteId || !novoTerapeutaId}
            >
              Reservar
            </button>
          </div>
        </div>
        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="mb-2">
          <h2 className="text-lg font-bold text-[var(--marrom)]">Resultados</h2>
          <p className="text-sm text-gray-600">
            {items.length} atendimento{items.length === 1 ? "" : "s"} encontrado
            {items.length === 1 ? "" : "s"}
          </p>
        </div>
        {loading ? <p className="text-sm text-gray-500">Carregando...</p> : null}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] border-collapse">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="px-3 py-2">Data</th>
                <th className="px-3 py-2">Paciente</th>
                <th className="px-3 py-2">Terapeuta</th>
                <th className="px-3 py-2">Horario</th>
                <th className="px-3 py-2">Presenca</th>
                <th className="px-3 py-2">Motivo/Obs</th>
              </tr>
            </thead>
            <tbody>
              {items.map((a) => (
                <tr key={a.id} className="border-b border-gray-100 text-sm">
                  <td className="px-3 py-3 text-gray-700">{String(a.data).slice(0, 10)}</td>
                  <td className="px-3 py-3 font-semibold text-[var(--marrom)]">{a.pacienteNome}</td>
                  <td className="px-3 py-3 text-gray-700">{a.terapeutaNome || "-"}</td>
                  <td className="px-3 py-3 text-gray-700">
                    {String(a.hora_inicio).slice(0, 5)} - {String(a.hora_fim).slice(0, 5)}
                  </td>
                  <td className="px-3 py-3 text-gray-700">{a.presenca}</td>
                  <td className="px-3 py-3 text-gray-700">
                    {(a.observacoes || a.motivo || "-").toString().slice(0, 120)}
                  </td>
                </tr>
              ))}
              {!loading && !items.length ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-sm text-gray-500">
                    Nenhum atendimento encontrado.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

