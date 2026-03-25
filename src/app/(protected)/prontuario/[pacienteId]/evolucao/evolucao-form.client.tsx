"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { listarAtendimentosAction } from "@/app/(protected)/consultas/consultas.actions";
import { normalizeAtendimentosList } from "@/app/(protected)/consultas/atendimento-compat";
import {
  atualizarEvolucaoAction,
  criarEvolucaoAction,
  excluirEvolucaoAction,
} from "@/app/(protected)/prontuario/prontuario.actions";

type AtendimentoOption = {
  id: number;
  data: string;
  horaInicio: string;
  horaFim: string;
  profissionalId?: number | null;
  profissionalNome?: string | null;
};

type ProfissionalOption = { id: number; nome: string };

type DesempenhoChoice = "" | "ajuda" | "nao_fez" | "independente";
type AjudaChoice =
  | ""
  | "modelo"
  | "verbal"
  | "verbal_gestual"
  | "gestual"
  | "fisica_parcial"
  | "fisica_total";

type MetaRow = {
  id: string;
  ensino: string;
  habilidade: string;
  opcao: string;
  desempenho: DesempenhoChoice;
  tipoAjuda: AjudaChoice;
  tentativas: string;
  acertos: string;
  reforcador: string;
};

type BehaviorTipo = "negativo" | "positivo";
type BehaviorResultado = "" | "negativo" | "positivo" | "parcial";
type BehaviorItem = { value: string; label: string; qty: number };

