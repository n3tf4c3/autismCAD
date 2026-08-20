"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { derivarTurno } from "@autismcad/validators/atendimentos/atendimentos.schema";
import {
  excluirAtendimentoAction,
  excluirDiaAtendimentosAction,
  listarAtendimentosAction,
  salvarAtendimentoAction,
} from "@/app/(protected)/consultas/consultas.actions";

type Atendimento = {
  id: number;
  pacienteId: number;
  profissionalId: number | null;
  pacienteNome: string;
  profissionalNome: string | null;
  data: string;
  horaInicio: string;
  horaFim: string;
  isGrupo: boolean;
  turno: string;
  periodoInicio: string | null;
  periodoFim: string | null;
  presenca: string;
  realizado: boolean | number;
  statusRepasse: string;
  resumoRepasse: string | null;
  motivo: string | null;
  observacoes: string | null;
};

type Profissional = { id: number; nome: string };
type Paciente = { id: number; nome: string };

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

function dataBr(value: unknown): string {
  const parts = ymdForInput(value).split("-");
  if (parts.length !== 3) return "-";
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function dayNamePtBr(dow: number): string {
  const names = ["Domingo", "Segunda", "Terca", "Quarta", "Quinta", "Sexta", "Sabado"];
  return names[dow] ?? String(dow);
}

function dowFromYmdUtc(ymd: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return new Date().getUTCDay();
  return new Date(`${ymd}T00:00:00.000Z`).getUTCDay();
}

export function ConsultasClient(props: {
  initialProfissionais: Profissional[];
  initialPacientes: Paciente[];
  canEditAtendimento: boolean;
  canDeleteAtendimento: boolean;
  canEditRepasse: boolean;
}) {
  const router = useRouter();
  const [profissionais] = useState<Profissional[]>(() => props.initialProfissionais);
  const [pacientes] = useState<Paciente[]>(() => props.initialPacientes);
  const [items, setItems] = useState<Atendimento[]>([]);
  const [loading, setLoading] = useState(false);
  // Achado 54: descarta respostas antigas de listagem que cheguem fora de ordem.
  const atendimentosReqRef = useRef(0);
  const [error, setError] = useState<string | null>(null);

  const [pacienteId, setPacienteId] = useState<string>("");
  const [profissionalId, setProfissionalId] = useState<string>("");
  const [dataIni, setDataIni] = useState<string>(ymdToday());
  const [dataFim, setDataFim] = useState<string>(ymdToday());

  const [editOpen, setEditOpen] = useState(false);
  const [editItem, setEditItem] = useState<Atendimento | null>(null);
  const [editMsg, setEditMsg] = useState<string | null>(null);
  const [editBusy, setEditBusy] = useState(false);
  const [editData, setEditData] = useState<string>("");
  const [editProfissionalId, setEditProfissionalId] = useState<string>("");
  const [editHoraInicio, setEditHoraInicio] = useState<string>("");
  const [editHoraFim, setEditHoraFim] = useState<string>("");
  const [editIsGrupo, setEditIsGrupo] = useState(false);
  const [editPeriodoInicio, setEditPeriodoInicio] = useState<string>("");
  const [editPeriodoFim, setEditPeriodoFim] = useState<string>("");
  const [editPresenca, setEditPresenca] = useState<string>("Nao informado");
  const [editMotivo, setEditMotivo] = useState<string>("");

  // Turno segue o horario de inicio (o servidor grava assim de qualquer forma);
  // exibir como campo derivado evita a divergencia de um select esquecido.
  const editTurno = derivarTurno(editHoraInicio);

  const [delOpen, setDelOpen] = useState(false);
  const [delItem, setDelItem] = useState<Atendimento | null>(null);
  const [delBusy, setDelBusy] = useState(false);

  const [periodoOpen, setPeriodoOpen] = useState(false);
  const [periodoItem, setPeriodoItem] = useState<Atendimento | null>(null);
  const [periodoEscopo, setPeriodoEscopo] = useState<"todos" | "profissional">("todos");
  const [periodoProfissionalId, setPeriodoProfissionalId] = useState<string>("");
  const [periodoMsg, setPeriodoMsg] = useState<string | null>(null);
  const [periodoBusy, setPeriodoBusy] = useState(false);

  async function loadAtendimentos(overrides?: {
    pacienteId?: string;
    profissionalId?: string;
    dataIni?: string;
    dataFim?: string;
  }) {
    const reqId = ++atendimentosReqRef.current;
    setLoading(true);
    setError(null);
    try {
      // Overrides evitam ler estado defasado quando o load roda logo apos setState.
      const filters = {
        pacienteId: (overrides?.pacienteId ?? pacienteId) || undefined,
        profissionalId: (overrides?.profissionalId ?? profissionalId) || undefined,
        dataIni: (overrides?.dataIni ?? dataIni) || undefined,
        dataFim: (overrides?.dataFim ?? dataFim) || undefined,
      };
      const result = await listarAtendimentosAction(filters);
      if (reqId !== atendimentosReqRef.current) return;
      if (!result.ok) throw new Error(result.error || "Erro ao listar atendimentos");
      setItems(result.data.items);
    } catch (err) {
      if (reqId !== atendimentosReqRef.current) return;
      setError(normalizeApiError(err));
      setItems([]);
    } finally {
      if (reqId === atendimentosReqRef.current) setLoading(false);
    }
  }

  function openEdit(a: Atendimento) {
    setEditItem(a);
    setEditOpen(true);
    setEditMsg(null);

    setEditData(ymdForInput(a.data));
    setEditProfissionalId(a.profissionalId ? String(a.profissionalId) : "");
    setEditHoraInicio(hhmmForInput(a.horaInicio));
    setEditHoraFim(hhmmForInput(a.horaFim));
    setEditIsGrupo(Boolean(a.isGrupo));
    setEditPeriodoInicio(ymdForInput(a.periodoInicio));
    setEditPeriodoFim(ymdForInput(a.periodoFim));
    setEditPresenca(a.presenca || "Nao informado");
    setEditMotivo(String(a.motivo || a.observacoes || ""));
  }

  function closeEdit() {
    setEditOpen(false);
    setEditItem(null);
    setEditBusy(false);
  }

  function openRepasseEvolucao(a: Atendimento) {
    const params = new URLSearchParams();
    params.set("atendimentoId", String(a.id));
    if (a.profissionalId) params.set("profissionalId", String(a.profissionalId));
    const dataYmd = ymdForInput(a.data);
    if (dataYmd) params.set("data", dataYmd);
    router.push(`/prontuario/${a.pacienteId}/evolucao/nova?${params.toString()}`);
  }

  async function submitEdit() {
    if (!editItem) return;
    setEditMsg(null);

    const profissionalIdNum = Number(editProfissionalId);
    if (!profissionalIdNum || !editData || !editHoraInicio || !editHoraFim) {
      setEditMsg("Preencha profissional, data e horarios.");
      return;
    }

    const motivo = editMotivo.trim();
    if (editPresenca === "Ausente" && !motivo) {
      setEditMsg("Informe o motivo da ausencia.");
      return;
    }

    setEditBusy(true);
    try {
      const result = await salvarAtendimentoAction(editItem.id, {
        pacienteId: editItem.pacienteId,
        profissionalId: profissionalIdNum,
        data: editData,
        horaInicio: editHoraInicio,
        horaFim: editHoraFim,
        isGrupo: editIsGrupo,
        turno: editTurno,
        periodoInicio: editPeriodoInicio || null,
        periodoFim: editPeriodoFim || null,
        presenca: editPresenca || "Nao informado",
        motivo: motivo || null,
        observacoes: null,
      });
      if (!result.ok) throw new Error(result.error || "Erro ao atualizar atendimento");
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
      const result = await excluirAtendimentoAction(delItem.id);
      if (!result.ok) throw new Error(result.error || "Erro ao excluir atendimento");
      closeDelete();
      await loadAtendimentos();
    } catch (err) {
      setError(normalizeApiError(err));
      setDelBusy(false);
    }
  }

  function openExcluirPorPeriodo(a: Atendimento) {
    setPeriodoItem(a);
    // Pre-seleciona o profissional da linha; o usuario troca ou escolhe "todos".
    setPeriodoEscopo(a.profissionalId ? "profissional" : "todos");
    setPeriodoProfissionalId(a.profissionalId ? String(a.profissionalId) : "");
    setPeriodoMsg(null);
    setPeriodoBusy(false);
    setPeriodoOpen(true);
  }

  function closeExcluirPorPeriodo() {
    setPeriodoOpen(false);
    setPeriodoItem(null);
    setPeriodoMsg(null);
    setPeriodoBusy(false);
  }

  async function confirmExcluirPorPeriodo() {
    const a = periodoItem;
    if (!a) return;
    const somenteProfissional = periodoEscopo === "profissional";
    if (somenteProfissional && !periodoProfissionalId) {
      setPeriodoMsg("Selecione um profissional.");
      return;
    }

    setPeriodoMsg(null);
    setPeriodoBusy(true);
    setError(null);
    try {
      const result = await excluirDiaAtendimentosAction({
        pacienteId: a.pacienteId,
        profissionalId: somenteProfissional ? Number(periodoProfissionalId) : undefined,
        horaInicio: hhmmForInput(a.horaInicio) || String(a.horaInicio),
        horaFim: hhmmForInput(a.horaFim) || String(a.horaFim),
        turno: a.turno || "Matutino",
        periodoInicio: ymdForInput(a.periodoInicio || a.data),
        periodoFim: ymdForInput(a.periodoFim || a.data),
        diaSemana: dowFromYmdUtc(ymdForInput(a.data)),
      });
      if (!result.ok) throw new Error(result.error || "Erro ao excluir atendimentos do dia");
      closeExcluirPorPeriodo();
      await loadAtendimentos();
    } catch (err) {
      setPeriodoMsg(normalizeApiError(err));
      setPeriodoBusy(false);
    }
  }

  useEffect(() => {
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
            <span className="mb-1 block font-semibold text-[var(--marrom)]">Profissional</span>
            <select
              className="w-full rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
              value={profissionalId}
              onChange={(e) => setProfissionalId(e.target.value)}
            >
              <option value="">Todos</option>
              {profissionais.map((t) => (
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
                const hoje = ymdToday();
                setPacienteId("");
                setProfissionalId("");
                setDataIni(hoje);
                setDataFim(hoje);
                void loadAtendimentos({
                  pacienteId: "",
                  profissionalId: "",
                  dataIni: hoje,
                  dataFim: hoje,
                });
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
                <th className="px-3 py-2">Data / Período</th>
                <th className="px-3 py-2">Paciente</th>
                <th className="px-3 py-2">Profissional</th>
                <th className="px-3 py-2">Horário</th>
                <th className="px-3 py-2">Presença / Repasse</th>
                <th className="px-3 py-2">Motivo/Obs</th>
                <th className="px-3 py-2 text-center">Ações</th>
              </tr>
            </thead>
            <tbody>
              {items.map((a) => (
                <tr key={a.id} className="border-b border-gray-100 text-sm">
                  <td className="px-3 py-3 text-gray-700">
                    <div className="font-semibold">{String(a.data).slice(0, 10)}</div>
                    {a.periodoInicio || a.periodoFim ? (
                      <div className="text-xs text-gray-500">
                        Período: {String(a.periodoInicio || "-").slice(0, 10)} até{" "}
                        {String(a.periodoFim || "-").slice(0, 10)}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-3 py-3 font-semibold text-[var(--marrom)]">{a.pacienteNome}</td>
                  <td className="px-3 py-3 text-gray-700">{a.profissionalNome || "-"}</td>
                  <td className="px-3 py-3 text-gray-700">
                    {String(a.horaInicio).slice(0, 5)} - {String(a.horaFim).slice(0, 5)}
                    {a.isGrupo ? (
                      <div className="text-xs font-semibold text-indigo-700">Sessão em grupo</div>
                    ) : null}
                  </td>
                  <td className="px-3 py-3 text-gray-700">
                    <div>{a.presenca}</div>
                    <div className="text-xs text-gray-500">Repasse: {a.statusRepasse || "Pendente"}</div>
                  </td>
                  <td className="px-3 py-3 text-gray-700">
                    {(a.observacoes || a.resumoRepasse || a.motivo || "-").toString().slice(0, 120)}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center justify-center gap-1 whitespace-nowrap">
                      {props.canEditAtendimento ? (
                        <button
                          type="button"
                          onClick={() => openEdit(a)}
                          title="Editar atendimento"
                          aria-label="Editar atendimento"
                          className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-blue-200 text-[11px] font-bold text-blue-700 hover:bg-blue-50"
                        >
                          E
                        </button>
                      ) : null}
                      {props.canDeleteAtendimento ? (
                        <>
                          <button
                            type="button"
                            onClick={() => openDelete(a)}
                            title="Excluir atendimento"
                            aria-label="Excluir atendimento"
                            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-red-200 text-[11px] font-bold text-red-700 hover:bg-red-50"
                          >
                            X
                          </button>
                          <button
                            type="button"
                            onClick={() => openExcluirPorPeriodo(a)}
                            title="Excluir atendimentos por periodo"
                            aria-label="Excluir atendimentos por periodo"
                            className="inline-flex h-7 w-8 items-center justify-center rounded-full border border-amber-200 text-[11px] font-bold text-amber-700 hover:bg-amber-50"
                          >
                            EP
                          </button>
                        </>
                      ) : null}
                      {props.canEditRepasse ? (
                        <button
                          type="button"
                          onClick={() => openRepasseEvolucao(a)}
                          title="Registrar repasse via evolucao"
                          aria-label="Registrar repasse via evolucao"
                          className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-emerald-200 text-[11px] font-bold text-emerald-700 hover:bg-emerald-50"
                        >
                          R
                        </button>
                      ) : null}
                      {!props.canEditAtendimento &&
                      !props.canDeleteAtendimento &&
                      !props.canEditRepasse ? (
                        <span className="text-xs text-gray-400">-</span>
                      ) : null}
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
                <span className="font-semibold text-gray-700">Profissional</span>
                <select
                  className="rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
                  value={editProfissionalId}
                  onChange={(e) => setEditProfissionalId(e.target.value)}
                >
                  <option value="">Selecione</option>
                  {profissionais.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nome}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-2">
                <span className="font-semibold text-gray-700">Horário inicio</span>
                <input
                  type="time"
                  className="rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
                  value={editHoraInicio}
                  onChange={(e) => setEditHoraInicio(e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="font-semibold text-gray-700">Horário fim</span>
                <input
                  type="time"
                  className="rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
                  value={editHoraFim}
                  onChange={(e) => setEditHoraFim(e.target.value)}
                />
              </label>
              <div className="flex flex-col gap-2">
                <span className="font-semibold text-gray-700">Turno</span>
                <p className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-gray-600">
                  {editTurno}
                </p>
                <span className="text-xs text-gray-500">Definido pelo horário de início.</span>
              </div>
              <label className="inline-flex items-center gap-2 self-end pb-2 text-gray-700">
                <input
                  type="checkbox"
                  className="rounded text-[var(--laranja)]"
                  checked={editIsGrupo}
                  onChange={(e) => setEditIsGrupo(e.target.checked)}
                />
                <span>Sessão em grupo</span>
              </label>
              {editPeriodoInicio || editPeriodoFim ? (
                <div className="flex flex-col gap-2 md:col-span-2">
                  <span className="font-semibold text-gray-700">Período do agendamento em lote</span>
                  <p className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-gray-600">
                    {dataBr(editPeriodoInicio)} até {dataBr(editPeriodoFim)}
                  </p>
                  <span className="text-xs text-gray-500">
                    Somente leitura. As alterações acima valem apenas para este dia; os demais dias
                    do período não são afetados.
                  </span>
                </div>
              ) : null}
              <label className="flex flex-col gap-2">
                <span className="font-semibold text-gray-700">Presença</span>
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
                <span className="font-semibold text-gray-700">Motivo/Observação</span>
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

      {periodoOpen && periodoItem ? (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4"
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeExcluirPorPeriodo();
          }}
        >
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-[var(--marrom)]">
              Excluir atendimentos por período
            </h3>
            <p className="mt-2 text-sm text-gray-700">
              Atendimentos de{" "}
              <span className="font-semibold text-[var(--marrom)]">
                {periodoItem.pacienteNome}
              </span>{" "}
              toda {dayNamePtBr(dowFromYmdUtc(ymdForInput(periodoItem.data)))} às{" "}
              {String(periodoItem.horaInicio).slice(0, 5)}, entre{" "}
              {ymdForInput(periodoItem.periodoInicio || periodoItem.data)} e{" "}
              {ymdForInput(periodoItem.periodoFim || periodoItem.data)}.
            </p>

            <fieldset className="mt-4 text-sm">
              <legend className="mb-2 font-semibold text-gray-700">
                Excluir de qual profissional?
              </legend>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="escopo-exclusao-periodo"
                  checked={periodoEscopo === "todos"}
                  onChange={() => setPeriodoEscopo("todos")}
                  disabled={periodoBusy}
                />
                <span>Todos os profissionais</span>
              </label>
              <label className="mt-2 flex items-center gap-2">
                <input
                  type="radio"
                  name="escopo-exclusao-periodo"
                  checked={periodoEscopo === "profissional"}
                  onChange={() => setPeriodoEscopo("profissional")}
                  disabled={periodoBusy}
                />
                <span>Somente o profissional selecionado</span>
              </label>
              <select
                className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30 disabled:bg-gray-50 disabled:text-gray-400"
                aria-label="Profissional"
                value={periodoProfissionalId}
                onChange={(e) => setPeriodoProfissionalId(e.target.value)}
                disabled={periodoEscopo !== "profissional" || periodoBusy}
              >
                <option value="">Selecione um profissional</option>
                {profissionais.map((t) => (
                  <option key={t.id} value={String(t.id)}>
                    {t.nome}
                  </option>
                ))}
              </select>
            </fieldset>

            {periodoMsg ? <p className="mt-3 text-sm text-red-600">{periodoMsg}</p> : null}

            <div className="mt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeExcluirPorPeriodo}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                disabled={periodoBusy}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void confirmExcluirPorPeriodo()}
                className="rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-60"
                disabled={periodoBusy}
              >
                {periodoBusy ? "Excluindo..." : "Excluir"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}




