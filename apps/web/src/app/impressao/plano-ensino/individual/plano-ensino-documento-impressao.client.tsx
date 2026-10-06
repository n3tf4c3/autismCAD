"use client";

import Link from "next/link";
import { formatDateBr } from "@autismcad/shared/date-only";
import type { PlanoEnsinoBloco, PlanoEnsinoPayload } from "@autismcad/shared/plano-ensino";

const CAMPOS_BLOCO = [
  ["habilidade", "Habilidade"],
  ["ensino", "Ensino"],
  ["objetivoEnsino", "Objetivo de ensino"],
  ["procedimento", "Procedimento"],
  ["recursos", "Recursos"],
  ["suportes", "Suportes"],
  ["alvo", "Alvo"],
  ["objetivoEspecifico", "Objetivo específico"],
  ["criterioSucesso", "Critério de sucesso"],
] as const satisfies ReadonlyArray<readonly [keyof PlanoEnsinoBloco, string]>;

const PLANO_EM_BRANCO: PlanoEnsinoPayload = {
  especialidade: null,
  responsavelTecnico: null,
  dataInicio: null,
  dataFinal: null,
  blocos: [{
    habilidade: null, ensino: null, objetivoEnsino: null, procedimento: null,
    recursos: null, suportes: null, alvo: null, objetivoEspecifico: null, criterioSucesso: null,
  }],
};

type PlanoOption = {
  id: number;
  titulo: string;
  status: string | null;
  updatedAt: string | null;
};

