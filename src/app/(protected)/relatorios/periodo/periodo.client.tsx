"use client";

import { useMemo, useState } from "react";

type TimelineItem = {
  kind: "documento" | "evolucao";
  id: number;
  tipo: string;
  titulo: string | null;
  status: string | null;
  version: number | null;
  data: string;
  profissional: string | null;
};

type TipoFiltro = "" | "documento" | "evolucao";

function ymdToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function ymdMinusDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function fmtDate(value?: string | null): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("pt-BR");
}

function ymdFromUnknown(value?: string | null): string | null {
  if (!value) return null;
  // Accept ISO timestamps, date strings, or anything Date can parse.
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function normalizeApiError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Erro ao gerar relatorio";
}

function parseTipoFiltro(value: string): TipoFiltro {
  if (value === "documento" || value === "evolucao") return value;
  return "";
}

function readApiError(json: unknown): string | null {
  if (!json || typeof json !== "object") return null;
  const record = json as Record<string, unknown>;
  return typeof record.error === "string" ? record.error : null;
}

export function RelatorioPeriodoClient(props: { initialPacienteId?: number | null }) {
  const [pacienteId, setPacienteId] = useState(() =>
    props.initialPacienteId ? String(props.initialPacienteId) : ""
  );
  const [ini, setIni] = useState(ymdMinusDays(30));
  const [fim, setFim] = useState(ymdToday());
  const [tipo, setTipo] = useState<TipoFiltro>("");

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [items, setItems] = useState<TimelineItem[]>([]);

  const filtered = useMemo(() => {
    return items.filter((i) => {
      if (tipo && i.kind !== tipo) return false;
      const key = ymdFromUnknown(i.data);
      if (!key) return false;
      if (ini && key < ini) return false;
      if (fim && key > fim) return false;
      return true;
    });
  }, [fim, ini, items, tipo]);

  async function gerar() {
    setMsg(null);
    const pid = Number(pacienteId);
    if (!pid) {
      setMsg("Informe um paciente ID");
      return;
    }

    setLoading(true);
    try {
      const resp = await fetch(`/api/prontuario/${pid}`, { cache: "no-store" });
      const data = (await resp.json().catch(() => null)) as unknown;
      if (!resp.ok) {
        throw new Error(readApiError(data) || "Erro ao gerar relatorio");
      }
      setItems(Array.isArray(data) ? (data as TimelineItem[]) : []);
    } catch (err) {
      setItems([]);
      setMsg(normalizeApiError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="space-y-6">
      <section className="max-w-4xl rounded-xl bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-semibold text-[var(--marrom)]">Filtros</h3>
        <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-4">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-[var(--marrom)]">Paciente ID</span>
            <input
              value={pacienteId}
              onChange={(e) => setPacienteId(e.target.value)}
              inputMode="numeric"
              className="rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
              placeholder="ex: 1"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-[var(--marrom)]">Inicio</span>
            <input
              type="date"
              value={ini}
              onChange={(e) => setIni(e.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-[var(--marrom)]">Fim</span>
            <input
              type="date"
              value={fim}
              onChange={(e) => setFim(e.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-[var(--marrom)]">Tipo</span>
            <select
              value={tipo}
              onChange={(e) => setTipo(parseTipoFiltro(e.target.value))}
              className="rounded-lg border border-gray-200 px-3 py-2"
            >
              <option value="">Todos</option>
              <option value="documento">Documentos</option>
              <option value="evolucao">Evolucoes</option>
            </select>
          </label>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => void gerar()}
            disabled={loading}
            className="rounded-lg bg-[var(--laranja)] px-4 py-2 font-semibold text-white hover:bg-[#e6961f] disabled:opacity-60"
          >
            Gerar
          </button>
        </div>
        {msg ? <p className="mt-3 text-sm text-red-600">{msg}</p> : null}
        {loading ? <p className="mt-3 text-sm text-gray-600">Carregando...</p> : null}
      </section>

      <section className="rounded-xl bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-[var(--marrom)]">Registros</h3>
          <span className="text-sm text-gray-600">{filtered.length} registros</span>
        </div>
        <div className="space-y-3">
          {filtered.map((item) => (
            <div
              key={`${item.kind}-${item.id}`}
              className="rounded-lg border border-gray-100 p-4 shadow-sm"
            >
              <div className="mb-2 flex justify-between text-sm text-gray-600">
                <span>
                  {item.kind === "documento" ? "Documento" : "Evolucao"} - {item.tipo}
                </span>
                <span>{fmtDate(item.data)}</span>
              </div>
              <h4 className="font-semibold text-[var(--marrom)]">{item.titulo || "Registro"}</h4>
              <p className="text-sm text-gray-600">{item.profissional || "-"}</p>
            </div>
          ))}
          {!filtered.length ? (
            <p className="text-sm text-gray-500">Nenhum registro encontrado no recorte.</p>
          ) : null}
        </div>
      </section>
    </main>
  );
}
