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

type BloqueioAgenda = {
  id: string;
  terapeutaId: number;
  data: string;
  horaInicio: string;
  horaFim: string;
  observacoes?: string | null;
};

const BLOQUEIOS_STORAGE_KEY = "calendario.bloqueios";

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

function dowFromYmd(value: string): number | null {
  const dt = parseYmdToLocalDate(value);
  if (!dt) return null;
  return dt.getDay();
}

function normalizeApiError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Erro na requisicao";
}

function overlaps(h1i: string, h1f: string, h2i: string, h2f: string): boolean {
  return h1f > h2i && h1i < h2f;
}

function parseBloqueiosStorage(): BloqueioAgenda[] {
  try {
    const raw = localStorage.getItem(BLOQUEIOS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && typeof item === "object")
      .map((item) => {
        const rec = item as Record<string, unknown>;
        return {
          id: String(rec.id ?? ""),
          terapeutaId: Number(rec.terapeutaId ?? 0),
          data: String(rec.data ?? "").slice(0, 10),
          horaInicio: String(rec.horaInicio ?? "").slice(0, 5),
          horaFim: String(rec.horaFim ?? "").slice(0, 5),
          observacoes: typeof rec.observacoes === "string" ? rec.observacoes : null,
        } satisfies BloqueioAgenda;
      })
      .filter(
        (b) =>
          b.id &&
          Number.isFinite(b.terapeutaId) &&
          b.terapeutaId > 0 &&
          /^\d{4}-\d{2}-\d{2}$/.test(b.data) &&
          /^\d{2}:\d{2}$/.test(b.horaInicio) &&
          /^\d{2}:\d{2}$/.test(b.horaFim)
      );
  } catch {
    return [];
  }
}