export function PlanoEnsinoDocumentoImpressaoClient(props: {
  paciente: { id: number; nome: string; dataNascimento: string | null };
  canCriarPlano: boolean;
  planos: PlanoOption[];
  documento: (PlanoOption & { autorNome: string; plano: PlanoEnsinoPayload }) | null;
}) {
  const { paciente, documento } = props;
  const modeloEmBranco = !documento && props.planos.length === 0;
  const plano = documento?.plano ?? (modeloEmBranco ? PLANO_EM_BRANCO : null);

  return (
    <main className="plan-print-root">
      <section className="plan-print-toolbar">
        <div className="plan-print-toolbar-heading">
          <div>
            <h1>Imprimir plano de ensino</h1>
            <p>{modeloEmBranco
              ? "Imprima o modelo em branco para preencher ou cadastre um plano de ensino."
              : "Escolha o plano, clique em Abrir plano e depois imprima ou salve em PDF."}</p>
          </div>
          <Link href={`/prontuario/${paciente.id}`}>&larr; Voltar ao prontuário</Link>
        </div>
        {props.planos.length ? (
          <form action="/impressao/plano-ensino/individual" method="get" className="plan-print-controls">
            <input type="hidden" name="pacienteId" value={paciente.id} />
            <label>
              Plano de ensino
              <select name="documentoId" defaultValue={documento?.id}>
                {props.planos.map((item) => (
                  <option key={item.id} value={item.id}>
                    #{item.id} — {item.titulo} — {item.status || "Sem status"} — {formatDateBr(item.updatedAt)}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit">Abrir plano</button>
            <button type="button" className="plan-print-primary" onClick={() => window.print()}>
              Imprimir / Salvar PDF
            </button>
          </form>
        ) : (
          <>
            <p>Nenhum plano de ensino salvo para este paciente. O modelo abaixo está disponível para impressão.</p>
            <div className="plan-print-controls">
              <button type="button" className="plan-print-primary" onClick={() => window.print()}>
                Imprimir / Salvar PDF
              </button>
              {props.canCriarPlano ? (
                <Link href={`/prontuario/${paciente.id}/plano-ensino`} className="plan-print-create">
                  Criar plano de ensino
                </Link>
              ) : null}
            </div>
          </>
        )}
      </section>

      {plano ? (
        <article className="plan-print-sheet" aria-label="Plano de ensino para impressão">
          <header className="plan-print-header">
            <div>
              <p className="plan-print-clinic">Clínica Girassóis</p>
              <h2>Plano de Ensino</h2>
              <p>{modeloEmBranco ? "Modelo em branco para preenchimento" : documento?.titulo}</p>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/girassois.svg" alt="Clínica Girassóis" width="140" height="80" />
          </header>

          {documento?.status === "Rascunho" ? (
            <p className="plan-print-draft">RASCUNHO — Plano ainda não finalizado.</p>
          ) : null}

          <dl className="plan-print-identification">
            <div className="plan-print-patient"><dt>Paciente</dt><dd>{paciente.nome}</dd></div>
            <div><dt>Data de nascimento</dt><dd>{formatDateBr(paciente.dataNascimento)}</dd></div>
            <div><dt>Especialidade</dt><dd className={modeloEmBranco ? "plan-print-blank" : undefined}>{modeloEmBranco ? "\u00a0" : plano.especialidade || "—"}</dd></div>
            <div><dt>Data de início</dt><dd className={modeloEmBranco ? "plan-print-blank" : undefined}>{modeloEmBranco ? "\u00a0" : formatDateBr(plano.dataInicio)}</dd></div>
            <div><dt>Data final</dt><dd className={modeloEmBranco ? "plan-print-blank" : undefined}>{modeloEmBranco ? "\u00a0" : formatDateBr(plano.dataFinal)}</dd></div>
            <div className="plan-print-responsible"><dt>Responsável Técnico(a)</dt><dd className={modeloEmBranco ? "plan-print-blank" : undefined}>{modeloEmBranco ? "\u00a0" : plano.responsavelTecnico || "—"}</dd></div>
          </dl>

          {plano.blocos.length ? plano.blocos.map((bloco, index) => (
            <section key={index} className="plan-print-block">
              <h3>Bloco {index + 1}</h3>
              <dl>
                {CAMPOS_BLOCO.map(([key, label]) => (
                  <div key={key} className="plan-print-field">
                    <dt>{label}</dt>
                    <dd className={modeloEmBranco ? "plan-print-blank" : undefined}>{modeloEmBranco ? "\u00a0" : bloco[key] || "—"}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )) : <p>Nenhum bloco cadastrado neste plano de ensino.</p>}
        </article>
      ) : null}

      <style jsx global>{`
        .plan-print-root { min-height: 100vh; background: #f5f1ec; padding: 24px 16px; color: #272727; }
        .plan-print-root * { box-sizing: border-box; }
        .plan-print-toolbar, .plan-print-sheet { max-width: 900px; margin: 0 auto; background: white; }
        .plan-print-toolbar { padding: 20px; border: 1px solid #ded7cf; border-radius: 16px; margin-bottom: 20px; }
        .plan-print-toolbar-heading { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
        .plan-print-toolbar h1 { margin: 0; font-size: 22px; font-weight: 700; color: #4d392a; }
        .plan-print-toolbar p { font-size: 14px; margin: 8px 0; }
        .plan-print-toolbar a { font-size: 14px; color: #68411e; font-weight: 600; }
        .plan-print-controls { display: flex; flex-wrap: wrap; align-items: end; gap: 12px; margin-top: 16px; }
        .plan-print-controls label { display: flex; flex: 1 1 300px; min-width: 0; flex-direction: column; gap: 6px; font-size: 14px; font-weight: 600; }
        .plan-print-controls select { width: 100%; min-width: 0; }
        .plan-print-controls select, .plan-print-controls button { border: 1px solid #b7afa7; border-radius: 8px; padding: 10px 12px; min-height: 44px; background: white; font: inherit; font-size: 14px; color: #272727; }
        .plan-print-controls button { cursor: pointer; font-weight: 600; }
        .plan-print-controls .plan-print-primary { background: #f7ac23; border-color: #f7ac23; color: #3b2a19; }
        .plan-print-controls .plan-print-create { border: 1px solid #b7afa7; border-radius: 8px; padding: 10px 12px; min-height: 44px; display: inline-flex; align-items: center; }
        .plan-print-controls :focus-visible, .plan-print-toolbar a:focus-visible { outline: 2px solid #68411e; outline-offset: 3px; }
        .plan-print-sheet { padding: 32px; border: 1px solid #ded7cf; border-radius: 12px; font-family: Arial, sans-serif; font-size: 14px; line-height: 1.5; }
        .plan-print-header { display: flex; align-items: center; justify-content: space-between; gap: 20px; border-bottom: 2px solid #78604a; padding-bottom: 16px; margin-bottom: 16px; break-inside: avoid; }
        .plan-print-header h2 { margin: 4px 0; font-size: 26px; font-weight: 700; color: #4d392a; }
        .plan-print-header p { margin: 0; }
        .plan-print-clinic { text-transform: uppercase; letter-spacing: 1px; font-size: 12px; font-weight: 700; }
        .plan-print-header img { flex-shrink: 0; max-width: 30%; height: auto; object-fit: contain; }
        .plan-print-draft { margin: 0 0 16px; border: 2px solid #78604a; padding: 8px 12px; font-weight: 700; break-inside: avoid; }
        .plan-print-identification { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px 20px; border-bottom: 1px solid #b7afa7; padding-bottom: 16px; margin: 0 0 20px; break-inside: avoid; }
        .plan-print-patient { grid-column: span 2; }
        .plan-print-responsible { grid-column: 1; }
        .plan-print-sheet dt { font-size: 12px; font-weight: 700; color: #4d392a; break-after: avoid; }
        .plan-print-sheet dd { margin: 3px 0 0; white-space: pre-wrap; overflow-wrap: anywhere; orphans: 3; widows: 3; }
        .plan-print-sheet .plan-print-blank { min-height: 28px; border-bottom: 1px dotted #b7afa7; }
        .plan-print-block { margin-top: 20px; }
        .plan-print-block h3 { border-bottom: 1px solid #78604a; margin: 0; padding: 6px 0; font-size: 16px; font-weight: 700; break-after: avoid; }
        .plan-print-block dl { margin: 0; }
        .plan-print-field { padding: 10px 0; border-bottom: 1px solid #ded7cf; }
        @media screen and (max-width: 600px) {
          .plan-print-sheet { padding: 20px; }
          .plan-print-identification { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .plan-print-patient { grid-column: 1 / -1; }
          .plan-print-header h2 { font-size: 22px; }
        }
        @page { size: A4 portrait; margin: 14mm; }
        @media print {
          html, body { margin: 0 !important; padding: 0 !important; background: white !important; }
          .plan-print-root { min-height: 0; padding: 0; background: white; }
          .plan-print-toolbar { display: none !important; }
          .plan-print-sheet { width: 100%; max-width: none; margin: 0; padding: 0; border: 0; border-radius: 0; font-size: 10pt; color: black; }
          .plan-print-header h2 { font-size: 20pt; }
          .plan-print-identification { row-gap: 8px; margin-bottom: 16px; }
          .plan-print-sheet dt { font-size: 9pt; color: black; }
          .plan-print-block h3 { font-size: 12pt; color: black; }
          .plan-print-field { padding: 7px 0; }
          .plan-print-header { color: black; }
        }
      `}</style>
    </main>
  );
}
