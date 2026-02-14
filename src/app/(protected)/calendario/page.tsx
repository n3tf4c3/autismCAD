"use client";

import { useEffect, useMemo, useState } from "react";

type Terapeuta = { id: number; nome: string; especialidade?: string | null };
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
  realizado: number;
  motivo: string | null;
  observacoes: string | null;
};

function weekMonday(date = new Date()): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = (d.getDay() + 6) % 7; // Monday=0..Sunday=6
  d.setDate(d.getDate() - day);
  return d;
}

function ymdLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fmtShort(d: Date): string {
  return d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });
}

function parseYmdToLocalDate(value: string): Date | null {
  const trimmed = value.trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!y || !mo || !d) return null;
  const dt = new Date(y, mo - 1, d);
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}

function normalizeApiError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Erro na requisicao";
}

export default function CalendarioPage() {
  const [terapeutas, setTerapeutas] = useState<Terapeuta[]>([]);
  const [pacientes, setPacientes] = useState<Paciente[]>([]);

  const [terapeutaId, setTerapeutaId] = useState<string>("");
  const [weekStart, setWeekStart] = useState<Date>(() => weekMonday());
  const [agenda, setAgenda] = useState<Atendimento[]>([]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [data, setData] = useState<string>(() => ymdLocal(new Date()));
  const [inicio, setInicio] = useState<string>("08:00");
  const [fim, setFim] = useState<string>("09:00");
  const [pacienteId, setPacienteId] = useState<string>("");
  const [observacoes, setObservacoes] = useState<string>("");

  const rangeLabel = useMemo(() => {
    const start = weekMonday(weekStart);
    const end = new Date(start);
    end.setDate(end.getDate() + 5); // Mon..Sat
    const fmt = (x: Date) => x.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    return `${fmt(start)} - ${fmt(end)}`;
  }, [weekStart]);

  const days = useMemo(() => {
    const start = weekMonday(weekStart);
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [weekStart]);

  // Bootstrap is handled via an effect to avoid hook dependency warnings.

  async function loadAgenda() {
    const id = terapeutaId ? Number(terapeutaId) : 0;
    if (!id) {
      setAgenda([]);
      return;
    }

    setLoading(true);
    setError(null);

    const start = weekMonday(weekStart);
    const end = new Date(start);
    end.setDate(end.getDate() + 5);

    const params = new URLSearchParams();
    params.set("terapeutaId", String(id));
    params.set("dataIni", ymdLocal(start));
    params.set("dataFim", ymdLocal(end));

    try {
      const resp = await fetch(`/api/atendimentos?${params.toString()}`, { cache: "no-store" });
      const dataJson = await resp.json();
      if (!resp.ok) throw new Error(dataJson?.error || "Erro ao carregar agenda");
      setAgenda(Array.isArray(dataJson) ? dataJson : []);
    } catch (err) {
      setError(normalizeApiError(err));
      setAgenda([]);
    } finally {
      setLoading(false);
    }
  }

  async function reservar() {
    if (!terapeutaId || !pacienteId || !data || !inicio || !fim) return;
    setSaving(true);
    setError(null);
    try {
      const turno = Number(inicio.split(":")[0]) < 12 ? "Matutino" : "Vespertino";
      const resp = await fetch("/api/atendimentos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pacienteId,
          terapeutaId,
          data,
          horaInicio: inicio,
          horaFim: fim,
          turno,
          presenca: "Nao informado",
          observacoes: observacoes || null,
        }),
      });
      const dataJson = await resp.json();
      if (!resp.ok) throw new Error(dataJson?.error || "Erro ao reservar");
      setObservacoes("");
      await loadAgenda();
    } catch (err) {
      setError(normalizeApiError(err));
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    async function run() {
      try {
        const [tResp, pResp] = await Promise.all([
          fetch("/api/terapeutas", { cache: "no-store" }),
          fetch("/api/pacientes", { cache: "no-store" }),
        ]);
        const [tData, pData] = await Promise.all([tResp.json(), pResp.json()]);
        const tList = Array.isArray(tData) ? tData : [];
        const pList = Array.isArray(pData) ? pData : [];
        setTerapeutas(tList);
        setPacientes(pList);

        // Keep behavior close to legacy: preselect last therapist (or therapistId in URL) when available.
        const search = new URLSearchParams(window.location.search);
        const qsTerapeutaId = (search.get("terapeutaId") ?? "").trim();
        const qsData = (search.get("data") ?? "").trim();
        const storedTerapeutaId = (localStorage.getItem("calendario.terapeutaId") ?? "").trim();

        const candidate =
          qsTerapeutaId ||
          storedTerapeutaId ||
          (tList.length === 1 ? String(tList[0]?.id ?? "") : "");

        if (candidate && tList.some((t: Terapeuta) => String(t.id) === candidate)) {
          setTerapeutaId(candidate);
        }

        if (qsData) {
          const dt = parseYmdToLocalDate(qsData);
          if (dt) {
            setWeekStart(weekMonday(dt));
            setData(qsData);
          }
        }
      } catch {
        // optional
      }
    }

    void run();
  }, []);

  useEffect(() => {
    if (!terapeutaId) return;
    try {
      localStorage.setItem("calendario.terapeutaId", terapeutaId);
      const url = new URL(window.location.href);
      url.searchParams.set("terapeutaId", terapeutaId);
      window.history.replaceState({}, "", url.toString());
    } catch {
      // ignore
    }
  }, [terapeutaId]);

  useEffect(() => {
    void loadAgenda();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [terapeutaId, weekStart]);

  useEffect(() => {
    function refreshOnFocus() {
      void loadAgenda();
    }

    function onVisibilityChange() {
      if (!document.hidden) refreshOnFocus();
    }

    window.addEventListener("focus", refreshOnFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("focus", refreshOnFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [terapeutaId, weekStart]);

  return (
    <main className="space-y-4">
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-[var(--marrom)]">Calendario</h1>
            <p className="text-sm text-gray-600">Agenda semanal do terapeuta</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
              value={terapeutaId}
              onChange={(e) => setTerapeutaId(e.target.value)}
            >
              <option value="">Selecione um terapeuta</option>
              {terapeutas.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="rounded-md border border-gray-200 px-2 py-2 text-sm hover:bg-gray-50"
              onClick={() => setWeekStart((prev) => {
                const d = new Date(prev);
                d.setDate(d.getDate() - 7);
                return weekMonday(d);
              })}
              aria-label="Semana anterior"
            >
              {"\u2190"}
            </button>
            <span className="text-sm font-semibold text-gray-700">{rangeLabel}</span>
            <button
              type="button"
              className="rounded-md border border-gray-200 px-2 py-2 text-sm hover:bg-gray-50"
              onClick={() => setWeekStart((prev) => {
                const d = new Date(prev);
                d.setDate(d.getDate() + 7);
                return weekMonday(d);
              })}
              aria-label="Proxima semana"
            >
              {"\u2192"}
            </button>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <section className="xl:col-span-2">
          {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
          {loading ? <p className="mb-3 text-sm text-gray-500">Carregando...</p> : null}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {days.map((d) => {
              const dayStr = ymdLocal(d);
              const slots = agenda
                .filter((a) => String(a.data).slice(0, 10) === dayStr)
                .sort((a, b) => String(a.hora_inicio).localeCompare(String(b.hora_inicio)));

              return (
                <div key={dayStr} className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-sm font-semibold text-[var(--marrom)]">{fmtShort(d)}</div>
                    {terapeutaId ? (
                      <button
                        type="button"
                        className="text-xs text-[var(--laranja)] hover:underline"
                        onClick={() => setData(dayStr)}
                      >
                        + reservar
                      </button>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    {!terapeutaId ? (
                      <p className="text-xs text-gray-500">Selecione um terapeuta</p>
                    ) : slots.length ? (
                      slots.map((a) => (
                        <div
                          key={a.id}
                          className="rounded-md border border-gray-100 bg-gray-50 px-2 py-2"
                        >
                          <div className="text-xs font-semibold text-gray-800">
                            {String(a.hora_inicio).slice(0, 5)} - {String(a.hora_fim).slice(0, 5)}
                          </div>
                          <div className="text-xs text-gray-600">{a.pacienteNome}</div>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-gray-500">Sem agendamentos</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-xl border border-[#f4e0bc] bg-[#fff8ec] p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-[var(--marrom)]">Reservar horario</h2>
          <div className="mt-3 space-y-2 text-sm">
            <label className="block text-gray-700">
              Data
              <input
                type="date"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
                value={data}
                onChange={(e) => setData(e.target.value)}
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-gray-700">
                Inicio
                <input
                  type="time"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
                  value={inicio}
                  onChange={(e) => setInicio(e.target.value)}
                />
              </label>
              <label className="block text-gray-700">
                Fim
                <input
                  type="time"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
                  value={fim}
                  onChange={(e) => setFim(e.target.value)}
                />
              </label>
            </div>
            <label className="block text-gray-700">
              Paciente
              <select
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
                value={pacienteId}
                onChange={(e) => setPacienteId(e.target.value)}
              >
                <option value="">Selecione</option>
                {pacientes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.id} - {p.nome}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-gray-700">
              Observacoes
              <textarea
                rows={2}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Opcional"
              />
            </label>
            <button
              type="button"
              className="mt-1 w-full rounded-lg bg-[var(--laranja)] px-4 py-2 font-semibold text-white hover:bg-[#e6961f] disabled:opacity-60"
              onClick={() => void reservar()}
              disabled={!terapeutaId || !pacienteId || saving}
            >
              {saving ? "Salvando..." : "Reservar"}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
