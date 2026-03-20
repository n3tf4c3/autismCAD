import {
  deleteTerapeuta,
  listarTerapeutas,
  obterTerapeutaDetalhe,
  obterTerapeutaPorUsuario,
  salvarTerapeuta,
  setTerapeutaAtivo,
  terapeutaAtendePaciente,
} from "@/server/modules/terapeutas/terapeutas.service";

export const listarProfissionais = listarTerapeutas;
export const obterProfissionalDetalhe = obterTerapeutaDetalhe;
export const salvarProfissional = salvarTerapeuta;
export const obterProfissionalPorUsuario = obterTerapeutaPorUsuario;
export const profissionalAtendePaciente = terapeutaAtendePaciente;
export const deleteProfissional = deleteTerapeuta;
export const setProfissionalAtivo = setTerapeutaAtivo;

export {
  deleteTerapeuta,
  listarTerapeutas,
  obterTerapeutaDetalhe,
  obterTerapeutaPorUsuario,
  salvarTerapeuta,
  setTerapeutaAtivo,
  terapeutaAtendePaciente,
};