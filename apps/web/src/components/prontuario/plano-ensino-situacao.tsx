import { situacaoPlanoEnsino, type PlanoEnsinoListaItem } from "@/lib/prontuario/plano-ensino-validade";

const colors = {
  vencido: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
  hoje: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
  a_vencer: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  em_dia: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200",
  sem_data: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  rascunho: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  historico: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
};

export function PlanoEnsinoSituacao(props: { plano: PlanoEnsinoListaItem; hoje: string; antecedencia: number }) {
  const situacao = situacaoPlanoEnsino(props.plano, props.hoje, props.antecedencia);
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${colors[situacao.tipo]}`}>{situacao.label}</span>;
}
