const PERMISSION_ALIASES: Record<string, string[]> = {
  "consultas:view": ["atendimentos:view"],
  "consultas:create": ["atendimentos:create"],
  "consultas:edit": ["atendimentos:edit"],
  "consultas:cancel": ["atendimentos:delete"],
  "consultas:presence": ["atendimentos:edit"],
  "consultas:repasse_edit": ["atendimentos:edit"],
  "relatorios_clinicos:view": ["relatorios:view"],
  "relatorios_clinicos:export": ["relatorios:export"],
  "prontuario:version": ["prontuario:delete"],
};

const ROLE_CANONICALS: Record<string, string> = {
  ADMIN: "ADMIN",
  admin: "ADMIN",
  "admin-geral": "ADMIN_GERAL",
  ADMIN_GERAL: "ADMIN_GERAL",
  TERAPEUTA: "TERAPEUTA",
  terapeuta: "TERAPEUTA",
  RECEPCAO: "RECEPCAO",
  recepcao: "RECEPCAO",
};

export const ADMIN_ROLES = new Set(["ADMIN", "ADMIN_GERAL"]);

export function canonicalRoleName(role?: string | null): string | null {
  if (!role) return null;
  return ROLE_CANONICALS[role.trim()] ?? null;
}

export function accessHasRole(roles: string[], role: string): boolean {
  const target = canonicalRoleName(role);
  if (!target) return false;
  return roles.some((value) => canonicalRoleName(value) === target);
}

export function hasPermissionKey(
  permissions: Set<string>,
  permissionKey: string
): boolean {
  if (permissions.has(permissionKey)) return true;
  const aliases = PERMISSION_ALIASES[permissionKey] ?? [];
  return aliases.some((alias) => permissions.has(alias));
}
