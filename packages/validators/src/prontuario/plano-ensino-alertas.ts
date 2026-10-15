export const PRAZOS_ALERTA_PLANO_ENSINO = [7, 15, 30, 60, 90] as const;
export const PRAZO_ALERTA_PLANO_ENSINO_PADRAO = 30;

export function isPrazoAlertaPlanoEnsino(value: number): boolean {
  return PRAZOS_ALERTA_PLANO_ENSINO.some((prazo) => prazo === value);
}
