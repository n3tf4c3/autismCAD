import { requirePermission } from "@/server/auth/auth";
import { ADMIN_ROLES, canonicalRoleName, hasPermissionKey } from "@/server/auth/permissions";
import { listarPacientes } from "@/server/modules/pacientes/pacientes.service";
import { listarTerapeutas } from "@/server/modules/terapeutas/terapeutas.service";
import { ConsultasClient } from "@/app/(protected)/consultas/consultas.client";

export default async function ConsultasPage() {
  const { access } = await requirePermission("consultas:view");
  const isAdmin = access.roles.some((role) => ADMIN_ROLES.has(canonicalRoleName(role) ?? role));
  const canEditAtendimento =
    isAdmin ||
    hasPermissionKey(access.permissions, "consultas:edit") ||
    hasPermissionKey(access.permissions, "consultas:presence");
  const canDeleteAtendimento = isAdmin || hasPermissionKey(access.permissions, "consultas:cancel");
  const canEditRepasse = isAdmin || hasPermissionKey(access.permissions, "consultas:repasse_edit");

  let terapeutas: Array<{ id: number; nome: string }> = [];
  try {
    await requirePermission("terapeutas:view");
    const terapeutasRows = await listarTerapeutas({});
    terapeutas = terapeutasRows.map((item) => ({ id: item.id, nome: item.nome }));
  } catch {
    terapeutas = [];
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
      initialTerapeutas={terapeutas}
      initialPacientes={pacientes}
      canEditAtendimento={canEditAtendimento}
      canDeleteAtendimento={canDeleteAtendimento}
      canEditRepasse={canEditRepasse}
    />
  );
}
