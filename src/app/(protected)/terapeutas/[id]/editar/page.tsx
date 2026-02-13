import { db } from "@/db";
import { idParamSchema } from "@/lib/zod/api";
import { terapeutas } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { loadUserAccess } from "@/server/auth/access";
import { requireUser } from "@/server/auth/auth";
import { hasPermissionKey } from "@/server/auth/permissions";
import { obterTerapeutaPorUsuario } from "@/server/modules/terapeutas/terapeutas.service";
import { AppError } from "@/server/shared/errors";
import { TerapeutaFormClient } from "@/app/(protected)/terapeutas/terapeuta-form.client";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditarTerapeutaPage(props: PageProps) {
  const user = await requireUser();
  const access = await loadUserAccess(Number(user.id));
  const canEditAny = hasPermissionKey(access.permissions, "terapeutas:edit");
  const canEditSelf = hasPermissionKey(access.permissions, "terapeutas:edit_self");
  if (!canEditAny && !canEditSelf) throw new AppError("Acesso negado", 403, "FORBIDDEN");

  const { id } = idParamSchema.parse(await props.params);
  if (!canEditAny) {
    const self = await obterTerapeutaPorUsuario(Number(user.id));
    if (!self || self.id !== id) throw new AppError("Acesso negado", 403, "FORBIDDEN");
  }

  const [row] = await db
    .select({
      id: terapeutas.id,
      nome: terapeutas.nome,
      cpf: terapeutas.cpf,
      nascimento: terapeutas.dataNascimento,
      telefone: terapeutas.telefone,
      cep: terapeutas.cep,
      logradouro: terapeutas.logradouro,
      numero: terapeutas.numero,
      bairro: terapeutas.bairro,
      cidade: terapeutas.cidade,
      email: terapeutas.email,
      especialidade: terapeutas.especialidade,
    })
    .from(terapeutas)
    .where(eq(terapeutas.id, id))
    .limit(1);

  if (!row) throw new AppError("Terapeuta nao encontrado", 404, "NOT_FOUND");

  return (
    <TerapeutaFormClient
      mode="edit"
      initial={{
        id: row.id,
        nome: row.nome,
        cpf: row.cpf,
        nascimento: row.nascimento,
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

