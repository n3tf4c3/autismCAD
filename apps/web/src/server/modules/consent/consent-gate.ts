// Achado 122: a API por token so libera dados quando o consentimento vigente foi aceito
// (paridade com o gate server-side da web em (protected)/layout.tsx). As rotas que precisam
// funcionar SEM consentimento (aceitar a politica) passam skipConsentGate para nao criar
// laco. Predicado puro (sem acesso a banco) para teste de regressao.
export function consentGateBlocks(params: {
  consentRequired: boolean;
  skipConsentGate: boolean;
}): boolean {
  return params.consentRequired && !params.skipConsentGate;
}
