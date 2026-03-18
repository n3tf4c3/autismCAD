import { requirePermission } from "@/server/auth/auth";
import { listarTerapeutas } from "@/server/modules/terapeutas/terapeutas.service";
import { TerapeutasPageClient } from "@/app/(protected)/terapeutas/terapeutas-page.client";

export default async function TerapeutasPage() {
  await requirePermission("terapeutas:view");

  const items = await listarTerapeutas({});

  return <TerapeutasPageClient initialItems={items} />;
}
