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
