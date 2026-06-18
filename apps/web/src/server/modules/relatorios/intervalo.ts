// Achado 108: relatorios carregam todos os registros do intervalo [from, to]. Sem teto,
// um intervalo enorme (anos) gera resposta gigante e sobrecarga. Limitamos o intervalo
// a um maximo de dias; o predicado puro abaixo isola a decisao para ser testavel.

export const RELATORIO_MAX_INTERVALO_DIAS = 366;

export function excedeIntervaloMaximoDias(
  from: string,
  to: string,
  maxDias: number = RELATORIO_MAX_INTERVALO_DIAS
): boolean {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end)) return false;
  const dias = Math.floor((end - start) / 86_400_000) + 1;
  return dias > maxDias;
}
