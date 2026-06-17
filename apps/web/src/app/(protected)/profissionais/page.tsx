import { requirePermission } from "@/server/auth/auth";
import { hasPermission } from "@/server/auth/access";
import {
  listarProfissionais,
  obterProfissionalPorUsuario,
} from "@/server/modules/profissionais/profissionais.service";
import { ProfissionaisPageClient } from "@/app/(protected)/profissionais/profissionais-page.client";

export default async function ProfissionaisPage() {
  // Achado 93: deriva as permissoes efetivas no servidor para a UI ocultar acoes
  // que falhariam com 403 (a action ja exige a permissao correspondente).
  const { user, access } = await requirePermission("profissionais:view");

  const items = await listarProfissionais({});

  const canCreate = hasPermission(access, "profissionais:create");
  const canEditAny = hasPermission(access, "profissionais:edit");
  const canEditSelf = hasPermission(access, "profissionais:edit_self");
  // So precisa do proprio profissionalId quando o usuario edita apenas a si mesmo.
  const ownProfissionalId =
    !canEditAny && canEditSelf
      ? (await obterProfissionalPorUsuario(user.id))?.id ?? null
      : null;

  return (
    <ProfissionaisPageClient
      initialItems={items}
      canCreate={canCreate}
      canEditAny={canEditAny}
      canEditSelf={canEditSelf}
      ownProfissionalId={ownProfissionalId}
    />
  );
}
