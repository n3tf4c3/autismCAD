import { requirePermission } from "@/server/auth/auth";
import { listarProfissionais } from "@/server/modules/profissionais/profissionais.service";
import { ProfissionaisPageClient } from "@/app/(protected)/profissionais/profissionais-page.client";

export default async function ProfissionaisPage() {
  await requirePermission("profissionais:view");

  const items = await listarProfissionais({});

  return <ProfissionaisPageClient initialItems={items} />;
}