type Initial = {
  data?: string | null;
  atendimentoId?: number | null;
  profissionalId?: number | null;
  payload?: Record<string, unknown> | null;
};

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `id_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function toIntOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

function pickString(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function unwrapAction<T>(
  result: { ok: true; data: T } | { ok: false; error: string }
): T {
  if (!result.ok) throw new Error(result.error || "Falha na operacao");
  return result.data;
}

const TITULO_SESSAO_OPTIONS = [
  "Psicologia",
  "Psicopedagogia",
  "Fonoaudiologia",
  "Psicomotricidade",
  "Musicoterapia",
] as const;

const DESEMPENHO_OPTIONS: Array<{ value: DesempenhoChoice; label: string }> = [
  { value: "", label: "Selecione" },
  { value: "ajuda", label: "Ajuda" },
  { value: "nao_fez", label: "Nao fez" },
  { value: "independente", label: "Independente" },
];

const AJUDA_OPTIONS: Array<{ value: AjudaChoice; label: string }> = [
  { value: "", label: "Selecione" },
  { value: "modelo", label: "MOD - Modelo" },
  { value: "verbal", label: "SV - Suporte Verbal" },
  { value: "verbal_gestual", label: "SVG - Suporte Verbal Gestual" },
  { value: "gestual", label: "SG - Suporte Gestual" },
  { value: "fisica_parcial", label: "SFP - Suporte Fisico Parcial" },
  { value: "fisica_total", label: "SFT - Suporte Fisico Total" },
];

const BEHAVIOR_OPTIONS: Record<BehaviorTipo, Array<{ value: string; label: string }>> = {
  negativo: [
    { value: "autoagressao", label: "Autoagressao" },
    { value: "heteroagressao", label: "Hetero agressao" },
    { value: "estereotipia_vocal", label: "Estereotipia Vocal" },
    { value: "estereotipia_motora", label: "Estereotipia Motora" },
    { value: "ecolalia_imediata", label: "Ecolalia Imediata" },
    { value: "ecolalia_tardia", label: "Ecolalia Tardia" },
    { value: "fugas_esquivas", label: "Fugas/Esquivas" },
    { value: "agitacao_motora", label: "Agitacao Motora" },
    { value: "demanda_atencao", label: "Demanda de Atencao" },
    { value: "crise_ausencia", label: "Crise de ausencia" },
    { value: "isolamento", label: "Isolamento" },
    { value: "comportamento_desafiador", label: "Comportamento Desafiador" },
    { value: "baixo_interesse", label: "Baixo Interesse" },
    { value: "desregulacao_emocional", label: "Desregulacao emocional (crise)" },
  ],
  positivo: [
    { value: "calmo", label: "Calmo" },
    { value: "animado", label: "Animado (alegre, sorridente)" },
    { value: "alto_interesse", label: "Alto interesse" },
    { value: "foco_atencao", label: "Foco/Atencao" },
    { value: "compartilhamento", label: "Compartilhamento" },
    { value: "empatia", label: "Empatia" },
    { value: "autonomia", label: "Autonomia" },
  ],
};

function behaviorLabel(tipo: BehaviorTipo, value: string): string {
  const opt = BEHAVIOR_OPTIONS[tipo].find((o) => o.value === value);
  return opt?.label ?? value;
}

function normalizeAjudaChoice(value: unknown): AjudaChoice {
  if (typeof value !== "string") return "";
  const token = value.toLowerCase().trim().replace(/\s+/g, "_");
  if (!token) return "";
  if (token === "mod" || token === "modelo" || token === "model") return "modelo";
  if (token === "sv" || token === "verbal") return "verbal";
  if (token === "svg" || token === "verbal_gestual" || token === "verbal_e_gestual") return "verbal_gestual";
  if (token === "sg" || token === "gestual") return "gestual";
  if (token === "sfp" || token === "fisica_parcial" || token === "fisico_parcial") return "fisica_parcial";
  if (token === "sft" || token === "fisica_total" || token === "fisico_total") return "fisica_total";
  return "";
}

function normalizeMetaFromAny(item: unknown, stableId?: string): MetaRow {
  const obj = (item ?? {}) as Record<string, unknown>;
  const toChoice = <T extends string>(value: unknown, allowed: readonly T[]): T => {
    if (typeof value !== "string") return allowed[0];
    const slug = value.toLowerCase().replace(/\s+/g, "_");
    return (allowed as readonly string[]).includes(slug) ? (slug as T) : allowed[0];
  };
  const tent = obj.tentativas ?? obj.tentativa;
  return {
    id: stableId ?? uid(),
    ensino: pickString(obj.ensino),
    habilidade: pickString(obj.habilidade ?? obj.skill),
    opcao: pickString(obj.opcao ?? obj.meta),
    desempenho: toChoice(obj.desempenho ?? obj.performance, ["", "ajuda", "nao_fez", "independente"]),
    tipoAjuda: normalizeAjudaChoice(obj.tipoAjuda ?? obj.tipo_ajuda ?? obj.ajuda),
    tentativas: tent == null ? "" : String(tent),
    acertos: obj.acertos == null ? "" : String(obj.acertos),
    reforcador: pickString(obj.reforcador ?? obj.reforco),
  };
}

export function EvolucaoFormClient(props: {
  pacienteId: number;
  evolucaoId?: number | null;
  initial?: Initial | null;
  isProfissional?: boolean;
  initialProfissionais?: ProfissionalOption[];
}) {
  const router = useRouter();
  const isEdit = !!props.evolucaoId;
  const isProfissional = !!props.isProfissional;

  const initialPayload = useMemo(
    () => (props.initial?.payload ?? {}) as Record<string, unknown>,
    [props.initial]
  );
  const [data, setData] = useState<string>(props.initial?.data ?? todayIso());
  const [atendimentoId, setAtendimentoId] = useState<string>(
    props.initial?.atendimentoId ? String(props.initial.atendimentoId) : ""
  );
  const [profissionalId, setProfissionalId] = useState<string>(
    props.initial?.profissionalId ? String(props.initial.profissionalId) : ""
  );

  const [titulo, setTitulo] = useState<string>(pickString(initialPayload.titulo));
  const [conduta, setConduta] = useState<string>(pickString(initialPayload.conduta));
  const [descricao, setDescricao] = useState<string>(pickString(initialPayload.descricao));
  const [atendimentos, setAtendimentos] = useState<AtendimentoOption[]>([]);
  const [atendimentosLoaded, setAtendimentosLoaded] = useState(false);
  const [profissionais] = useState<ProfissionalOption[]>(() => props.initialProfissionais ?? []);
  const [tituloModo, setTituloModo] = useState<"lista" | "outro">(() => {
    const t = pickString(initialPayload.titulo).trim();
    if (!t) return "lista";
    return (TITULO_SESSAO_OPTIONS as readonly string[]).includes(t) ? "lista" : "outro";
  });

  const [metaRows, setMetaRows] = useState<MetaRow[]>(() => {
    const itens =
      (Array.isArray(initialPayload.itensDesempenho) ? initialPayload.itensDesempenho : null) ??
      (Array.isArray(initialPayload.itens) ? initialPayload.itens : null) ??
      null;
    if (itens?.length) return itens.map((i, idx) => normalizeMetaFromAny(i, `m_${idx}`));

    const metas = Array.isArray(initialPayload.metas) ? (initialPayload.metas as unknown[]) : [];
    if (metas.length) return metas.map((m, idx) => normalizeMetaFromAny({ opcao: pickString(m) }, `m_${idx}`));

    return [normalizeMetaFromAny({}, "m_0")];
  });

  const initialComportamentosRaw = (initialPayload.comportamentos ??
    initialPayload.comportamento ??
    null) as Record<string, unknown> | null;
  const [compResultado, setCompResultado] = useState<BehaviorResultado>(() => {
    const r = pickString(initialComportamentosRaw?.resultado).trim();
    if (r === "negativo" || r === "positivo" || r === "parcial") return r;
    return "";
  });
  const [compDescricao, setCompDescricao] = useState<string>(pickString(initialComportamentosRaw?.descricao));
  const [negItems, setNegItems] = useState<BehaviorItem[]>(() => {
    const lista = Array.isArray(initialComportamentosRaw?.negativos)
      ? (initialComportamentosRaw?.negativos as unknown[])
      : [];
    const qMap = (initialComportamentosRaw?.quantidades as Record<string, unknown> | null) ?? null;
    const qNeg = (qMap?.negativo as Record<string, unknown> | null) ?? {};
    return lista
      .map((v) => {
        const value = pickString(v).trim();
        if (!value) return null;
        const qty = Number(qNeg[value] ?? 1);
        return {
          value,
          label: behaviorLabel("negativo", value),
          qty: Number.isFinite(qty) && qty > 0 ? qty : 1,
        };
      })
      .filter(Boolean) as BehaviorItem[];
  });
  const [posItems, setPosItems] = useState<BehaviorItem[]>(() => {
    const lista = Array.isArray(initialComportamentosRaw?.positivos)
      ? (initialComportamentosRaw?.positivos as unknown[])
      : [];
    const qMap = (initialComportamentosRaw?.quantidades as Record<string, unknown> | null) ?? null;
    const qPos = (qMap?.positivo as Record<string, unknown> | null) ?? {};
    return lista
      .map((v) => {
        const value = pickString(v).trim();
        if (!value) return null;
        const qty = Number(qPos[value] ?? 1);
        return {
          value,
          label: behaviorLabel("positivo", value),
          qty: Number.isFinite(qty) && qty > 0 ? qty : 1,
        };
      })
      .filter(Boolean) as BehaviorItem[];
  });
  const [negSelect, setNegSelect] = useState<string>("");
  const [negCustom, setNegCustom] = useState<string>("");
  const [negQty, setNegQty] = useState<string>("1");
  const [posSelect, setPosSelect] = useState<string>("");
  const [posCustom, setPosCustom] = useState<string>("");
  const [posQty, setPosQty] = useState<string>("1");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const atendimentoAtual = useMemo(() => {
    if (!atendimentoId) return null;
    const idNum = Number(atendimentoId);
    return atendimentos.find((a) => Number(a.id) === idNum) ?? null;
  }, [atendimentoId, atendimentos]);

  const profissionalIdLocked = !isProfissional && !!atendimentoAtual?.profissionalId;

  const payload = useMemo(() => {
    const merged: Record<string, unknown> = { ...initialPayload };

    const itensDesempenho = metaRows
      .map((r) => {
        const ensino = r.ensino.trim();
        const habilidade = r.habilidade.trim();
        const opcao = r.opcao.trim();
        const reforcador = r.reforcador.trim();
        const tent = toIntOrNull(r.tentativas);
        const acertos = toIntOrNull(r.acertos);
        const desempenho = (r.desempenho || "").trim() || null;
        const tipoAjuda = (r.tipoAjuda || "").trim() || null;
        const temDados =
          ensino ||
          habilidade ||
          opcao ||
          reforcador ||
          desempenho ||
          tipoAjuda ||
          tent != null ||
          acertos != null;
        if (!temDados) return null;
        return {
          ensino: ensino || null,
          habilidade: habilidade || null,
          opcao: opcao || null,
          desempenho,
          tipoAjuda,
          tentativas: tent,
          acertos,
          reforcador: reforcador || null,
        };
      })
      .filter(Boolean) as Array<Record<string, unknown>>;

    const metas = itensDesempenho.length
      ? itensDesempenho
          .map((i) => pickString(i.opcao || i.habilidade).trim())
          .filter(Boolean)
      : [];

    const behaviorMapFromItems = (items: BehaviorItem[]) => {
      const vals: string[] = [];
      const qtyMap: Record<string, number> = {};
      items.forEach((it) => {
        const v = it.value.trim();
        if (!v) return;
        vals.push(v);
        const q = Number(it.qty);
        qtyMap[v] = Number.isFinite(q) && q > 0 ? q : 1;
      });
      return { vals, qtyMap };
    };
    const neg = behaviorMapFromItems(negItems);
    const pos = behaviorMapFromItems(posItems);
    const compDesc = compDescricao.trim();
    const compRes = compResultado || null;
    const temComp = !!compRes || neg.vals.length > 0 || pos.vals.length > 0 || !!compDesc;
    const comportamentos = temComp
      ? {
          resultado: compRes,
          negativos: neg.vals,
          positivos: pos.vals,
          quantidades: { negativo: neg.qtyMap, positivo: pos.qtyMap },
          descricao: compDesc,
        }
      : null;

    merged.titulo = titulo.trim();
    merged.conduta = conduta.trim();
    merged.descricao = descricao.trim();
    merged.metas = metas;
    merged.itensDesempenho = itensDesempenho;

    if (comportamentos) merged.comportamentos = comportamentos;
    else delete merged.comportamentos;
    delete merged.comportamento;

    return merged;
  }, [compDescricao, compResultado, conduta, descricao, initialPayload, metaRows, negItems, posItems, titulo]);

  useEffect(() => {
    let alive = true;
    async function loadAtendimentos() {
      if (alive) setAtendimentosLoaded(false);
      try {
        const qs = {
          pacienteId: String(props.pacienteId),
          dataIni: data,
          dataFim: data,
        };
        const rowsResult = unwrapAction(await listarAtendimentosAction(qs));
        const rows = normalizeAtendimentosList(rowsResult.items);
        if (!alive) return;
        const mapped = rows.map((rec) => ({
          id: rec.id,
          data: String(rec.data ?? "").slice(0, 10),
          horaInicio: String(rec.hora_inicio ?? "").slice(0, 5),
          horaFim: String(rec.hora_fim ?? "").slice(0, 5),
          profissionalId: rec.profissional_id,
          profissionalNome: rec.profissionalNome,
        } satisfies AtendimentoOption));
        setAtendimentos(mapped.filter((row) => row.id > 0));
      } catch {
        // ignore
      } finally {
        if (alive) setAtendimentosLoaded(true);
      }
    }
    loadAtendimentos();
    return () => {
      alive = false;
    };
  }, [data, props.pacienteId]);

  useEffect(() => {
    if (isEdit) return;
    if (!atendimentoId) return;
    if (!atendimentosLoaded) return;
    const has = atendimentos.some((a) => String(a.id) === String(atendimentoId));
    if (!has) setAtendimentoId("");
  }, [atendimentoId, atendimentos, atendimentosLoaded, isEdit]);

  useEffect(() => {
    if (isProfissional) return;
    const profissionalAtendimentoId = atendimentoAtual?.profissionalId;
    if (!profissionalAtendimentoId) return;
    setProfissionalId(String(profissionalAtendimentoId));
  }, [atendimentoAtual?.profissionalId, isProfissional]);

  async function submit() {
    setBusy(true);
    setMsg(null);
    try {
      if (!data?.trim()) throw new Error("Data obrigatoria.");
      const resolvedProfissionalId = isProfissional
        ? null
        : profissionalIdLocked
          ? Number(atendimentoAtual?.profissionalId ?? 0) || null
          : profissionalId
            ? Number(profissionalId)
            : null;
      if (!isProfissional && !resolvedProfissionalId) {
        throw new Error("Selecione um atendimento ou um profissional.");
      }

      const body = {
        data,
        atendimentoId: atendimentoId ? Number(atendimentoId) : null,
        profissionalId: resolvedProfissionalId,
        payload,
      };
      if (isEdit && props.evolucaoId) {
        unwrapAction(await atualizarEvolucaoAction(props.evolucaoId, body));
      } else {
        unwrapAction(await criarEvolucaoAction(props.pacienteId, body));
      }
      setMsg(isEdit ? "Evolução atualizada." : "Evolução registrada.");
      setTimeout(() => router.push(`/prontuario/${props.pacienteId}`), 650);
    } catch (e) {
      const err = e as { message?: string };
      setMsg(err.message || "Erro ao salvar evolucao");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!props.evolucaoId) return;
    if (!confirm("Deseja excluir esta evolucao?")) return;
    setBusy(true);
    setMsg(null);
    try {
      unwrapAction(await excluirEvolucaoAction(props.evolucaoId));
      setMsg("Evolução excluida.");
      setTimeout(() => router.push(`/prontuario/${props.pacienteId}`), 650);
    } catch (e) {
      const err = e as { message?: string };
      setMsg(err.message || "Erro ao excluir evolucao");
    } finally {
      setBusy(false);
    }
  }

  function addMetaRow() {
    setMetaRows((curr) => [...curr, normalizeMetaFromAny({})]);
  }

  function removeMetaRow(id: string) {
    setMetaRows((curr) => curr.filter((r) => r.id !== id));
  }

  function updateMetaRow(id: string, patch: Partial<MetaRow>) {
    setMetaRows((curr) => curr.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function addBehavior(tipo: BehaviorTipo) {
    const isNeg = tipo === "negativo";
    const select = (isNeg ? negSelect : posSelect).trim();
    const custom = (isNeg ? negCustom : posCustom).trim();
    const qtyRaw = isNeg ? negQty : posQty;

    let value = select;
    let label = select ? behaviorLabel(tipo, select) : "";
    if (select === "__outro__") {
      if (!custom) return;
      value = custom;
      label = custom;
    }
    if (!value) return;

    const qtyParsed = Number(qtyRaw);
    const qty = Number.isFinite(qtyParsed) && qtyParsed > 0 ? Math.trunc(qtyParsed) : 1;

    const setter = isNeg ? setNegItems : setPosItems;
    setter((curr) => {
      const existing = curr.find((i) => i.value === value);
      if (existing) {
        return curr.map((i) => (i.value === value ? { ...i, qty } : i));
      }
      return [...curr, { value, label, qty }];
    });

    if (isNeg) {
      setNegSelect("");
      setNegCustom("");
      setNegQty("1");
    } else {
      setPosSelect("");
      setPosCustom("");
      setPosQty("1");
    }
  }

  function removeBehavior(tipo: BehaviorTipo, value: string) {
    const setter = tipo === "negativo" ? setNegItems : setPosItems;
    setter((curr) => curr.filter((i) => i.value !== value));
  }

  function updateBehaviorQty(tipo: BehaviorTipo, value: string, qty: number) {
    const setter = tipo === "negativo" ? setNegItems : setPosItems;
    setter((curr) => curr.map((i) => (i.value === value ? { ...i, qty } : i)));
  }

  const showTituloCustom = tituloModo === "outro";
  const tituloIsKnown = (TITULO_SESSAO_OPTIONS as readonly string[]).includes(titulo.trim());

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-bold text-[var(--marrom)]">
        {isEdit ? "Editar evolucao" : "Nova evolucao"}
      </h1>

      <form
        className="mt-5 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-semibold text-[var(--marrom)]">Data</label>
            <input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2"
            />
          </div>
          <div className="flex flex-col gap-1 md:col-span-2">
            <label className="text-sm font-semibold text-[var(--marrom)]">Atendimento</label>
            <select
              value={atendimentoId}
              onChange={(e) => setAtendimentoId(e.target.value)}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2"
            >
              <option value="">Sem vinculo</option>
              {atendimentoId && !atendimentoAtual ? (
                <option value={atendimentoId}>Atendimento #{atendimentoId}</option>
              ) : null}
              {atendimentos.map((a) => (
                <option key={a.id} value={String(a.id)}>
                  {String(a.data).slice(0, 10)} - {a.profissionalNome || "Profissional"}{" "}
                  {a.horaInicio || a.horaFim
                    ? `(${String(a.horaInicio || "").slice(0, 5)}${
                        a.horaFim ? ` - ${String(a.horaFim || "").slice(0, 5)}` : ""
                      })`
                    : ""}{" "}
                  (#{a.id})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-semibold text-[var(--marrom)]">Título da sessao</label>
            <div className="flex flex-col gap-2">
              <select
                value={showTituloCustom ? "__outro__" : tituloIsKnown ? titulo.trim() : ""}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "__outro__") {
                    setTituloModo("outro");
                    if (tituloIsKnown) setTitulo("");
                    return;
                  }
                  setTituloModo("lista");
                  setTitulo(v);
                }}
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
              >
                <option value="">Selecione</option>
                {TITULO_SESSAO_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
                <option value="__outro__">Outro (especifique)</option>
              </select>
              {showTituloCustom ? (
                <input
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                  placeholder="Digite o titulo da sessao"
                />
              ) : null}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-semibold text-[var(--marrom)]">Conduta / Plano imediato</label>
            <input
              value={conduta}
              onChange={(e) => setConduta(e.target.value)}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
              placeholder="Encaminhamentos ou combinados para proxima sessao."
            />
          </div>
        </div>

        {!isProfissional ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {profissionalIdLocked ? (
              <div className="flex flex-col gap-1">
                <label className="text-sm font-semibold text-[var(--marrom)]">Profissional</label>
                <p className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                  {atendimentoAtual?.profissionalNome ||
                    (atendimentoAtual?.profissionalId
                      ? `#${atendimentoAtual.profissionalId}`
                      : "Vinculado ao atendimento")}
                </p>
                <p className="text-xs text-gray-500">Vinculado ao atendimento selecionado.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                <label className="text-sm font-semibold text-[var(--marrom)]">Profissional (quando sem atendimento)</label>
                <select
                  value={profissionalId}
                  onChange={(e) => setProfissionalId(e.target.value)}
                  disabled={busy}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm disabled:opacity-60"
                >
                  <option value="">Selecione</option>
                  {profissionais.map((t) => (
                    <option key={t.id} value={String(t.id)}>
                      {t.nome} (#{t.id})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        ) : null}

        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-[var(--marrom)]">Descrição clinica</label>
          <textarea
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            rows={4}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
            placeholder="Evolução da sessao, respostas a intervencoes, pontos de alerta."
          />
        </div>

        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-[var(--marrom)]">Metas / desempenho da sessao</p>
              <p className="text-xs text-gray-500">
                Registre habilidade, alvo apresentado, desempenho (Ajuda / Nao fez / Independente), tipo de ajuda e
                reforcador.
              </p>
              <p className="text-xs text-gray-500">
                <span className="font-semibold text-[var(--marrom)]">Ajuda:</span> MOD - Modelo, SV - Suporte Verbal,
                SVG - Suporte Verbal Gestual, SG - Suporte Gestual, SFP - Suporte Fisico Parcial, SFT - Suporte Fisico Total.{" "}
                <span className="font-semibold text-[var(--marrom)]">Tentativas:</span> numero de apresentacoes.
              </p>
            </div>
            <button
              type="button"
              onClick={addMetaRow}
              disabled={busy}
              className="h-9 rounded-md border border-[var(--laranja)] px-3 py-1 text-sm font-semibold text-[var(--laranja)] hover:bg-amber-50 disabled:opacity-60"
            >
              + Adicionar linha
            </button>
          </div>

          <div className="mt-3 space-y-2">
            {metaRows.map((row) => (
              <div
                key={row.id}
                className="grid grid-cols-1 items-start gap-3 rounded-xl border border-amber-100 bg-white p-3 shadow-sm md:grid-cols-12 md:items-center md:gap-2"
              >
                <div className="flex flex-col gap-1 md:col-span-3">
                  <p className="text-xs font-semibold text-gray-600">Ensino</p>
                  <input
                    value={row.ensino}
                    onChange={(e) => updateMetaRow(row.id, { ensino: e.target.value })}
                    className="rounded-lg border px-3 py-2 text-sm"
                    placeholder="Ex: Imitacao, Ecoico..."
                  />
                </div>
                <div className="flex flex-col gap-1 md:col-span-3">
                  <p className="text-xs font-semibold text-gray-600">Habilidade</p>
                  <input
                    value={row.habilidade}
                    onChange={(e) => updateMetaRow(row.id, { habilidade: e.target.value })}
                    className="rounded-lg border px-3 py-2 text-sm"
                    placeholder="Ex: Nomeacao, Pareamento..."
                  />
                </div>
                <div className="flex flex-col gap-1 md:col-span-3">
                  <p className="text-xs font-semibold text-gray-600">Alvo</p>
                  <input
                    value={row.opcao}
                    onChange={(e) => updateMetaRow(row.id, { opcao: e.target.value })}
                    className="rounded-lg border px-3 py-2 text-sm"
                    placeholder="Ex: Gato, Cachorro..."
                  />
                </div>
                <div className="flex flex-col gap-1 md:col-span-2">
                  <p className="text-xs font-semibold text-gray-600">Desempenho</p>
                  <select
                    value={row.desempenho}
                    onChange={(e) => updateMetaRow(row.id, { desempenho: e.target.value as DesempenhoChoice })}
                    className="rounded-lg border bg-white px-3 py-2 text-sm"
                  >
                    {DESEMPENHO_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1 md:col-span-3 md:col-start-1">
                  <p className="text-xs font-semibold text-gray-600">Tipo de ajuda</p>
                  <select
                    value={row.tipoAjuda}
                    onChange={(e) => updateMetaRow(row.id, { tipoAjuda: e.target.value as AjudaChoice })}
                    className="rounded-lg border bg-white px-3 py-2 text-sm"
                  >
                    {AJUDA_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1 md:col-span-2">
                  <p className="text-xs font-semibold text-gray-600">Tentativas</p>
                  <input
                    type="number"
                    min={0}
                    value={row.tentativas}
                    onChange={(e) => updateMetaRow(row.id, { tentativas: e.target.value })}
                    className="w-full rounded-lg border px-3 py-2 text-center text-sm md:w-16"
                    placeholder="0"
                  />
                </div>
                <div className="flex flex-col gap-1 md:col-span-2">
                  <p className="text-xs font-semibold text-gray-600">Acertos</p>
                  <input
                    type="number"
                    min={0}
                    value={row.acertos}
                    onChange={(e) => updateMetaRow(row.id, { acertos: e.target.value })}
                    className="w-full rounded-lg border px-3 py-2 text-center text-sm md:w-16"
                    placeholder="0"
                  />
                </div>
                <div className="flex flex-col gap-1 md:col-span-3">
                  <p className="text-xs font-semibold text-gray-600">Reforcador</p>
                  <input
                    value={row.reforcador}
                    onChange={(e) => updateMetaRow(row.id, { reforcador: e.target.value })}
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                    placeholder="Ex: bola"
                  />
                </div>
                <div className="flex flex-col items-start gap-1 md:col-span-1 md:items-center">
                  <p className="text-xs font-semibold text-gray-600">Acao</p>
                  <button
                    type="button"
                    onClick={() => removeMetaRow(row.id)}
                    disabled={busy || metaRows.length <= 1}
                    className="w-full rounded-md border border-red-100 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
                  >
                    Remover
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-5 md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-[var(--marrom)]">Comportamentos observados na sessao</p>
              <p className="text-xs text-gray-600">
                Selecione o resultado geral e registre os comportamentos apresentados com suas quantidades.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { value: "negativo", label: "Negativo" },
                { value: "positivo", label: "Positivo" },
                { value: "parcial", label: "Parcial (+/-)" },
              ].map((opt) => (
                <label
                  key={opt.value}
                  className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-white px-3 py-1.5 text-sm font-semibold text-[var(--marrom)] shadow-sm"
                >
                  <input
                    type="radio"
                    name="comp-resultado"
                    value={opt.value}
                    checked={compResultado === opt.value}
                    onChange={() => setCompResultado(opt.value as BehaviorResultado)}
                    className="accent-[var(--laranja)]"
                  />
                  {opt.label}
                </label>
              ))}
              <button
                type="button"
                onClick={() => setCompResultado("")}
                className="rounded-full border border-transparent bg-transparent px-2 py-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900"
              >
                Limpar
              </button>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-3">
              <p className="text-sm font-semibold text-[var(--marrom)]">Comportamentos Negativos</p>
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap gap-2">
                  <select
                    value={negSelect}
                    onChange={(e) => {
                      setNegSelect(e.target.value);
                      if (e.target.value !== "__outro__") setNegCustom("");
                    }}
                    className="min-w-[180px] flex-1 rounded-lg border bg-white px-3 py-2 text-sm"
                  >
                    <option value="">Selecione um comportamento</option>
                    <option value="__outro__">Outro (especifique)</option>
                    {BEHAVIOR_OPTIONS.negativo.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  {negSelect === "__outro__" ? (
                    <input
                      value={negCustom}
                      onChange={(e) => setNegCustom(e.target.value)}
                      className="min-w-[180px] flex-1 rounded-lg border bg-white px-3 py-2 text-sm"
                      placeholder="Descreva outro comportamento negativo"
                    />
                  ) : null}
                  <input
                    type="number"
                    min={1}
                    max={50}
                    step={1}
                    value={negQty}
                    onChange={(e) => setNegQty(e.target.value)}
                    className="w-20 rounded-lg border px-3 py-2 text-sm"
                    placeholder="Qtd"
                  />
                  <button
                    type="button"
                    onClick={() => addBehavior("negativo")}
                    className="rounded-md bg-[var(--laranja)] px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#e6961f]"
                  >
                    Adicionar
                  </button>
                </div>
                <div className="space-y-2">
                  {negItems.map((it) => (
                    <div
                      key={it.value}
                      className="flex items-center justify-between gap-3 rounded-lg border border-amber-100 bg-white px-3 py-2 shadow-sm"
                    >
                      <span className="text-sm font-medium text-[var(--marrom)]">{it.label}</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          max={50}
                          step={1}
                          value={String(it.qty)}
                          onChange={(e) => {
                            const n = Number(e.target.value);
                            updateBehaviorQty(
                              "negativo",
                              it.value,
                              Number.isFinite(n) && n > 0 ? Math.trunc(n) : 1
                            );
                          }}
                          className="w-20 rounded-lg border px-2 py-1 text-center text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => removeBehavior("negativo", it.value)}
                          className="rounded-md border border-red-100 px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                        >
                          Remover
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-3 md:border-l md:border-dashed md:border-amber-200 md:pl-6">
              <p className="text-sm font-semibold text-[var(--marrom)]">Comportamentos Positivos</p>
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap gap-2">
                  <select
                    value={posSelect}
                    onChange={(e) => {
                      setPosSelect(e.target.value);
                      if (e.target.value !== "__outro__") setPosCustom("");
                    }}
                    className="min-w-[180px] flex-1 rounded-lg border bg-white px-3 py-2 text-sm"
                  >
                    <option value="">Selecione um comportamento</option>
                    <option value="__outro__">Outro (especifique)</option>
                    {BEHAVIOR_OPTIONS.positivo.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  {posSelect === "__outro__" ? (
                    <input
                      value={posCustom}
                      onChange={(e) => setPosCustom(e.target.value)}
                      className="min-w-[180px] flex-1 rounded-lg border bg-white px-3 py-2 text-sm"
                      placeholder="Descreva outro comportamento positivo"
                    />
                  ) : null}
                  <input
                    type="number"
                    min={1}
                    max={50}
                    step={1}
                    value={posQty}
                    onChange={(e) => setPosQty(e.target.value)}
                    className="w-20 rounded-lg border px-3 py-2 text-sm"
                    placeholder="Qtd"
                  />
                  <button
                    type="button"
                    onClick={() => addBehavior("positivo")}
                    className="rounded-md bg-[var(--laranja)] px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#e6961f]"
                  >
                    Adicionar
                  </button>
                </div>
                <div className="space-y-2">
                  {posItems.map((it) => (
                    <div
                      key={it.value}
                      className="flex items-center justify-between gap-3 rounded-lg border border-amber-100 bg-white px-3 py-2 shadow-sm"
                    >
                      <span className="text-sm font-medium text-[var(--marrom)]">{it.label}</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          max={50}
                          step={1}
                          value={String(it.qty)}
                          onChange={(e) => {
                            const n = Number(e.target.value);
                            updateBehaviorQty(
                              "positivo",
                              it.value,
                              Number.isFinite(n) && n > 0 ? Math.trunc(n) : 1
                            );
                          }}
                          className="w-20 rounded-lg border px-2 py-1 text-center text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => removeBehavior("positivo", it.value)}
                          className="rounded-md border border-red-100 px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                        >
                          Remover
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-2">
            <p className="text-sm font-semibold text-[var(--marrom)]">Descrição do comportamento</p>
            <textarea
              value={compDescricao}
              onChange={(e) => setCompDescricao(e.target.value)}
              rows={3}
              className="min-h-[96px] rounded-lg border bg-white px-3 py-2 text-sm"
              placeholder="Contexto, frequencia, intensidade, antecedentes ou consequencias observadas."
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          {isEdit ? (
            <button
              type="button"
              onClick={remove}
              disabled={busy}
              className="text-sm font-semibold text-red-600 disabled:opacity-60"
          >
            Excluir evolucao
          </button>
          ) : (
            <span />
          )}
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-[var(--laranja)] px-4 py-2 font-semibold text-white hover:bg-[#e6961f] disabled:opacity-60"
          >
            {isEdit ? "Atualizar evolucao" : "Salvar evolucao"}
          </button>
        </div>

        {msg ? (
          <p className={`text-sm ${/erro|falha/i.test(msg) ? "text-red-600" : "text-green-700"}`}>{msg}</p>
        ) : null}
      </form>
    </section>
  );
}



