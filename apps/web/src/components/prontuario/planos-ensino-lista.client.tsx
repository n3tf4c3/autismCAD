"use client";

import Link from "next/link";
import { formatDateBr } from "@autismcad/shared/date-only";
import type { PlanoEnsinoListaItem } from "@/lib/prontuario/plano-ensino-validade";
import { usePrazoAlertaPlano } from "@/lib/prontuario/use-prazo-alerta-plano";
import { PlanoEnsinoSituacao } from "./plano-ensino-situacao";
import { ClonarPlanoEnsinoClient } from "./clonar-plano-ensino.client";

export function PlanosEnsinoListaClient(props: { planos: PlanoEnsinoListaItem[]; hoje: string; userId: number; canAjustarAlerta?: boolean; canClonar?: boolean }) {
  const [antecedencia] = usePrazoAlertaPlano(props.userId);
  return (
    <section id="planos-ensino" aria-labelledby="planos-ensino-titulo" className="rounded-2xl bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="planos-ensino-titulo" className="text-xl font-bold text-[var(--marrom)]">Planos de ensino</h2>
        <span className="text-sm text-gray-500">{props.planos.length} plano(s)</span>
      </div>
      <p className="mt-1 text-sm text-gray-600">
        Alertas a partir de {antecedencia} dias antes da data final.
        {props.canAjustarAlerta ? <> <Link href="/dashboard#alertas-planos-ensino" className="font-semibold text-[var(--marrom)] underline">Ajustar no dashboard</Link>.</> : null}
      </p>
      <p className="mt-1 text-xs text-gray-500">O último plano finalizado de cada especialidade gera os alertas. Os anteriores ficam como histórico.</p>
      {props.planos.length ? (
        <ul className="mt-4 divide-y divide-gray-100">
          {props.planos.map((plano) => (
            <li key={plano.id} className="flex flex-col gap-3 py-4 first:pt-0 lg:flex-row lg:items-center">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-[var(--marrom)]">{plano.especialidade || "Especialidade não informada"}</h3>
                  <PlanoEnsinoSituacao plano={plano} hoje={props.hoje} antecedencia={antecedencia} />
                </div>
                <p className="mt-1 text-xs text-gray-500">{plano.status} · Versão {plano.version}</p>
              </div>
              <dl className="grid grid-cols-3 gap-3 text-sm lg:min-w-[360px]">
                {[["Cadastro", plano.cadastradoEm], ["Início", plano.dataInicio], ["Vencimento", plano.dataFinal]].map(([label, date]) => (
                  <div key={label}>
                    <dt className="text-xs text-gray-500">{label}</dt>
                    <dd className="mt-1 font-medium text-gray-700">{formatDateBr(date)}</dd>
                  </div>
                ))}
              </dl>
              <div className="flex flex-wrap gap-2">
                {props.canClonar ? <ClonarPlanoEnsinoClient documentoId={plano.id} pacienteId={plano.pacienteId} /> : null}
                <Link href={`/prontuario/documento/${plano.id}`} aria-label={`Abrir plano de ${plano.especialidade || "especialidade não informada"}, versão ${plano.version}`} className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-[var(--marrom)] hover:bg-amber-50">Abrir</Link>
                <Link href={`/impressao/plano-ensino/individual?pacienteId=${plano.pacienteId}&documentoId=${plano.id}`} target="_blank" rel="noopener noreferrer" aria-label={`Imprimir plano de ${plano.especialidade || "especialidade não informada"}, versão ${plano.version}`} className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-[var(--marrom)] hover:bg-amber-50">Imprimir</Link>
              </div>
            </li>
          ))}
        </ul>
      ) : <p className="mt-4 text-sm text-gray-600">Nenhum plano de ensino cadastrado para este paciente.</p>}
    </section>
  );
}
