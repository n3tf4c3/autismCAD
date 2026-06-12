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
