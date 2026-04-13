const PERMISSION_ALIASES: Record<string, string[]> = {
  "consultas:view": ["atendimentos:view"],
  "consultas:create": ["atendimentos:create"],
  "consultas:edit": ["atendimentos:edit"],
  "consultas:cancel": ["atendimentos:delete"],
  "consultas:presence": ["atendimentos:edit"],
  "atendimentos:view": ["consultas:view"],
  "atendimentos:create": ["consultas:create"],
  "atendimentos:edit": ["consultas:edit", "consultas:presence"],
  "atendimentos:delete": ["consultas:cancel"],
  "relatorios_clinicos:view": ["relatorios:view"],
  "relatorios_clinicos:export": ["relatorios:export"],
  "prontuario:version": ["prontuario:delete"],
  "profissionais:view": ["terapeutas:view"],
  "profissionais:create": ["terapeutas:create"],
  "profissionais:edit": ["terapeutas:edit"],
  "profissionais:edit_self": ["terapeutas:edit_self"],
  "profissionais:delete": ["terapeutas:delete"],
  "terapeutas:view": ["profissionais:view"],
  "terapeutas:create": ["profissionais:create"],
  "terapeutas:edit": ["profissionais:edit"],
  "terapeutas:edit_self": ["profissionais:edit_self"],
  "terapeutas:delete": ["profissionais:delete"],
};

const ROLE_CANONICALS: Record<string, string> = {
  ADMIN: "ADMIN",
  admin: "ADMIN",
  "admin-geral": "ADMIN_GERAL",
  ADMIN_GERAL: "ADMIN_GERAL",
  PROFISSIONAL: "PROFISSIONAL",
  profissional: "PROFISSIONAL",
  RECEPCAO: "RECEPCAO",
  recepcao: "RECEPCAO",
  RESPONSAVEL: "RESPONSAVEL",
  responsavel: "RESPONSAVEL",
};

export const ADMIN_ROLES = new Set(["ADMIN", "ADMIN_GERAL"]);

export function canonicalRoleName(role?: string | null): string | null {
  if (!role) return null;
  return ROLE_CANONICALS[role.trim()] ?? null;
}

export function normalizeRoleForMatch(role?: string | null): string | null {
  if (!role) return null;
  const trimmed = role.trim();
  if (!trimmed) return null;
  return canonicalRoleName(trimmed) ?? trimmed.toLowerCase();
}

export function hasPermissionKey(
  permissions: Set<string>,
  permissionKey: string
): boolean {
  if (permissions.has(permissionKey)) return true;
  const aliases = PERMISSION_ALIASES[permissionKey] ?? [];
  return aliases.some((alias) => permissions.has(alias));
}
