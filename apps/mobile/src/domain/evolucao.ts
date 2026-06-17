// Constantes e construcao de payload da evolucao, espelhando o formulario web
// (apps/web/.../evolucao/evolucao-form.client.tsx) para paridade total. O backend valida
// com criarEvolucaoSchema (@autismcad/validators); este payload alimenta o campo JSONB.

export const TITULO_SESSAO_OPTIONS = [
  "Psicologia",
  "Psicopedagogia",
  "Fonoaudiologia",
  "Psicomotricidade",
  "Musicoterapia",
] as const;

export const DESEMPENHO_OPTIONS = [
  { value: "ajuda", label: "Ajuda" },
  { value: "nao_fez", label: "Nao fez" },
  { value: "independente", label: "Independente" },
] as const;

export const AJUDA_OPTIONS = [
  { value: "modelo", label: "MOD - Modelo" },
  { value: "instrucao", label: "INS - Instrucao" },
  { value: "verbal", label: "SV - Suporte Verbal" },
  { value: "verbal_gestual", label: "SVG - Suporte Verbal Gestual" },
  { value: "gestual", label: "SG - Suporte Gestual" },
  { value: "fisica_parcial", label: "SFP - Suporte Fisico Parcial" },
  { value: "fisica_total", label: "SFT - Suporte Fisico Total" },
] as const;

export const RESULTADO_OPTIONS = [
  { value: "negativo", label: "Negativo" },
  { value: "positivo", label: "Positivo" },
  { value: "parcial", label: "Parcial (+/-)" },
] as const;

export const BEHAVIOR_OPTIONS = {
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
} as const;

export type MetaRow = {
  ensino: string;
  habilidade: string;
  opcao: string;
  desempenho: string;
  tipoAjuda: string;
  tentativas: string;
  acertos: string;
  reforcador: string;
};

export type BehaviorItem = { value: string; label: string; qty: number };

export function emptyMetaRow(): MetaRow {
  return {
    ensino: "",
    habilidade: "",
    opcao: "",
    desempenho: "",
    tipoAjuda: "",
    tentativas: "",
    acertos: "",
    reforcador: "",
  };
}

function toIntOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  // Achado 96: contagens nao podem ser negativas; valor invalido vira null.
  if (!Number.isFinite(n)) return null;
  const truncated = Math.trunc(n);
  return truncated < 0 ? null : truncated;
}

export type EvolucaoFormState = {
  titulo: string;
  conduta: string;
  descricao: string;
  metaRows: MetaRow[];
  compResultado: string;
  negItems: BehaviorItem[];
  posItems: BehaviorItem[];
  compDescricao: string;
};

// Constroi o objeto payload identico ao do form web (mesmas chaves e regras de "tem dados").
export function buildEvolucaoPayload(state: EvolucaoFormState): Record<string, unknown> {
  const itensDesempenho = state.metaRows
    .map((r) => {
      const ensino = r.ensino.trim();
      const habilidade = r.habilidade.trim();
      const opcao = r.opcao.trim();
      const reforcador = r.reforcador.trim();
      const tent = toIntOrNull(r.tentativas);
      const acertos = toIntOrNull(r.acertos);
      const desempenho = r.desempenho.trim() || null;
      const tipoAjuda = r.tipoAjuda.trim() || null;
      const temDados =
        ensino || habilidade || opcao || reforcador || desempenho || tipoAjuda || tent != null || acertos != null;
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
    .filter(Boolean) as Record<string, unknown>[];

  const metas = itensDesempenho
    .map((i) => String(i.opcao || i.habilidade || "").trim())
    .filter(Boolean);

  const mapBehaviors = (items: BehaviorItem[]) => {
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
  const neg = mapBehaviors(state.negItems);
  const pos = mapBehaviors(state.posItems);
  const compDesc = state.compDescricao.trim();
  const compRes = state.compResultado || null;
  const temComp = !!compRes || neg.vals.length > 0 || pos.vals.length > 0 || !!compDesc;

  const payload: Record<string, unknown> = {
    titulo: state.titulo.trim(),
    conduta: state.conduta.trim(),
    descricao: state.descricao.trim(),
    metas,
    itensDesempenho,
  };
  if (temComp) {
    payload.comportamentos = {
      resultado: compRes,
      negativos: neg.vals,
      positivos: pos.vals,
      quantidades: { negativo: neg.qtyMap, positivo: pos.qtyMap },
      descricao: compDesc,
    };
  }
  return payload;
}
