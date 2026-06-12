type AnyRecord = Record<string, unknown>;

const REMOVED_FIELDS = new Set([
  "comorbidadesFamiliares",
  "quemPercebeu",
  "sinaisPercebidos",
  "idadeDiagnostico",
  "percepcaoFamilia",
  "atividadesExtras",
  "gravidezPlanejada",
  "intercorrenciasGestacionais",
  "usoMedicamentos",
  "tipoParto",
  "intercorrenciasParto",
]);

const ALLOWED_FIELDS = new Set([
  "entrevistaPor",
  "dataEntrevista",
  "possuiDiagnostico",
  "diagnostico",
  "laudoDiagnostico",
  "medicoAcompanhante",
  "fezTerapia",
  "terapias",
  "frequencia",
  "marcosMotores",
  "linguagem",
  "comunicacao",
  "escola",
  "serie",
  "periodoEscolar",
  "acompanhanteEscolar",
  "observacoesEscolares",
  "encaminhamento",
  "frustracoes",
  "humor",
  "estereotipias",
  "autoagressao",
  "heteroagressao",
  "seletividadeAlimentar",
  "rotinaSono",
  "medicamentosUsoAnterior",
  "medicamentosUsoAtual",
  "dificuldadesFamilia",
  "expectativasTerapia",
]);

function asTrimmedOrNull(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed ? trimmed : null;
}

function asBoolOrNull(value: unknown): boolean | null {
  if (value === undefined || value === null || value === "") return null;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "sim", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "nao", "no", "off"].includes(normalized)) return false;
  return null;
}

function normalizeEscola(value: unknown): "publica" | "privada" | null {
  const normalized = asTrimmedOrNull(value)?.toLowerCase();
  if (!normalized) return null;
  if (normalized === "publica" || normalized === "pública" || normalized.includes("public")) return "publica";
  if (normalized === "privada" || normalized.includes("privad")) return "privada";
  return null;
}

export function sanitizeAnamnesePayload(input: unknown): { changed: boolean; payload: AnyRecord } {
  const source = input && typeof input === "object" && !Array.isArray(input) ? ({ ...(input as AnyRecord) }) : {};
  const payload: AnyRecord = {};
  let changed = false;

  for (const [key, value] of Object.entries(source)) {
    if (REMOVED_FIELDS.has(key)) {
      changed = true;
      continue;
    }
    if (!ALLOWED_FIELDS.has(key)) {
      changed = true;
      continue;
    }
    payload[key] = value;
  }

  const normalizedEscola = normalizeEscola(payload.escola);
  if ((payload.escola ?? null) !== normalizedEscola) changed = true;
  payload.escola = normalizedEscola;

  const normalizedAcompanhante = asBoolOrNull(payload.acompanhanteEscolar);
  if ((payload.acompanhanteEscolar ?? null) !== normalizedAcompanhante) changed = true;
  payload.acompanhanteEscolar = normalizedAcompanhante;

  const normalizedEncaminhamento = asTrimmedOrNull(payload.encaminhamento);
  if ((payload.encaminhamento ?? null) !== normalizedEncaminhamento) changed = true;
  payload.encaminhamento = normalizedEncaminhamento;

  for (const key of ALLOWED_FIELDS) {
    if (!(key in payload)) {
      payload[key] = null;
      changed = true;
    }
  }

  return { changed, payload };
}

