import { requirePermission } from "@/server/auth/auth";
import { hasPermission } from "@/server/auth/access";
import { listarPacientesPorUsuario } from "@/server/modules/pacientes/pacientes.service";
import { listarProfissionais } from "@/server/modules/profissionais/profissionais.service";
import { PacientesPageClient } from "@/app/(protected)/pacientes/pacientes-page.client";

export default async function PacientesPage() {
  const { user, access } = await requirePermission("pacientes:view");

  const items = await listarPacientesPorUsuario(user.id, {});

  let profissionais: Array<{ id: number; nome: string }> = [];
  try {
    await requirePermission("profissionais:view");
    const profissionaisRows = await listarProfissionais({ somenteAssistencial: true });
    profissionais = profissionaisRows.map((item) => ({ id: item.id, nome: item.nome }));
  } catch {
    profissionais = [];
  }

  // Achado 94: deriva permissoes efetivas no servidor para a UI ocultar acoes que
  // falhariam com 403 (cada action de destino ja exige a permissao correspondente).
  const canCreatePaciente = hasPermission(access, "pacientes:create");
  const canViewProntuario = hasPermission(access, "prontuario:view");
  const canCreateConsulta = hasPermission(access, "consultas:create");

  return (
    <PacientesPageClient
      initialItems={items}
      initialProfissionais={profissionais}
      canCreatePaciente={canCreatePaciente}
      canViewProntuario={canViewProntuario}
      canCreateConsulta={canCreateConsulta}
    />
  );
}
