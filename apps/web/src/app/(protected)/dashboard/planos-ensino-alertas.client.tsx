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
    <section id="alertas-planos-ensino" aria-labelledby="alertas-planos-titulo" aria-describedby="alertas-planos-descricao" className="rounded-2xl bg-white p-4 shadow-sm sm:col-span-2 xl:col-span-3">
      <p id="alertas-planos-descricao" className="sr-only">Último plano finalizado de cada paciente e especialidade.</p>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h2 id="alertas-planos-titulo" className="text-base font-bold text-[var(--marrom)]">Vencimento dos planos de ensino</h2>
          <p role="status" className={`mt-0.5 text-xs ${alertas.length ? "text-gray-600" : "text-green-700 dark:text-green-300"}`}>
            {alertas.length
              ? `${vencidos} vencido(s) · ${alertas.length} plano(s) precisam de atenção`
              : `Nenhum plano vencido ou com vencimento nos próximos ${antecedencia} dias.`}
          </p>
        </div>
        <label className="inline-flex shrink-0 items-center gap-2 text-xs font-semibold text-[var(--marrom)]">
          <span>Antecedência</span>
          <select aria-label="Alertar com antecedência de" title="Preferência salva para você neste navegador." value={antecedencia} onChange={(event) => setAntecedencia(Number(event.target.value))} className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-700">
            {PRAZOS_ALERTA_PLANO_ENSINO.map((dias) => <option key={dias} value={dias}>{dias} dias</option>)}
          </select>
        </label>
      </div>
      {alertas.length ? (
        <ul className="mt-2 max-h-60 divide-y divide-gray-100 overflow-y-auto pr-1">
          {alertas.map((plano) => (
            <li key={plano.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 py-2">
              <div className="flex min-w-0 basis-full flex-wrap items-baseline gap-x-2 gap-y-0.5 sm:basis-0 sm:flex-1">
                <Link href={`/prontuario/${plano.pacienteId}#planos-ensino`} className="text-sm font-semibold text-[var(--marrom)] underline">{plano.pacienteNome}</Link>
                <span className="text-xs text-gray-600">{plano.especialidade || "Especialidade não informada"} · Vencimento: {formatDateBr(plano.dataFinal)}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <PlanoEnsinoSituacao plano={plano} hoje={props.hoje} antecedencia={antecedencia} />
                <Link href={`/prontuario/documento/${plano.id}`} aria-label={`Abrir plano de ${plano.especialidade || "especialidade não informada"} de ${plano.pacienteNome}`} className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-semibold text-[var(--marrom)] hover:bg-amber-50">Abrir plano</Link>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
