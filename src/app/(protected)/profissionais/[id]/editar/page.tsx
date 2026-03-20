import { idParamSchema } from "@/lib/zod/api";
import { loadUserAccess } from "@/server/auth/access";
import { requireUser } from "@/server/auth/auth";
import { hasPermissionKey } from "@/server/auth/permissions";
import {
  obterProfissionalDetalhe,
  obterProfissionalPorUsuario,
} from "@/server/modules/profissionais/profissionais.service";
import { AppError } from "@/server/shared/errors";
import { ProfissionalFormClient } from "@/app/(protected)/profissionais/profissional-form.client";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditarProfissionalPage(props: PageProps) {
  const user = await requireUser();
  const access = await loadUserAccess(Number(user.id));
  const canEditAny = hasPermissionKey(access.permissions, "profissionais:edit");
  const canEditSelf = hasPermissionKey(access.permissions, "profissionais:edit_self");
  if (!canEditAny && !canEditSelf) throw new AppError("Acesso negado", 403, "FORBIDDEN");

  const { id } = idParamSchema.parse(await props.params);
  if (!canEditAny) {
    const self = await obterProfissionalPorUsuario(Number(user.id));
    if (!self || self.id !== id) throw new AppError("Acesso negado", 403, "FORBIDDEN");
  }

  const row = await obterProfissionalDetalhe(id);

  if (!row) throw new AppError("Profissional nao encontrado", 404, "NOT_FOUND");

  return (
    <ProfissionalFormClient
      mode="edit"
      initial={{
        id: row.id,
        nome: row.nome,
        cpf: row.cpf,
        nascimento: row.dataNascimento,
        telefone: row.telefone,
        cep: row.cep,
        logradouro: row.logradouro,
        numero: row.numero,
        bairro: row.bairro,
        cidade: row.cidade,
        email: row.email,
        especialidade: row.especialidade,
      }}
    />
  );
}
