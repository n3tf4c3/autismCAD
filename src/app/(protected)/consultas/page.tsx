import { requirePermission } from "@/server/auth/auth";
import { ADMIN_ROLES, canonicalRoleName, hasPermissionKey } from "@/server/auth/permissions";
import { listarPacientes } from "@/server/modules/pacientes/pacientes.service";
import { listarProfissionais } from "@/server/modules/profissionais/profissionais.service";
import { ConsultasClient } from "@/app/(protected)/consultas/consultas.client";

export default async function ConsultasPage() {
  const { access } = await requirePermission("consultas:view");
  const isAdmin = access.roles.some((role) => ADMIN_ROLES.has(canonicalRoleName(role) ?? role));
  const canEditAtendimento =
    isAdmin ||
    hasPermissionKey(access.permissions, "consultas:edit") ||
    hasPermissionKey(access.permissions, "consultas:presence");
  const canDeleteAtendimento = isAdmin || hasPermissionKey(access.permissions, "consultas:cancel");
  const canEditRepasse = isAdmin || hasPermissionKey(access.permissions, "evolucoes:create");

  let profissionais: Array<{ id: number; nome: string }> = [];
  try {
    await requirePermission("profissionais:view");
    const profissionaisRows = await listarProfissionais({});
    profissionais = profissionaisRows.map((item) => ({ id: item.id, nome: item.nome }));
  } catch {
    profissionais = [];
  }

  let pacientes: Array<{ id: number; nome: string }> = [];
  try {
    await requirePermission("pacientes:view");
    const pacientesRows = await listarPacientes({});
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