function saveBloqueiosStorage(items: BloqueioAgenda[]) {
  try {
    localStorage.setItem(BLOQUEIOS_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // ignore
  }
}

export default function CalendarioPage() {
  const [terapeutas, setTerapeutas] = useState<Terapeuta[]>([]);
  const [pacientes, setPacientes] = useState<Paciente[]>([]);

  const [terapeutaId, setTerapeutaId] = useState<string>("");
  const [weekStart, setWeekStart] = useState<Date>(() => weekMonday());
  const [agenda, setAgenda] = useState<Atendimento[]>([]);
  const [bloqueios, setBloqueios] = useState<BloqueioAgenda[]>([]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [data, setData] = useState<string>(() => ymdLocal(new Date()));
  const [reservaModo, setReservaModo] = useState<"dia" | "periodo">("dia");
  const [periodoInicio, setPeriodoInicio] = useState<string>(() => ymdLocal(new Date()));
  const [periodoFim, setPeriodoFim] = useState<string>(() => ymdLocal(new Date()));
  const [diasSemana, setDiasSemana] = useState<Set<number>>(() => {
    const today = new Date().getDay();
    return new Set([today]);
  });
  const [inicio, setInicio] = useState<string>("08:00");
  const [fim, setFim] = useState<string>("09:00");
  const [pacienteId, setPacienteId] = useState<string>("");
  const [observacoes, setObservacoes] = useState<string>("");
  const [bloquearHorario, setBloquearHorario] = useState(false);

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
    if (!terapeutaId || !inicio || !fim) return;
    if (!bloquearHorario && !pacienteId) return;
    if (reservaModo === "dia" && !data) return;
    if (reservaModo === "periodo" && (!periodoInicio || !periodoFim || !diasSemana.size)) return;
    setSaving(true);
    setError(null);
    try {
      const terapeutaNum = Number(terapeutaId);
      if (!Number.isFinite(terapeutaNum) || terapeutaNum <= 0) {
        throw new Error("Selecione um terapeuta");
      }
      if (inicio >= fim) {
        throw new Error("Horario inicial deve ser menor que o final");
      }

      const bloqueiosTerapeuta = bloqueios.filter((b) => b.terapeutaId === terapeutaNum);
      const hasAgendaConflict = (dateStr: string) =>
        agenda.some(
          (a) =>
            String(a.data).slice(0, 10) === dateStr &&
            Number(a.terapeuta_id ?? 0) === terapeutaNum &&
            overlaps(inicio, fim, String(a.hora_inicio).slice(0, 5), String(a.hora_fim).slice(0, 5))
        );
      const hasBlockConflict = (dateStr: string) =>
        bloqueiosTerapeuta.some(
          (b) => b.data === dateStr && overlaps(inicio, fim, b.horaInicio, b.horaFim)
        );

      if (bloquearHorario) {
        const next = [...bloqueios];
        let added = 0;
        const pushIfValid = (dateStr: string) => {
          if (hasAgendaConflict(dateStr)) {
            throw new Error(`Ja existe reserva neste horario em ${dateStr}`);
          }
          if (next.some((b) => b.terapeutaId === terapeutaNum && b.data === dateStr && overlaps(inicio, fim, b.horaInicio, b.horaFim))) {
            throw new Error(`Ja existe bloqueio neste horario em ${dateStr}`);
          }
          next.push({
            id: `${terapeutaNum}-${dateStr}-${inicio}-${fim}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            terapeutaId: terapeutaNum,
            data: dateStr,
            horaInicio: inicio,
            horaFim: fim,
            observacoes: observacoes.trim() || null,
          });
          added += 1;
        };

        if (reservaModo === "dia") {
          pushIfValid(data);
        } else {
          const ini = parseYmdToLocalDate(periodoInicio);
          const fimDt = parseYmdToLocalDate(periodoFim);
          if (!ini || !fimDt) throw new Error("Periodo invalido");
          if (ini > fimDt) throw new Error("Periodo inicial maior que final");
          for (let dt = new Date(ini); dt <= fimDt; dt.setDate(dt.getDate() + 1)) {
            const dow = dt.getDay();
            if (!diasSemana.has(dow)) continue;
            pushIfValid(ymdLocal(dt));
          }
        }

        if (!added) {
          throw new Error("Nenhum bloqueio gerado para o periodo e dias selecionados");
        }
        saveBloqueiosStorage(next);
        setBloqueios(next);
        setObservacoes("");
        return;
      }

      if (reservaModo === "dia" && hasBlockConflict(data)) {
        throw new Error("Horario bloqueado na agenda");
      }
      if (reservaModo === "periodo") {
        const ini = parseYmdToLocalDate(periodoInicio);
        const fimDt = parseYmdToLocalDate(periodoFim);
        if (!ini || !fimDt) throw new Error("Periodo invalido");
        if (ini > fimDt) throw new Error("Periodo inicial maior que final");
        for (let dt = new Date(ini); dt <= fimDt; dt.setDate(dt.getDate() + 1)) {
          const dow = dt.getDay();
          if (!diasSemana.has(dow)) continue;
          if (hasBlockConflict(ymdLocal(dt))) {
            throw new Error(`Horario bloqueado em ${ymdLocal(dt)}`);
          }
        }
      }

      const turno = Number(inicio.split(":")[0]) < 12 ? "Matutino" : "Vespertino";
      const endpoint = reservaModo === "periodo" ? "/api/atendimentos/recorrente" : "/api/atendimentos";
      const payload =
        reservaModo === "periodo"
          ? {
              pacienteId,
              terapeutaId,
              horaInicio: inicio,
              horaFim: fim,
              turno,
              periodoInicio,
              periodoFim,
              presenca: "Nao informado",
              observacoes: observacoes || null,
              motivo: null,
              diasSemana: Array.from(diasSemana.values()).sort((a, b) => a - b),
            }
          : {
              pacienteId,
              terapeutaId,
              data,
              horaInicio: inicio,
              horaFim: fim,
              turno,
              presenca: "Nao informado",
              observacoes: observacoes || null,
            };
      const resp = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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

  function removerBloqueio(id: string) {
    setBloqueios((current) => {
      const next = current.filter((b) => b.id !== id);
      saveBloqueiosStorage(next);
      return next;
    });
  }

  function toggleDiaSemana(dow: number) {
    setDiasSemana((current) => {
      const next = new Set(current);
      if (next.has(dow)) next.delete(dow);
      else next.add(dow);
      return next;
    });
  }

  useEffect(() => {
    setBloqueios(parseBloqueiosStorage());
  }, []);

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

        // Prefer therapist from URL when provided; otherwise start unselected.
        const search = new URLSearchParams(window.location.search);
        const qsTerapeutaId = (search.get("terapeutaId") ?? "").trim();
        const qsData = (search.get("data") ?? "").trim();

        const candidate =
          qsTerapeutaId ||
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
    try {
      const url = new URL(window.location.href);
      if (terapeutaId) url.searchParams.set("terapeutaId", terapeutaId);
      else url.searchParams.delete("terapeutaId");
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
            <h1 className="text-2xl font-bold text-[var(--marrom)]">Agenda</h1>
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
              const bloqueiosDia = bloqueios
                .filter((b) => b.terapeutaId === Number(terapeutaId || 0) && b.data === dayStr)
                .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
              const merged = [
                ...slots.map((a) => ({ kind: "atendimento" as const, item: a })),
                ...bloqueiosDia.map((b) => ({ kind: "bloqueio" as const, item: b })),
              ].sort((x, y) => {
                const hx =
                  x.kind === "atendimento"
                    ? String(x.item.hora_inicio).slice(0, 5)
                    : x.item.horaInicio;
                const hy =
                  y.kind === "atendimento"
                    ? String(y.item.hora_inicio).slice(0, 5)
                    : y.item.horaInicio;
                return hx.localeCompare(hy);
              });

              return (
                <div key={dayStr} className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-sm font-semibold text-[var(--marrom)]">{fmtShort(d)}</div>
                    {terapeutaId ? (
                      <button
                        type="button"
                        className="text-xs text-[var(--laranja)] hover:underline"
                        onClick={() => {
                          setData(dayStr);
                          setPeriodoInicio(dayStr);
                          setPeriodoFim(dayStr);
                          const dow = dowFromYmd(dayStr);
                          if (dow !== null) setDiasSemana(new Set([dow]));
                        }}
                      >
                        + reservar
                      </button>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    {!terapeutaId ? (
                      <p className="text-xs text-gray-500">Selecione um terapeuta</p>
                    ) : merged.length ? (
                      merged.map((entry) =>
                        entry.kind === "atendimento" ? (
                          <div
                            key={`a-${entry.item.id}`}
                            className="rounded-md border border-gray-100 bg-gray-50 px-2 py-2"
                          >
                            <div className="text-xs font-semibold text-gray-800">
                              {String(entry.item.hora_inicio).slice(0, 5)} - {String(entry.item.hora_fim).slice(0, 5)}
                            </div>
                            <div className="text-xs text-gray-600">{entry.item.pacienteNome}</div>
                          </div>
                        ) : (
                          <div
                            key={`b-${entry.item.id}`}
                            className="rounded-md border border-amber-200 bg-amber-50 px-2 py-2"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="text-xs font-semibold text-amber-800">
                                  {entry.item.horaInicio} - {entry.item.horaFim}
                                </div>
                                <div className="text-xs text-amber-700">Horario bloqueado</div>
                                {entry.item.observacoes ? (
                                  <div className="mt-1 text-[11px] text-amber-700">
                                    {entry.item.observacoes}
                                  </div>
                                ) : null}
                              </div>
                              <button
                                type="button"
                                className="text-[11px] font-semibold text-amber-700 hover:underline"
                                onClick={() => removerBloqueio(entry.item.id)}
                                title="Desbloquear horario"
                              >
                                Desbloquear
                              </button>
                            </div>
                          </div>
                        )
                      )
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
              Tipo de reserva
              <select
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
                value={reservaModo}
                onChange={(e) => setReservaModo(e.target.value === "periodo" ? "periodo" : "dia")}
              >
                <option value="dia">Data unica</option>
                <option value="periodo">Por periodo</option>
              </select>
            </label>
            {reservaModo === "dia" ? (
              <label className="block text-gray-700">
                Data
                <input
                  type="date"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                />
              </label>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block text-gray-700">
                    Periodo - inicio
                    <input
                      type="date"
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
                      value={periodoInicio}
                      onChange={(e) => setPeriodoInicio(e.target.value)}
                    />
                  </label>
                  <label className="block text-gray-700">
                    Periodo - fim
                    <input
                      type="date"
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
                      value={periodoFim}
                      onChange={(e) => setPeriodoFim(e.target.value)}
                    />
                  </label>
                </div>
                <div>
                  <p className="text-gray-700">Dias da semana</p>
                  <div className="mt-1 grid grid-cols-2 gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2">
                    {[
                      { v: 1, label: "Segunda" },
                      { v: 2, label: "Terca" },
                      { v: 3, label: "Quarta" },
                      { v: 4, label: "Quinta" },
                      { v: 5, label: "Sexta" },
                      { v: 6, label: "Sabado" },
                      { v: 0, label: "Domingo" },
                    ].map((d) => (
                      <label key={d.v} className="inline-flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          className="rounded text-[var(--laranja)]"
                          checked={diasSemana.has(d.v)}
                          onChange={() => toggleDiaSemana(d.v)}
                        />
                        <span>{d.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </>
            )}
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
            <label className="inline-flex items-center gap-2 text-gray-700">
              <input
                type="checkbox"
                className="rounded text-[var(--laranja)]"
                checked={bloquearHorario}
                onChange={(e) => setBloquearHorario(e.target.checked)}
              />
              <span>Bloquear horario (sem paciente)</span>
            </label>
            {bloquearHorario ? (
              <p className="text-xs text-amber-700">
                Bloqueio local desta agenda (salvo neste navegador).
              </p>
            ) : null}
            {!bloquearHorario ? (
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
            ) : null}
            <label className="block text-gray-700">
              Observacoes {bloquearHorario ? "(motivo do bloqueio)" : ""}
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
              disabled={!terapeutaId || (!bloquearHorario && !pacienteId) || saving}
            >
              {saving
                ? "Salvando..."
                : bloquearHorario
                  ? reservaModo === "periodo"
                    ? "Bloquear por periodo"
                    : "Bloquear horario"
                  : reservaModo === "periodo"
                    ? "Reservar por periodo"
                    : "Reservar"}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
