import { requirePermission } from "@/server/auth/auth";
import { ADMIN_ROLES, hasPermissionKey } from "@/server/auth/permissions";
import { listarPacientesPorUsuario } from "@/server/modules/pacientes/pacientes.service";
import { listarProfissionais } from "@/server/modules/profissionais/profissionais.service";
import { ConsultasClient } from "@/app/(protected)/consultas/consultas.client";

export default async function ConsultasPage() {
  const { user, access } = await requirePermission("consultas:view");
  const accessRole = access.canonicalRole ?? access.role;
  const isAdmin = accessRole ? ADMIN_ROLES.has(accessRole) : false;
  const canEditAtendimento =
    isAdmin ||
    hasPermissionKey(access.permissions, "consultas:edit") ||
    hasPermissionKey(access.permissions, "consultas:presence");
  const canDeleteAtendimento = isAdmin || hasPermissionKey(access.permissions, "consultas:cancel");
  const canEditRepasse = isAdmin || hasPermissionKey(access.permissions, "evolucoes:create");

  let profissionais: Array<{ id: number; nome: string }> = [];
  try {
    await requirePermission("profissionais:view");
    const profissionaisRows = await listarProfissionais({ somenteAssistencial: true });
    profissionais = profissionaisRows.map((item) => ({ id: item.id, nome: item.nome }));
  } catch {
    profissionais = [];
  }

  let pacientes: Array<{ id: number; nome: string }> = [];
  try {
    await requirePermission("pacientes:view");
    const pacientesRows = await listarPacientesPorUsuario(user.id, {});
    pacientes = pacientesRows.map((item) => ({ id: item.id, nome: item.nome }));
  } catch {
    pacientes = [];
  }

  return (
    <ConsultasClient
      initialProfissionais={profissionais}
      initialPacientes={pacientes}
      canEditAtendimento={canEditAtendimento}
      canDeleteAtendimento={canDeleteAtendimento}
      canEditRepasse={canEditRepasse}
    />
  );
}
