import { requirePermission } from "@/server/auth/auth";
import { listarPacientes } from "@/server/modules/pacientes/pacientes.service";
import { listarTerapeutas } from "@/server/modules/profissionais/profissionais.service";
import { PacientesPageClient } from "@/app/(protected)/pacientes/pacientes-page.client";

export default async function PacientesPage() {
  await requirePermission("pacientes:view");

  const items = await listarPacientes({});

  let terapeutas: Array<{ id: number; nome: string }> = [];
  try {
    await requirePermission("terapeutas:view");
    const terapeutasRows = await listarTerapeutas({});
    terapeutas = terapeutasRows.map((item) => ({ id: item.id, nome: item.nome }));
  } catch {
    terapeutas = [];
  }

  return <PacientesPageClient initialItems={items} initialTerapeutas={terapeutas} />;
}
