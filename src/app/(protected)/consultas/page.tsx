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
  periodo_inicio?: string | null;
  periodo_fim?: string | null;
  presenca: string;
  motivo: string | null;
  observacoes: string | null;
};

function normalizeApiError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Erro na requisicao";
}

function getApiErrorMessage(json: unknown): string | null {
  if (!json || typeof json !== "object") return null;
  const rec = json as Record<string, unknown>;
  const value = rec.error;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

async function safeJson(resp: Response): Promise<unknown> {
  try {
    return await resp.json();
  } catch {
    return {};
  }
}

function ymdToday(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function ymdForInput(value: unknown): string {
  const raw = String(value || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : "";
}

function hhmmForInput(value: unknown): string {
  const raw = String(value || "");
  if (/^\d{2}:\d{2}:\d{2}$/.test(raw)) return raw.slice(0, 5);
  if (/^\d{2}:\d{2}$/.test(raw)) return raw;
  return "";
}

function dayNamePtBr(dow: number): string {
  const names = ["Domingo", "Segunda", "Terca", "Quarta", "Quinta", "Sexta", "Sabado"];
  return names[dow] ?? String(dow);
}

function dowFromYmdUtc(ymd: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return new Date().getUTCDay();
  return new Date(`${ymd}T00:00:00.000Z`).getUTCDay();
}

export default function ConsultasPage() {
  const [terapeutas, setTerapeutas] = useState<Terapeuta[]>([]);
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [items, setItems] = useState<Atendimento[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [pacienteId, setPacienteId] = useState<string>("");
  const [terapeutaId, setTerapeutaId] = useState<string>("");
  const [dataIni, setDataIni] = useState<string>(ymdToday());
  const [dataFim, setDataFim] = useState<string>(ymdToday());

  const [editOpen, setEditOpen] = useState(false);
  const [editItem, setEditItem] = useState<Atendimento | null>(null);
  const [editMsg, setEditMsg] = useState<string | null>(null);
  const [editBusy, setEditBusy] = useState(false);
  const [editData, setEditData] = useState<string>("");
  const [editTerapeutaId, setEditTerapeutaId] = useState<string>("");
  const [editHoraInicio, setEditHoraInicio] = useState<string>("");
  const [editHoraFim, setEditHoraFim] = useState<string>("");
  const [editTurno, setEditTurno] = useState<string>("Matutino");
  const [editPeriodoInicio, setEditPeriodoInicio] = useState<string>("");
  const [editPeriodoFim, setEditPeriodoFim] = useState<string>("");
  const [editPresenca, setEditPresenca] = useState<string>("Nao informado");
  const [editMotivo, setEditMotivo] = useState<string>("");

  const [delOpen, setDelOpen] = useState(false);
  const [delItem, setDelItem] = useState<Atendimento | null>(null);
  const [delBusy, setDelBusy] = useState(false);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (pacienteId) params.set("pacienteId", pacienteId);
    if (terapeutaId) params.set("terapeutaId", terapeutaId);
    if (dataIni) params.set("dataIni", dataIni);
    if (dataFim) params.set("dataFim", dataFim);
    return params.toString();
  }, [pacienteId, terapeutaId, dataIni, dataFim]);

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
      const json = await safeJson(resp);
      if (!resp.ok) throw new Error(getApiErrorMessage(json) || "Erro ao listar atendimentos");
      setItems(Array.isArray(json) ? (json as Atendimento[]) : []);
    } catch (err) {
      setError(normalizeApiError(err));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  function openEdit(a: Atendimento) {
    setEditItem(a);
    setEditOpen(true);
    setEditMsg(null);

    setEditData(ymdForInput(a.data));
    setEditTerapeutaId(a.terapeuta_id ? String(a.terapeuta_id) : "");
    setEditHoraInicio(hhmmForInput(a.hora_inicio));
    setEditHoraFim(hhmmForInput(a.hora_fim));
    setEditTurno(a.turno || "Matutino");
    setEditPeriodoInicio(ymdForInput(a.periodo_inicio));
    setEditPeriodoFim(ymdForInput(a.periodo_fim));
    setEditPresenca(a.presenca || "Nao informado");
    setEditMotivo(String(a.motivo || a.observacoes || ""));
  }

  function closeEdit() {
    setEditOpen(false);
    setEditItem(null);
    setEditBusy(false);
  }

  async function submitEdit() {
    if (!editItem) return;
    setEditMsg(null);

    const terapeutaIdNum = Number(editTerapeutaId);
    if (!terapeutaIdNum || !editData || !editHoraInicio || !editHoraFim) {
      setEditMsg("Preencha terapeuta, data e horarios.");
      return;
    }

    const motivo = editMotivo.trim();
    if (editPresenca === "Ausente" && !motivo) {
      setEditMsg("Informe o motivo da ausencia.");
      return;
    }

    setEditBusy(true);
    try {
      const resp = await fetch(`/api/atendimentos/${editItem.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          pacienteId: editItem.paciente_id,
          terapeutaId: terapeutaIdNum,
          data: editData,
          horaInicio: editHoraInicio,
          horaFim: editHoraFim,
          turno: editTurno || "Matutino",
          periodoInicio: editPeriodoInicio || null,
          periodoFim: editPeriodoFim || null,
          presenca: editPresenca || "Nao informado",
          motivo: motivo || null,
          observacoes: null,
        }),
      });
      const json = await safeJson(resp);
      if (!resp.ok) throw new Error(getApiErrorMessage(json) || "Erro ao atualizar atendimento");
      closeEdit();
      await loadAtendimentos();
    } catch (err) {
      setEditMsg(normalizeApiError(err));
    } finally {
      setEditBusy(false);
    }
  }

  function openDelete(a: Atendimento) {
    setDelItem(a);
    setDelOpen(true);
    setDelBusy(false);
  }

  function closeDelete() {
    setDelOpen(false);
    setDelItem(null);
    setDelBusy(false);
  }

  async function confirmDelete() {
    if (!delItem) return;
    setDelBusy(true);
    try {
      const resp = await fetch(`/api/atendimentos/${delItem.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const json = await safeJson(resp);
      if (!resp.ok) throw new Error(getApiErrorMessage(json) || "Erro ao excluir atendimento");
      closeDelete();
      await loadAtendimentos();
    } catch (err) {
      setError(normalizeApiError(err));
      setDelBusy(false);
    }
  }

  async function excluirPorPeriodo(a: Atendimento) {
    const dataYmd = ymdForInput(a.data);
    const dia = dowFromYmdUtc(dataYmd);
    const nomeDia = dayNamePtBr(dia);
    const periodoIni = ymdForInput(a.periodo_inicio || a.data);
    const periodoFim = ymdForInput(a.periodo_fim || a.data);
    const ok = window.confirm(
      `Excluir todos os atendimentos de ${nomeDia} entre ${periodoIni} e ${periodoFim}?`
    );
    if (!ok) return;

    setError(null);
    try {
      const resp = await fetch("/api/atendimentos/excluir-dia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          pacienteId: a.paciente_id,
          horaInicio: hhmmForInput(a.hora_inicio) || String(a.hora_inicio),
          horaFim: hhmmForInput(a.hora_fim) || String(a.hora_fim),
          turno: a.turno || "Matutino",
          periodoInicio: periodoIni,
          periodoFim: periodoFim,
          diaSemana: dia,
        }),
      });
      const json = await safeJson(resp);
      if (!resp.ok) throw new Error(getApiErrorMessage(json) || "Erro ao excluir atendimentos do dia");
      await loadAtendimentos();
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

        <div className="grid gap-3 md:grid-cols-5">
          <label className="text-sm">
            <span className="mb-1 block font-semibold text-[var(--marrom)]">Paciente</span>
            <select
              className="w-full rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
              value={pacienteId}
              onChange={(e) => setPacienteId(e.target.value)}
            >
              <option value="">Todos</option>
              {pacientes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
          </label>
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
                setPacienteId("");
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
                <th className="px-3 py-2">Data / Periodo</th>
                <th className="px-3 py-2">Paciente</th>
                <th className="px-3 py-2">Terapeuta</th>
                <th className="px-3 py-2">Horario</th>
                <th className="px-3 py-2">Presenca</th>
                <th className="px-3 py-2">Motivo/Obs</th>
                <th className="px-3 py-2 text-center">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {items.map((a) => (
                <tr key={a.id} className="border-b border-gray-100 text-sm">
                  <td className="px-3 py-3 text-gray-700">
                    <div className="font-semibold">{String(a.data).slice(0, 10)}</div>
                    {a.periodo_inicio || a.periodo_fim ? (
                      <div className="text-xs text-gray-500">
                        Periodo: {String(a.periodo_inicio || "-").slice(0, 10)} ate{" "}
                        {String(a.periodo_fim || "-").slice(0, 10)}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-3 py-3 font-semibold text-[var(--marrom)]">{a.pacienteNome}</td>
                  <td className="px-3 py-3 text-gray-700">{a.terapeutaNome || "-"}</td>
                  <td className="px-3 py-3 text-gray-700">
                    {String(a.hora_inicio).slice(0, 5)} - {String(a.hora_fim).slice(0, 5)}
                  </td>
                  <td className="px-3 py-3 text-gray-700">{a.presenca}</td>
                  <td className="px-3 py-3 text-gray-700">
                    {(a.observacoes || a.motivo || "-").toString().slice(0, 120)}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(a)}
                        className="inline-flex items-center rounded-full border border-blue-200 px-3 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => openDelete(a)}
                        className="inline-flex items-center rounded-full border border-red-200 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-50"
                      >
                        Excluir
                      </button>
                      <button
                        type="button"
                        onClick={() => void excluirPorPeriodo(a)}
                        className="inline-flex items-center rounded-full border border-amber-200 px-3 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-50"
                      >
                        Excluir por periodo
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && !items.length ? (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-sm text-gray-500">
                    Nenhum atendimento encontrado.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {editOpen && editItem ? (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4"
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeEdit();
          }}
        >
          <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">Editar atendimento</p>
                <h3 className="text-lg font-bold text-[var(--marrom)]">{editItem.pacienteNome}</h3>
              </div>
              <button
                type="button"
                className="text-2xl leading-none text-gray-500 hover:text-[var(--laranja)]"
                aria-label="Fechar"
                onClick={closeEdit}
              >
                &times;
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
              <label className="flex flex-col gap-2">
                <span className="font-semibold text-gray-700">Data do atendimento</span>
                <input
                  type="date"
                  className="rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
                  value={editData}
                  onChange={(e) => setEditData(e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="font-semibold text-gray-700">Terapeuta</span>
                <select
                  className="rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
                  value={editTerapeutaId}
                  onChange={(e) => setEditTerapeutaId(e.target.value)}
                >
                  <option value="">Selecione</option>
                  {terapeutas.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nome}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-2">
                <span className="font-semibold text-gray-700">Horario inicio</span>
                <input
                  type="time"
                  className="rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
                  value={editHoraInicio}
                  onChange={(e) => setEditHoraInicio(e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="font-semibold text-gray-700">Horario fim</span>
                <input
                  type="time"
                  className="rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
                  value={editHoraFim}
                  onChange={(e) => setEditHoraFim(e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="font-semibold text-gray-700">Turno</span>
                <select
                  className="rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
                  value={editTurno}
                  onChange={(e) => setEditTurno(e.target.value)}
                >
                  <option value="Matutino">Matutino</option>
                  <option value="Vespertino">Vespertino</option>
                </select>
              </label>
              <label className="flex flex-col gap-2">
                <span className="font-semibold text-gray-700">Periodo - inicio</span>
                <input
                  type="date"
                  className="rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
                  value={editPeriodoInicio}
                  onChange={(e) => setEditPeriodoInicio(e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="font-semibold text-gray-700">Periodo - fim</span>
                <input
                  type="date"
                  className="rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
                  value={editPeriodoFim}
                  onChange={(e) => setEditPeriodoFim(e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="font-semibold text-gray-700">Presenca</span>
                <select
                  className="rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
                  value={editPresenca}
                  onChange={(e) => setEditPresenca(e.target.value)}
                >
                  <option value="Nao informado">Nao informado</option>
                  <option value="Presente">Presente</option>
                  <option value="Ausente">Ausente</option>
                </select>
              </label>
              <label className="flex flex-col gap-2 md:col-span-2">
                <span className="font-semibold text-gray-700">Motivo/Observacao</span>
                <textarea
                  rows={3}
                  className="rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
                  value={editMotivo}
                  onChange={(e) => setEditMotivo(e.target.value)}
                  placeholder="Motivo da ausencia ou observacoes"
                />
              </label>
            </div>

            {editMsg ? <p className="mt-3 text-sm text-red-600">{editMsg}</p> : null}

            <div className="mt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeEdit}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                disabled={editBusy}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void submitEdit()}
                className="rounded-lg bg-[var(--laranja)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#e6961f] disabled:opacity-60"
                disabled={editBusy}
              >
                {editBusy ? "Salvando..." : "Salvar alteracoes"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {delOpen && delItem ? (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4"
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeDelete();
          }}
        >
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-[var(--marrom)]">Excluir atendimento</h3>
            <p className="mt-2 text-sm text-gray-700">
              Deseja excluir o atendimento de{" "}
              <span className="font-semibold text-[var(--marrom)]">{delItem.pacienteNome}</span>?
            </p>
            <div className="mt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeDelete}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                disabled={delBusy}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void confirmDelete()}
                className="rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-60"
                disabled={delBusy}
              >
                {delBusy ? "Excluindo..." : "Excluir"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
