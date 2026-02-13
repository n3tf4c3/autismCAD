import { requirePermission } from "@/server/auth/auth";
import { TerapeutaFormClient } from "@/app/(protected)/terapeutas/terapeuta-form.client";

export default async function NovoTerapeutaPage() {
  await requirePermission("terapeutas:create");
  return <TerapeutaFormClient mode="create" />;
}

