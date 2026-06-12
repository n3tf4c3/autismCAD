// Regra de autorizacao de acesso a uma evolucao (achado 51): um PROFISSIONAL so
// pode acessar evolucoes do seu proprio profissionalId; demais papeis com a
// permissao passam direto. O `roleCanon` deve ser o papel EFETIVO (access fresco),
// nunca a role defasada do JWT.
export function isEvolucaoAccessAllowed(params: {
  roleCanon: string | null;
  accessProfissionalId: number | null;
  evolucaoProfissionalId: number | null;
}): boolean {
  if (params.roleCanon !== "PROFISSIONAL") return true;
  return (
    !!params.accessProfissionalId &&
    params.accessProfissionalId === params.evolucaoProfissionalId
  );
}

// Regra de atribuicao de uma evolucao (achado 57): um PROFISSIONAL so pode atribuir
// a evolucao ao proprio profissionalId (do access fresco). Os demais papeis usam o
// profissionalId informado. `forbidden` sinaliza tentativa de atribuir a outro
// profissional ou PROFISSIONAL sem vinculo. O `roleCanon`/`ownProfissionalId` devem
// vir do papel EFETIVO, nunca da role defasada do JWT.
export function resolveEvolucaoProfissionalId(params: {
  roleCanon: string | null;
  ownProfissionalId: number | null;
  inputProfissionalId: number | null;
}): { profissionalId: number | null; forbidden: boolean } {
  if (params.roleCanon !== "PROFISSIONAL") {
    return { profissionalId: params.inputProfissionalId, forbidden: false };
  }
  if (params.ownProfissionalId == null) {
    return { profissionalId: null, forbidden: true };
  }
  if (
    params.inputProfissionalId != null &&
    Number(params.inputProfissionalId) !== Number(params.ownProfissionalId)
  ) {
    return { profissionalId: null, forbidden: true };
  }
  return { profissionalId: params.ownProfissionalId, forbidden: false };
}
