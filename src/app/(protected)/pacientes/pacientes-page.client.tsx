"use client";

import { useState } from "react";
import Link from "next/link";
import { listarPacientesAction } from "@/app/(protected)/pacientes/paciente.actions";
import { criarAtendimentosRecorrentesAction } from "@/app/(protected)/consultas/consultas.actions";

type Paciente = {
  id: number;
  nome: string;
  cpf: string;
  convenio: string;
  email: string | null;
  telefone: string | null;
  terapias: string[];
};

type Profissional = { id: number; nome: string };

function formatCpf(cpf: string): string {
  const digits = (cpf || "").replace(/\D/g, "").slice(0, 11);
  if (digits.length !== 11) return digits;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function normalizeApiError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Erro ao carregar pacientes";
}

function ymdToday(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function unwrapAction<T>(
  result: { ok: true; data: T } | { ok: false; error: string }
): T {
  if (!result.ok) throw new Error(result.error || "Erro ao salvar atendimento");
  return result.data;
}

export function PacientesPageClient(props: {
  initialItems: Paciente[];
  initialProfissionais: Profissional[];
}) {
  const [items, setItems] = useState<Paciente[]>(() => props.initialItems);
  const [profissionais] = useState<Profissional[]>(() => props.initialProfissionais);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");

  const [consultaOpen, setConsultaOpen] = useState(false);
  const [consultaPaciente, setConsultaPaciente] = useState<Paciente | null>(null);
  const [consultaProfissionalId, setConsultaProfissionalId] = useState<string>("");
  const [consultaHoraInicio, setConsultaHoraInicio] = useState<string>("08:00");
  const [consultaHoraFim, setConsultaHoraFim] = useState<string>("09:00");
  const [consultaIsGrupo, setConsultaIsGrupo] = useState(false);
  const [consultaTurno, setConsultaTurno] = useState<string>("Matutino");
  const [consultaPeriodoInicio, setConsultaPeriodoInicio] = useState<string>(ymdToday());
  const [consultaPeriodoFim, setConsultaPeriodoFim] = useState<string>(ymdToday());
  const [consultaPresenca, setConsultaPresenca] = useState<string>("Nao informado");
  const [consultaMotivo, setConsultaMotivo] = useState<string>("");
  const [consultaDias, setConsultaDias] = useState<Set<number>>(() => new Set());
  const [consultaBusy, setConsultaBusy] = useState(false);
  const [consultaMsg, setConsultaMsg] = useState<string | null>(null);

  async function loadPacientes(filters: { nome: string; cpf: string }) {
    setLoading(true);
    setError(null);
    try {
      const result = await listarPacientesAction({
        nome: filters.nome.trim() || undefined,
        cpf: filters.cpf.trim() || undefined,
      });
      if (!result.ok) {
        throw new Error(result.error || "Erro ao carregar pacientes");
      }
      setItems(Array.isArray(result.data.items) ? result.data.items : []);
    } catch (err) {
      setError(normalizeApiError(err));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  function abrirConsulta(paciente: Paciente) {
    setConsultaPaciente(paciente);
    setConsultaOpen(true);
    setConsultaMsg(null);
    setConsultaMotivo("");
    setConsultaPresenca("Nao informado");
    setConsultaIsGrupo(false);
    setConsultaTurno("Matutino");
    setConsultaHoraInicio("08:00");
    setConsultaHoraFim("09:00");
    const today = ymdToday();
    setConsultaPeriodoInicio(today);
    setConsultaPeriodoFim(today);
    setConsultaDias(new Set());
  }

  function fecharConsulta() {
    setConsultaOpen(false);
    setConsultaPaciente(null);
    setConsultaBusy(false);
  }

  function toggleDia(dow: number) {
    setConsultaDias((cur) => {
      const next = new Set(cur);
      if (next.has(dow)) next.delete(dow);
      else next.add(dow);
      return next;
    });
  }

  async function salvarConsultaPorPeriodo() {
    const paciente = consultaPaciente;
    if (!paciente) return;

    setConsultaMsg(null);

    if (!consultaProfissionalId) {
      setConsultaMsg("Selecione um profissional.");
      return;
    }
    if (!consultaHoraInicio || !consultaHoraFim) {
      setConsultaMsg("Preencha horarios do atendimento.");
      return;
    }
    if (!consultaPeriodoInicio || !consultaPeriodoFim) {
      setConsultaMsg("Informe inicio e fim do periodo.");
      return;
    }
    if (!consultaDias.size) {
      setConsultaMsg("Selecione pelo menos um dia da semana.");
      return;
    }

    const motivo = consultaMotivo.trim();
    if (consultaPresenca === "Ausente" && !motivo) {
      setConsultaMsg("Informe o motivo da ausencia.");
      return;
    }

    setConsultaBusy(true);
    try {
      const payload = {
        pacienteId: paciente.id,
        profissionalId: Number(consultaProfissionalId),
        horaInicio: consultaHoraInicio,
        horaFim: consultaHoraFim,
        isGrupo: consultaIsGrupo,
        turno: consultaTurno || "Matutino",
        periodoInicio: consultaPeriodoInicio,
        periodoFim: consultaPeriodoFim,
        presenca: consultaPresenca || "Nao informado",
        motivo: motivo || null,
        observacoes: null,
        diasSemana: Array.from(consultaDias.values()).sort((a, b) => a - b),
      };

      unwrapAction(await criarAtendimentosRecorrentesAction(payload));
      fecharConsulta();
    } catch (err) {
      setConsultaMsg(normalizeApiError(err));
    } finally {
      setConsultaBusy(false);
    }
  }

  return (
    <main className="rounded-2xl bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--marrom)]">Pacientes</h1>
          <p className="text-sm text-gray-600">Consultar, cadastrar e gerenciar pacientes.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/pacientes/novo"
            className="rounded-lg bg-[var(--laranja)] px-4 py-2 text-sm font-semibold text-white hover:bg-[#e6961f]"
          >
            Novo paciente
          </Link>
          <button
            type="button"
            onClick={() => void loadPacientes({ nome, cpf })}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Recarregar
          </button>
        </div>
      </div>

      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <label className="text-sm">
          <span className="mb-1 block font-semibold text-[var(--marrom)]">Nome</span>
          <input
            className="w-full rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
            value={nome}
            onChange={(event) => setNome(event.target.value)}
            placeholder="Buscar por nome"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-semibold text-[var(--marrom)]">CPF</span>
          <input
            className="w-full rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
            value={cpf}
            onChange={(event) => setCpf(event.target.value)}
            placeholder="Buscar por CPF"
          />
        </label>
        <div className="flex items-end gap-2">
          <button
            type="button"
            onClick={() => void loadPacientes({ nome, cpf })}
            className="w-full rounded-lg bg-[var(--laranja)] px-3 py-2 font-semibold text-white hover:bg-[#e6961f]"
          >
            Filtrar
          </button>
          <button
            type="button"
            onClick={() => {
              setNome("");
              setCpf("");
              void loadPacientes({ nome: "", cpf: "" });
            }}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 font-semibold text-gray-700 hover:bg-gray-50"
          >
            Limpar
          </button>
        </div>
      </div>

      {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}
      {loading ? <p className="text-sm text-gray-500">Carregando...</p> : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse">
          <thead>
            <tr className="border-b text-left text-xs uppercase tracking-wide text-gray-500">
              <th className="px-3 py-2">Nome</th>
              <th className="px-3 py-2">CPF</th>
              <th className="px-3 py-2">Convênio</th>
              <th className="px-3 py-2">Contato</th>
              <th className="px-3 py-2">Terapias</th>
              <th className="px-3 py-2">Ações</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-gray-100 text-sm">
                <td className="px-3 py-3 font-semibold text-[var(--marrom)]">{item.nome}</td>
                <td className="px-3 py-3 text-gray-700">{formatCpf(item.cpf)}</td>
                <td className="px-3 py-3 text-gray-700">{item.convenio || "Particular"}</td>
                <td className="px-3 py-3 text-gray-700">{item.email || item.telefone || "-"}</td>
                <td className="px-3 py-3 text-gray-700">
                  {item.terapias?.length ? item.terapias.join(", ") : "-"}
                </td>
                <td className="px-3 py-3 text-gray-700">
                  <div className="flex flex-wrap gap-3">
                    <Link className="text-sm font-semibold text-[var(--laranja)]" href={`/pacientes/${item.id}`}>
                      Ver
                    </Link>
                    <Link className="text-sm font-semibold text-[var(--laranja)]" href={`/prontuario/${item.id}`}>
                      Prontuário
                    </Link>
                    <button
                      type="button"
                      onClick={() => abrirConsulta(item)}
                      className="text-sm font-semibold text-[var(--laranja)] hover:underline"
                    >
                      Agendar por periodo
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!loading && !items.length ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-sm text-gray-500">
                  Nenhum paciente encontrado.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {consultaOpen && consultaPaciente ? (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4"
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) fecharConsulta();
          }}
        >
          <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">Novo atendimento (por periodo)</p>
                <h3 className="text-lg font-bold text-[var(--marrom)]">
                  {consultaPaciente.nome} <span className="text-gray-500">#{consultaPaciente.id}</span>
                </h3>
              </div>
              <button
                type="button"
                className="text-2xl leading-none text-gray-500 hover:text-[var(--laranja)]"
                aria-label="Fechar"
                onClick={fecharConsulta}
              >
                &times;
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
              <label className="flex flex-col gap-2">
                <span className="font-semibold text-gray-700">Profissional</span>
                <select
                  className="rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
                  value={consultaProfissionalId}
                  onChange={(e) => setConsultaProfissionalId(e.target.value)}
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
                <span className="font-semibold text-gray-700">Turno</span>
                <select
                  className="rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
                  value={consultaTurno}
                  onChange={(e) => setConsultaTurno(e.target.value)}
                >
                  <option value="Matutino">Matutino</option>
                  <option value="Vespertino">Vespertino</option>
                </select>
              </label>
              <label className="inline-flex items-center gap-2 self-end pb-2 text-gray-700">
                <input
                  type="checkbox"
                  className="rounded text-[var(--laranja)]"
                  checked={consultaIsGrupo}
                  onChange={(e) => setConsultaIsGrupo(e.target.checked)}
                />
                <span>Sessão em grupo</span>
              </label>

              <label className="flex flex-col gap-2">
                <span className="font-semibold text-gray-700">Horário inicio</span>
                <input
                  type="time"
                  className="rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
                  value={consultaHoraInicio}
                  onChange={(e) => setConsultaHoraInicio(e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="font-semibold text-gray-700">Horário fim</span>
                <input
                  type="time"
                  className="rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
                  value={consultaHoraFim}
                  onChange={(e) => setConsultaHoraFim(e.target.value)}
                />
              </label>

              <label className="flex flex-col gap-2">
                <span className="font-semibold text-gray-700">Período - inicio</span>
                <input
                  type="date"
                  className="rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
                  value={consultaPeriodoInicio}
                  onChange={(e) => setConsultaPeriodoInicio(e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="font-semibold text-gray-700">Período - fim</span>
                <input
                  type="date"
                  className="rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
                  value={consultaPeriodoFim}
                  onChange={(e) => setConsultaPeriodoFim(e.target.value)}
                />
              </label>

              <div className="md:col-span-2">
                <p className="font-semibold text-gray-700">Dias da semana</p>
                <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
                  {[
                    { v: 1, label: "Segunda" },
                    { v: 2, label: "Terca" },
                    { v: 3, label: "Quarta" },
                    { v: 4, label: "Quinta" },
                    { v: 5, label: "Sexta" },
                    { v: 6, label: "Sabado" },
                    { v: 0, label: "Domingo" },
                  ].map((d) => (
                    <label key={d.v} className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="rounded text-[var(--laranja)]"
                        checked={consultaDias.has(d.v)}
                        onChange={() => toggleDia(d.v)}
                      />
                      <span>{d.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <label className="flex flex-col gap-2">
                <span className="font-semibold text-gray-700">Presença</span>
                <select
                  className="rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-[var(--laranja)] focus:ring-2 focus:ring-[var(--laranja)]/30"
                  value={consultaPresenca}
                  onChange={(e) => setConsultaPresenca(e.target.value)}
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
                  value={consultaMotivo}
                  onChange={(e) => setConsultaMotivo(e.target.value)}
                  placeholder="Motivo da ausencia ou observacoes"
                />
              </label>
            </div>

            {consultaMsg ? <p className="mt-3 text-sm text-gray-700">{consultaMsg}</p> : null}

            <div className="mt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={fecharConsulta}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                disabled={consultaBusy}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void salvarConsultaPorPeriodo()}
                className="rounded-lg bg-[var(--laranja)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#e6961f] disabled:opacity-60"
                disabled={consultaBusy}
              >
                {consultaBusy ? "Salvando..." : "Salvar atendimento"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}


