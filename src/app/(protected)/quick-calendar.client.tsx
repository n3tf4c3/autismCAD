"use client";

import type { MouseEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

type MiniAtendimento = {
  id: number;
  data: string;
  hora_inicio: string;
  hora_fim: string;
  pacienteNome: string;
  terapeutaNome: string | null;
  realizado: number;
  presenca?: string | null;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function ymdLocal(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function monthLabel(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  const dt = new Date(y, (m ?? 1) - 1, 1);
  return dt.toLocaleString("pt-BR", { month: "long", year: "numeric" });
}

function monthShift(ym: string, deltaMonths: number) {
  const [y, m] = ym.split("-").map(Number);
  const dt = new Date(y, (m ?? 1) - 1 + deltaMonths, 1);
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}`;
}

function buildByDate(items: MiniAtendimento[]) {
  const by: Record<string, MiniAtendimento[]> = {};
  for (const a of items) {
    const iso = String(a.data).slice(0, 10);
    if (!iso) continue;
    (by[iso] ||= []).push(a);
  }
  for (const iso of Object.keys(by)) {
    by[iso].sort((x, y) => String(x.hora_inicio).localeCompare(String(y.hora_inicio)));
  }
  return by;
}

function getMonthRange(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  const year = y || new Date().getFullYear();
  const month1 = m || new Date().getMonth() + 1; // 1..12
  const first = new Date(year, month1 - 1, 1);
  const lastDay = new Date(year, month1, 0).getDate();
  const last = new Date(year, month1 - 1, lastDay);
  return { dataIni: ymdLocal(first), dataFim: ymdLocal(last) };
}

type TooltipState = {
  open: boolean;
  x: number;
  y: number;
  items: MiniAtendimento[];
};

export function QuickCalendarClient(props: {
  initialYm: string;
  initialItems: MiniAtendimento[];
}) {
  const cacheRef = useRef<Map<string, MiniAtendimento[]>>(new Map());
  const [ym, setYm] = useState(props.initialYm);
  const [items, setItems] = useState<MiniAtendimento[]>(props.initialItems);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [tooltip, setTooltip] = useState<TooltipState>({
    open: false,
    x: 0,
    y: 0,
    items: [],
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    cacheRef.current.set(props.initialYm, props.initialItems);
  }, [props.initialYm, props.initialItems]);

  useEffect(() => {
    const cached = cacheRef.current.get(ym);
    if (cached) {
      setItems(cached);
      return;
    }

    async function load() {
      setLoading(true);
      try {
        const { dataIni, dataFim } = getMonthRange(ym);
        const params = new URLSearchParams();
        params.set("dataIni", dataIni);
        params.set("dataFim", dataFim);
        const resp = await fetch(`/api/atendimentos?${params.toString()}`, { cache: "no-store" });
        const json = await resp.json();
        if (!resp.ok) throw new Error(json?.error || "Erro ao carregar atendimentos");
        const next = Array.isArray(json) ? (json as MiniAtendimento[]) : [];
        cacheRef.current.set(ym, next);
        setItems(next);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [ym]);

  const byDate = useMemo(() => buildByDate(items), [items]);
  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const monthInfo = useMemo(() => {
    const [y, m] = ym.split("-").map(Number);
    const first = new Date(y, (m ?? 1) - 1, 1);
    const offset = first.getDay(); // 0..6 (Sun..Sat)
    const daysInMonth = new Date(y, (m ?? 1), 0).getDate();
    const markedDays = new Set(Object.keys(byDate).filter((d) => d.startsWith(`${ym}-`)).map((d) => Number(d.slice(8, 10))));
    return { y, m, offset, daysInMonth, markedDays };
  }, [ym, byDate]);

  const daysWithSessionsCount = useMemo(() => {
    const prefix = `${ym}-`;
    const uniq = new Set(items.map((a) => String(a.data).slice(0, 10)).filter((d) => d.startsWith(prefix)));
    return uniq.size;
  }, [items, ym]);

  function hideTooltip() {
    setTooltip((cur) => (cur.open ? { ...cur, open: false } : cur));
  }

  function showTooltip(ev: MouseEvent<HTMLElement>, iso: string) {
    const list = byDate[iso] || [];
    if (!list.length) {
      hideTooltip();
      return;
    }
    const rect = ev.currentTarget.getBoundingClientRect();
    setTooltip({
      open: true,
      x: rect.left + rect.width / 2,
      y: rect.top - 10,
      items: list,
    });
  }

  const tooltipEl =
    mounted && tooltip.open
      ? createPortal(
          <div
            className="fixed z-50 w-64 rounded-lg border border-gray-200 bg-white p-3 text-xs text-gray-700 shadow-lg"
            style={{
              left: tooltip.x,
              top: tooltip.y,
              transform: "translate(-50%, -100%)",
            }}
            onMouseLeave={hideTooltip}
          >
            <p className="mb-1 font-semibold text-[var(--marrom)]">
              {tooltip.items.length} atendimento{tooltip.items.length === 1 ? "" : "s"}
            </p>
            {tooltip.items.slice(0, 3).map((a) => {
              const hi = String(a.hora_inicio ?? "").slice(0, 5);
              const hf = String(a.hora_fim ?? "").slice(0, 5);
              return (
                <div key={a.id} className="mb-2 last:mb-0">
                  <p className="font-semibold text-[var(--marrom)]">{a.pacienteNome || "Paciente"}</p>
                  <p className="text-gray-700">
                    Horario: {hi}
                    {hf ? ` - ${hf}` : ""}
                  </p>
                  <p className="text-gray-600">Terapeuta: {a.terapeutaNome || ""}</p>
                </div>
              );
            })}
            {tooltip.items.length > 3 ? (
              <p className="text-gray-500">+{tooltip.items.length - 3} atendimento(s)</p>
            ) : null}
          </div>,
          document.body
        )
      : null;

  return (
    <div className="relative">
      {tooltipEl}
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-[var(--marrom)]">{monthLabel(ym)}</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-md border border-gray-200 px-2 py-1 text-sm hover:bg-gray-50"
            onClick={() => {
              hideTooltip();
              setYm((cur) => monthShift(cur, -1));
            }}
            aria-label="Mes anterior"
          >
            {"\u2190"}
          </button>
          <span className="text-xs text-gray-600">
            {daysWithSessionsCount ? `${daysWithSessionsCount} dia(s)` : "Sem sessoes"}
            {loading ? " · carregando..." : ""}
          </span>
          <button
            type="button"
            className="rounded-md border border-gray-200 px-2 py-1 text-sm hover:bg-gray-50"
            onClick={() => {
              hideTooltip();
              setYm((cur) => monthShift(cur, 1));
            }}
            aria-label="Proximo mes"
          >
            {"\u2192"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-[11px] text-center text-gray-500">
        <span>Dom</span>
        <span>Seg</span>
        <span>Ter</span>
        <span>Qua</span>
        <span>Qui</span>
        <span>Sex</span>
        <span>Sab</span>
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1 text-sm" onMouseLeave={hideTooltip}>
        {Array.from({ length: monthInfo.offset }).map((_, i) => (
          <div key={`e-${i}`} className="h-8 text-xs text-gray-300" />
        ))}
        {Array.from({ length: monthInfo.daysInMonth }, (_, idx) => {
          const day = idx + 1;
          const iso = `${ym}-${pad2(day)}`;
          const isToday = iso === todayIso;
          const hasSession = monthInfo.markedDays.has(day);
          const className = [
            "h-8 flex items-center justify-center rounded-md text-sm border border-gray-100 cursor-pointer hover:border-[var(--laranja)]",
            isToday
              ? "bg-[var(--amarelo)] text-[var(--marrom)] font-semibold"
              : "bg-white text-[var(--texto)]",
            hasSession ? "relative" : "",
          ].join(" ");

          return (
            <div
              key={`d-${day}`}
              className={className}
              onMouseEnter={(ev) => showTooltip(ev, iso)}
            >
              {hasSession ? (
                <span className="absolute h-2 w-2 translate-y-[10px] rounded-full bg-[var(--verde)]" />
              ) : null}
              {day}
            </div>
          );
        })}
      </div>
    </div>
  );
}
