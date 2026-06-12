export const ESPECIALIDADES_PROFISSIONAL = [
  "Acompanhante Terapêutico (AT)",
  "Fisioterapia",
  "Fonoaudiologia",
  "Musicoterapia",
  "Psicologia",
  "Psicomotricidade",
  "Psicopedagogia",
  "Recepcionista",
  "Secretária",
  "Serviços Gerais",
  "Terapia Ocupacional",
  "Outro",
] as const;

export const ESPECIALIDADES_PROFISSIONAL_SET = new Set<string>(ESPECIALIDADES_PROFISSIONAL);

export const ESPECIALIDADES_TERAPEUTA = ESPECIALIDADES_PROFISSIONAL;
export const ESPECIALIDADES_TERAPEUTA_SET = ESPECIALIDADES_PROFISSIONAL_SET;

const ESPECIALIDADES_QUADRO_ADMINISTRATIVO_CHAVES = new Set<string>([
  "recepcionista",
  "secretaria",
  "servicos gerais",
]);

function normalizeEspecialidadeKey(value?: string | null): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export function isEspecialidadeQuadroAdministrativo(value?: string | null): boolean {
  const key = normalizeEspecialidadeKey(value);
  return key.length > 0 && ESPECIALIDADES_QUADRO_ADMINISTRATIVO_CHAVES.has(key);
}
