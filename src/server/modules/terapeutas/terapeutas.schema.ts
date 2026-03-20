import {
  especialidadesPermitidas,
  profissionaisQuerySchema,
  saveProfissionalSchema,
  type ProfissionaisQueryInput,
  type SaveProfissionalInput,
} from "@/server/modules/profissionais/profissionais.schema";

export const terapeutasQuerySchema = profissionaisQuerySchema;
export const saveTerapeutaSchema = saveProfissionalSchema;

export type TerapeutasQueryInput = ProfissionaisQueryInput;
export type SaveTerapeutaInput = SaveProfissionalInput;

export {
  especialidadesPermitidas,
};
