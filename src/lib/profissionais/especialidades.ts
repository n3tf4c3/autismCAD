export const ESPECIALIDADES_PROFISSIONAL = [
  "Psicologia",
  "Terapia Ocupacional",
  "Fonoaudiologia",
  "Fisioterapia",
  "Psicopedagogia",
  "Acompanhante Terapeutico (AT)",
  "Outro",
] as const;

export const ESPECIALIDADES_PROFISSIONAL_SET = new Set<string>(ESPECIALIDADES_PROFISSIONAL);

export const ESPECIALIDADES_TERAPEUTA = ESPECIALIDADES_PROFISSIONAL;
export const ESPECIALIDADES_TERAPEUTA_SET = ESPECIALIDADES_PROFISSIONAL_SET;