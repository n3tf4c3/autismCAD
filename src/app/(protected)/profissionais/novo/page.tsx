import { requirePermission } from "@/server/auth/auth";
import { ProfissionalFormClient } from "@/app/(protected)/profissionais/profissional-form.client";

export default async function NovoProfissionalPage() {
  await requirePermission("terapeutas:create");
  return <ProfissionalFormClient mode="create" />;
}

