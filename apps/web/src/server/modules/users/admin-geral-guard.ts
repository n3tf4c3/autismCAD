// Achado 102: excluir/rebaixar um usuario nao pode deixar o sistema sem admin-geral
// ativo. O predicado puro abaixo isola a decisao (papel-alvo + existencia de outro
// admin-geral ativo) para ser testavel sem banco; a query fica no service.

export function blocksLastAdminGeralRemoval(params: {
  targetRoleCanon: string;
  otherActiveAdminGeralExists: boolean;
}): boolean {
  return params.targetRoleCanon === "ADMIN_GERAL" && !params.otherActiveAdminGeralExists;
}
