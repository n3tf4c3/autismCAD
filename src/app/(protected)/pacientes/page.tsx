import { requirePermission } from "@/server/auth/auth";
import { listarPacientesPorUsuario } from "@/server/modules/pacientes/pacientes.service";
import { listarProfissionais } from "@/server/modules/profissionais/profissionais.service";
import { PacientesPageClient } from "@/app/(protected)/pacientes/pacientes-page.client";

export default async function PacientesPage() {
  const { user } = await requirePermission("pacientes:view");

  const items = await listarPacientesPorUsuario(Number(user.id), {});

  let profissionais: Array<{ id: number; nome: string }> = [];
  try {
    await requirePermission("profissionais:view");
    const profissionaisRows = await listarProfissionais({ somenteAssistencial: true });
    profissionais = profissionaisRows.map((item) => ({ id: item.id, nome: item.nome }));
  } catch {
    profissionais = [];
  }

  return <PacientesPageClient initialItems={items} initialProfissionais={profissionais} />;
}
