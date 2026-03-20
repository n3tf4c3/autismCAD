type AnyRecord = Record<string, unknown>;

function readValue(record: AnyRecord, key: string) {
  return record[key];
}

function asNumberOr(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asNullableNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asStringOr(value: unknown, fallback = ""): string {
  if (value === undefined || value === null) return fallback;
  return String(value);
}

function asNullableString(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  return String(value);
}

function asBoolOrNumber(value: unknown): boolean | number {
  if (typeof value === "boolean" || typeof value === "number") return value;
  const raw = String(value ?? "").trim().toLowerCase();
  if (["1", "true", "sim", "yes", "on"].includes(raw)) return true;
  if (["0", "false", "nao", "não", "no", "off"].includes(raw)) return false;
  const parsed = Number(raw);
  if (Number.isFinite(parsed)) return parsed;
  return false;
}

export type AtendimentoCompat = {
  id: number;
  paciente_id: number;
  profissional_id: number | null;
  pacienteNome: string;
  profissionalNome: string | null;
  data: string;
  hora_inicio: string;
  hora_fim: string;
  turno: string;
  periodo_inicio: string | null;
  periodo_fim: string | null;
  presenca: string;
  realizado: boolean | number;
  status_repasse: string;
  resumo_repasse: string | null;
  motivo: string | null;
  observacoes: string | null;
  created_at: string | null;
  updated_at: string | null;
};

function normalizeAtendimentoRow(value: unknown): AtendimentoCompat | null {
  if (!value || typeof value !== "object") return null;
  const row = value as AnyRecord;
  const id = asNumberOr(readValue(row, "id"), 0);
  if (id <= 0) return null;

  const profissionalId = asNullableNumber(readValue(row, "profissionalId"));
  const profissionalNome = asNullableString(readValue(row, "profissionalNome"));

  return {
    id,
    paciente_id: asNumberOr(readValue(row, "pacienteId"), 0),
    profissional_id: profissionalId,
    pacienteNome: asStringOr(readValue(row, "pacienteNome"), "Paciente"),
    profissionalNome,
    data: asStringOr(readValue(row, "data")),
    hora_inicio: asStringOr(readValue(row, "horaInicio")),
    hora_fim: asStringOr(readValue(row, "horaFim")),
    turno: asStringOr(readValue(row, "turno")),
    periodo_inicio: asNullableString(readValue(row, "periodoInicio")),
    periodo_fim: asNullableString(readValue(row, "periodoFim")),
    presenca: asStringOr(readValue(row, "presenca"), "Nao informado"),
    realizado: asBoolOrNumber(readValue(row, "realizado")),
    status_repasse: asStringOr(readValue(row, "statusRepasse")),
    resumo_repasse: asNullableString(readValue(row, "resumoRepasse")),
    motivo: asNullableString(readValue(row, "motivo")),
    observacoes: asNullableString(readValue(row, "observacoes")),
    created_at: asNullableString(readValue(row, "createdAt")),
    updated_at: asNullableString(readValue(row, "updatedAt")),
  };
}

export function normalizeAtendimentosList(value: unknown): AtendimentoCompat[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => normalizeAtendimentoRow(item))
    .filter((item): item is AtendimentoCompat => !!item);
}
