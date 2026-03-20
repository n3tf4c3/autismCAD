import {
  especialidadesPermitidas,
  saveTerapeutaSchema,
  terapeutasQuerySchema,
  type SaveTerapeutaInput,
  type TerapeutasQueryInput,
} from "@/server/modules/terapeutas/terapeutas.schema";

export const profissionaisQuerySchema = terapeutasQuerySchema;
export const saveProfissionalSchema = saveTerapeutaSchema;

export type ProfissionaisQueryInput = TerapeutasQueryInput;
export type SaveProfissionalInput = SaveTerapeutaInput;
export type { SaveTerapeutaInput, TerapeutasQueryInput };

export {
  especialidadesPermitidas,
  saveTerapeutaSchema,
  terapeutasQuerySchema,
};
