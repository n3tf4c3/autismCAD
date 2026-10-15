"use client";

import Link from "next/link";
import { formatDateBr } from "@autismcad/shared/date-only";
import { PRAZOS_ALERTA_PLANO_ENSINO } from "@autismcad/validators/prontuario/plano-ensino-alertas";
import { diasAteVencimento, selecionarAlertasPlanos, type PlanoEnsinoListaItem } from "@/lib/prontuario/plano-ensino-validade";
import { usePrazoAlertaPlano } from "@/lib/prontuario/use-prazo-alerta-plano";
import { PlanoEnsinoSituacao } from "@/components/prontuario/plano-ensino-situacao";

export function PlanosEnsinoAlertasClient(props: { planos: PlanoEnsinoListaItem[]; hoje: string; userId: number }) {
  const [antecedencia, setAntecedencia] = usePrazoAlertaPlano(props.userId);
  const alertas = selecionarAlertasPlanos(props.planos, props.hoje, antecedencia);
  const vencidos = alertas.filter((plano) => (diasAteVencimento(plano.dataFinal, props.hoje) ?? 1) < 0).length;
  return (
    <section id="alertas-planos-ensino" aria-labelledby="alertas-planos-titulo" className="rounded-2xl bg-white p-5 shadow-sm sm:col-span-2 xl:col-span-3">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 id="alertas-planos-titulo" className="text-xl font-bold text-[var(--marrom)]">Vencimento dos planos de ensino</h2>
          <p className="mt-1 text-sm text-gray-600">Último plano finalizado de cada paciente e especialidade.</p>
        </div>
        <label className="flex flex-col gap-1 text-sm font-semibold text-[var(--marrom)]">
          <span>Alertar com antecedência de</span>
          <select value={antecedencia} onChange={(event) => setAntecedencia(Number(event.target.value))} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-gray-700">
            {PRAZOS_ALERTA_PLANO_ENSINO.map((dias) => <option key={dias} value={dias}>{dias} dias</option>)}
          </select>
          <span className="text-xs font-normal text-gray-500">Preferência salva para você neste navegador.</span>
        </label>
      </div>
      <p role="status" className="mt-3 text-sm text-gray-600">{vencidos} vencido(s) · {alertas.length} plano(s) precisam de atenção</p>
      {alertas.length ? (
        <ul className="mt-3 max-h-[420px] divide-y divide-gray-100 overflow-y-auto pr-1">
          {alertas.map((plano) => (
            <li key={plano.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <Link href={`/prontuario/${plano.pacienteId}#planos-ensino`} className="font-semibold text-[var(--marrom)] underline">{plano.pacienteNome}</Link>
                <p className="mt-1 text-sm text-gray-600">{plano.especialidade || "Especialidade não informada"} · Vencimento: {formatDateBr(plano.dataFinal)}</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <PlanoEnsinoSituacao plano={plano} hoje={props.hoje} antecedencia={antecedencia} />
                <Link href={`/prontuario/documento/${plano.id}`} aria-label={`Abrir plano de ${plano.especialidade || "especialidade não informada"} de ${plano.pacienteNome}`} className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-[var(--marrom)] hover:bg-amber-50">Abrir plano</Link>
              </div>
            </li>
          ))}
        </ul>
      ) : <p className="mt-4 rounded-xl bg-green-50 p-3 text-sm text-green-800 dark:bg-green-950 dark:text-green-200">Nenhum plano vencido ou com vencimento nos próximos {antecedencia} dias.</p>}
    </section>
  );
}
