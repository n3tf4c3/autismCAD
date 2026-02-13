"use client";

import { useEffect, useMemo, useState } from "react";

type RoleRow = { nome: string };
type PermissionRow = { id: number; resource: string; action: string };
type RolePermissionsResponse = {
  role: { nome: string };
  permissions: PermissionRow[];
};

type UserRow = {
  id: number;
  nome: string | null;
  email: string;
  role: string | null;
  created_at?: string | null;
};

type Tone = "neutral" | "success" | "error";

const ACTIONS = ["view", "create", "edit", "delete", "export", "finalize"] as const;
const ACTION_LABEL: Record<(typeof ACTIONS)[number], string> = {
  view: "Ver",
  create: "Criar",
  edit: "Editar",
  delete: "Excluir",
  export: "Exportar",
  finalize: "Finalizar",
};

const ALLOWED_ROLES = ["admin-geral", "admin", "recepcao", "terapeuta"] as const;
type AllowedRole = (typeof ALLOWED_ROLES)[number];

function classForTone(tone: Tone): string {
  if (tone === "success") return "text-green-700";
  if (tone === "error") return "text-red-600";
  return "text-slate-600";
}

function normalizeApiError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Erro inesperado";
}

function readApiError(json: unknown): string | null {
  if (!json || typeof json !== "object") return null;
  const record = json as Record<string, unknown>;
  return typeof record.error === "string" ? record.error : null;
}

function isAllowedRole(value: string): value is AllowedRole {
  return (ALLOWED_ROLES as readonly string[]).includes(value);
}

function groupPermissions(perms: PermissionRow[]) {
  const map = new Map<string, Partial<Record<(typeof ACTIONS)[number], PermissionRow>>>();
  for (const p of perms) {
    const action = String(p.action);
    if (!(ACTIONS as readonly string[]).includes(action)) continue;
    if (!map.has(p.resource)) map.set(p.resource, {});
    map.get(p.resource)![action as (typeof ACTIONS)[number]] = p;
  }
  return map;
}

async function apiGet<T>(url: string): Promise<T> {
  const resp = await fetch(url, { cache: "no-store" });
  const json = (await resp.json().catch(() => null)) as unknown;
  if (!resp.ok) throw new Error(readApiError(json) || `Erro ${resp.status}`);
  return json as T;
}

async function apiPost<T>(url: string, body: unknown): Promise<T> {
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await resp.json().catch(() => null)) as unknown;
  if (!resp.ok) throw new Error(readApiError(json) || `Erro ${resp.status}`);
  return json as T;
}

async function apiPut<T>(url: string, body: unknown): Promise<T> {
  const resp = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await resp.json().catch(() => null)) as unknown;
  if (!resp.ok) throw new Error(readApiError(json) || `Erro ${resp.status}`);
  return json as T;
}

async function apiDelete<T>(url: string): Promise<T> {
  const resp = await fetch(url, { method: "DELETE" });
  const json = (await resp.json().catch(() => null)) as unknown;
  if (!resp.ok) throw new Error(readApiError(json) || `Erro ${resp.status}`);
  return json as T;
}

export function ConfiguracoesPermissoesClient() {
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [permissions, setPermissions] = useState<PermissionRow[]>([]);

  const [roleSelected, setRoleSelected] = useState<string>("");
  const [rolePermIds, setRolePermIds] = useState<Set<number>>(new Set());
  const isSuper = roleSelected === "admin-geral";

  const [statusMsg, setStatusMsg] = useState<string>("");
  const [statusTone, setStatusTone] = useState<Tone>("neutral");
  const [savingPerms, setSavingPerms] = useState(false);

  const [users, setUsers] = useState<UserRow[]>([]);
  const [userListMsg, setUserListMsg] = useState<string>("");
  const [userListTone, setUserListTone] = useState<Tone>("neutral");

  const [createNome, setCreateNome] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createSenha, setCreateSenha] = useState("");
  const [createRole, setCreateRole] = useState<AllowedRole | "">("");
  const [createMsg, setCreateMsg] = useState<string>("");
  const [createTone, setCreateTone] = useState<Tone>("neutral");
  const [creatingUser, setCreatingUser] = useState(false);

  const [editRoleByUserId, setEditRoleByUserId] = useState<Record<number, string>>({});
  const [editPassByUserId, setEditPassByUserId] = useState<Record<number, string>>({});
  const [savingUserId, setSavingUserId] = useState<number | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<number | null>(null);

  const grouped = useMemo(() => groupPermissions(permissions), [permissions]);
  const resources = useMemo(() => Array.from(grouped.keys()).sort((a, b) => a.localeCompare(b)), [grouped]);

  async function refreshUsers() {
    setUserListMsg("Carregando usuarios...");
    setUserListTone("neutral");
    try {
      const data = await apiGet<UserRow[]>("/api/users");
      setUsers(Array.isArray(data) ? data : []);
      setUserListMsg("");
    } catch (err) {
      setUsers([]);
      setUserListMsg(normalizeApiError(err));
      setUserListTone("error");
    }
  }

  async function refreshRolePermissions(roleName: string) {
    if (!roleName) {
      setRolePermIds(new Set());
      return;
    }
    try {
      const data = await apiGet<RolePermissionsResponse>(
        `/api/roles/${encodeURIComponent(roleName)}/permissions`
      );
      const ids = new Set<number>((data.permissions || []).map((p) => p.id));
      setRolePermIds(ids);
    } catch (err) {
      setRolePermIds(new Set());
      setStatusMsg(normalizeApiError(err));
      setStatusTone("error");
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [rolesResp, permsResp] = await Promise.all([
          apiGet<RoleRow[]>("/api/roles"),
          apiGet<PermissionRow[]>("/api/permissions"),
        ]);
        if (cancelled) return;
        const roleList = Array.isArray(rolesResp) ? rolesResp : [];
        const permList = Array.isArray(permsResp) ? permsResp : [];
        setRoles(roleList);
        setPermissions(permList);

        const first = roleList[0]?.nome || "";
        setRoleSelected(first);
      } catch (err) {
        if (cancelled) return;
        setStatusMsg(normalizeApiError(err));
        setStatusTone("error");
      }
    })();
    void refreshUsers();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setStatusMsg("");
    setStatusTone("neutral");
    void refreshRolePermissions(roleSelected);
  }, [roleSelected]);

  useEffect(() => {
    // Pre-fill edit role selects with current roles (so the table is usable immediately).
    const next: Record<number, string> = {};
    users.forEach((u) => {
      next[u.id] = String(u.role || "");
    });
    setEditRoleByUserId(next);
    setEditPassByUserId({});
  }, [users]);

  function togglePermission(permId: number, checked: boolean) {
    setRolePermIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(permId);
      else next.delete(permId);
      return next;
    });
  }

  async function savePermissions() {
    if (!roleSelected || isSuper) return;
    setSavingPerms(true);
    setStatusMsg("Salvando...");
    setStatusTone("neutral");
    try {
      await apiPost(`/api/roles/${encodeURIComponent(roleSelected)}/permissions`, {
        permissions: Array.from(rolePermIds.values()),
      });
      await refreshRolePermissions(roleSelected);
      setStatusMsg("Permissoes salvas com sucesso.");
      setStatusTone("success");
    } catch (err) {
      setStatusMsg(normalizeApiError(err));
      setStatusTone("error");
    } finally {
      setSavingPerms(false);
    }
  }

  async function createUser() {
    setCreateMsg("");
    setCreateTone("neutral");
    const nome = createNome.trim();
    const email = createEmail.trim();
    const senha = createSenha;
    const role = String(createRole).trim();
    if (!nome || !email || !senha || !role) {
      setCreateMsg("Preencha nome, e-mail, senha e papel.");
      setCreateTone("error");
      return;
    }
    if (!isAllowedRole(role)) {
      setCreateMsg("Papel invalido. Use admin, recepcao ou terapeuta.");
      setCreateTone("error");
      return;
    }

    setCreatingUser(true);
    setCreateMsg("Criando usuario...");
    setCreateTone("neutral");
    try {
      await apiPost("/api/users", { nome, email, senha, role });
      setCreateMsg("Usuario criado/atualizado com sucesso.");
      setCreateTone("success");
      setCreateNome("");
      setCreateEmail("");
      setCreateSenha("");
      setCreateRole("");
      await refreshUsers();
    } catch (err) {
      setCreateMsg(normalizeApiError(err));
      setCreateTone("error");
    } finally {
      setCreatingUser(false);
    }
  }

  async function saveUser(userId: number) {
    const user = users.find((u) => u.id === userId);
    if (!user) return;
    const nome = String(user.nome || "").trim();
    const email = String(user.email || "").trim();
    const role = String(editRoleByUserId[userId] || "").trim();
    const senha = String(editPassByUserId[userId] || "");
    if (!nome || !email || !role) {
      setUserListMsg("Nome, email e papel sao obrigatorios.");
      setUserListTone("error");
      return;
    }
    if (!isAllowedRole(role)) {
      setUserListMsg("Papel invalido para este sistema.");
      setUserListTone("error");
      return;
    }

    setSavingUserId(userId);
    setUserListMsg("Salvando usuario...");
    setUserListTone("neutral");
    try {
      await apiPut(`/api/users/${userId}`, { nome, email, role, senha: senha.trim() ? senha : undefined });
      setUserListMsg("Usuario atualizado.");
      setUserListTone("success");
      await refreshUsers();
    } catch (err) {
      setUserListMsg(normalizeApiError(err));
      setUserListTone("error");
    } finally {
      setSavingUserId(null);
    }
  }

  async function deleteUser(userId: number) {
    const user = users.find((u) => u.id === userId);
    if (!user) return;
    const ok = window.confirm(`Excluir usuario ${user.email}?`);
    if (!ok) return;

    setDeletingUserId(userId);
    setUserListMsg("Excluindo usuario...");
    setUserListTone("neutral");
    try {
      await apiDelete(`/api/users/${userId}`);
      setUserListMsg("Usuario excluido.");
      setUserListTone("success");
      await refreshUsers();
    } catch (err) {
      setUserListMsg(normalizeApiError(err));
      setUserListTone("error");
    } finally {
      setDeletingUserId(null);
    }
  }

  const selectableRoles = useMemo(() => {
    const list = roles
      .map((r) => r.nome)
      .filter((r): r is AllowedRole => isAllowedRole(r));
    const unique = Array.from(new Set(list));
    const fallback = Array.from(ALLOWED_ROLES);
    return unique.length ? unique : fallback;
  }, [roles]);

  return (
    <main className="space-y-6">
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-gray-500">Gestao de acesso</p>
            <h2 className="text-xl font-semibold text-[var(--marrom)]">Cadastrar novo usuario</h2>
            <p className="text-sm text-slate-600">
              Crie usuarios com papel admin, recepcao ou terapeuta.
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 text-sm md:grid-cols-2 lg:grid-cols-4">
          <label className="flex flex-col gap-1">
            <span className="font-semibold text-[var(--marrom)]">Nome completo</span>
            <input
              value={createNome}
              onChange={(e) => setCreateNome(e.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--laranja)]/40"
              placeholder="Ex.: Ana Souza"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="font-semibold text-[var(--marrom)]">E-mail</span>
            <input
              value={createEmail}
              onChange={(e) => setCreateEmail(e.target.value)}
              type="email"
              className="rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--laranja)]/40"
              placeholder="email@dominio.com"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="font-semibold text-[var(--marrom)]">Senha</span>
            <input
              value={createSenha}
              onChange={(e) => setCreateSenha(e.target.value)}
              type="password"
              minLength={8}
              className="rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--laranja)]/40"
              placeholder="Minimo 8 caracteres"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="font-semibold text-[var(--marrom)]">Papel</span>
            <select
              value={createRole}
              onChange={(e) => setCreateRole(isAllowedRole(e.target.value) ? e.target.value : "")}
              className="rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--laranja)]/40"
            >
              <option value="">Selecione...</option>
              {selectableRoles.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-center justify-between gap-3 lg:col-span-4">
            <p className={["text-sm", classForTone(createTone)].join(" ")}>{createMsg}</p>
            <button
              type="button"
              disabled={creatingUser}
              onClick={() => void createUser()}
              className="rounded-lg bg-[var(--laranja)] px-4 py-2 font-semibold text-white transition hover:bg-[#e6961f] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Criar usuario
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-gray-500">Usuarios existentes</p>
            <h2 className="text-xl font-semibold text-[var(--marrom)]">Gerenciar usuarios</h2>
            <p className="text-sm text-slate-600">Edite o papel, troque a senha ou exclua usuarios.</p>
          </div>
          <p className={["text-sm", classForTone(userListTone)].join(" ")}>{userListMsg}</p>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-[900px] w-full text-sm">
            <thead>
              <tr className="border-b text-left text-slate-600">
                <th className="px-2 py-2">Nome</th>
                <th className="px-2 py-2">E-mail</th>
                <th className="px-2 py-2">Papel</th>
                <th className="px-2 py-2">Nova senha (opcional)</th>
                <th className="px-2 py-2 text-center">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {users.length ? (
                users.map((u) => {
                  const busy = savingUserId === u.id || deletingUserId === u.id;
                  return (
                    <tr key={u.id}>
                      <td className="px-2 py-2 font-semibold text-[var(--marrom)]">{u.nome || "-"}</td>
                      <td className="px-2 py-2 text-slate-700">{u.email || "-"}</td>
                      <td className="px-2 py-2">
                        <select
                          value={editRoleByUserId[u.id] ?? ""}
                          onChange={(e) =>
                            setEditRoleByUserId((prev) => ({ ...prev, [u.id]: e.target.value }))
                          }
                          className="w-full rounded-lg border border-gray-200 px-2 py-1"
                        >
                          <option value="">Selecione...</option>
                          {selectableRoles.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="password"
                          minLength={8}
                          value={editPassByUserId[u.id] ?? ""}
                          onChange={(e) =>
                            setEditPassByUserId((prev) => ({ ...prev, [u.id]: e.target.value }))
                          }
                          className="w-full rounded-lg border border-gray-200 px-2 py-1"
                          placeholder="Deixar em branco para manter"
                        />
                      </td>
                      <td className="px-2 py-2 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void saveUser(u.id)}
                            className="inline-flex items-center justify-center rounded-md bg-[var(--laranja)] px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
                          >
                            Salvar
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void deleteUser(u.id)}
                            className="inline-flex items-center justify-center rounded-md border border-red-200 px-3 py-1 text-xs font-semibold text-red-700 disabled:opacity-50"
                          >
                            Excluir
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td className="px-2 py-3 text-slate-600" colSpan={5}>
                    Nenhum usuario encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <p className="text-sm font-semibold text-[var(--marrom)]">Selecione um papel</p>
            <select
              value={roleSelected}
              onChange={(e) => setRoleSelected(e.target.value)}
              className="mt-1 w-64 rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--laranja)]/40"
            >
              <option value="">Selecione um papel</option>
              {roles.map((r) => (
                <option key={r.nome} value={r.nome}>
                  {r.nome}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1 text-sm text-slate-500">
            {isSuper ? "Admin-geral tem todas as permissoes e nao pode ser restringido." : ""}
          </div>

          <button
            type="button"
            disabled={savingPerms || !roleSelected || isSuper}
            onClick={() => void savePermissions()}
            className="rounded-lg bg-[var(--laranja)] px-4 py-2 font-semibold text-white transition hover:bg-[#e6961f] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Salvar Permissoes
          </button>
        </div>

        <div className={["mt-3 text-sm", classForTone(statusTone)].join(" ")}>{statusMsg}</div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-[980px] w-full text-sm">
            <thead>
              <tr className="border-b text-left text-slate-600">
                <th className="py-2 pr-3">Recurso</th>
                {ACTIONS.map((action) => (
                  <th key={action} className="px-2 py-2 text-center">
                    {ACTION_LABEL[action]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {resources.map((resource) => {
                const row = grouped.get(resource) || {};
                return (
                  <tr key={resource} className="hover:bg-slate-50">
                    <td className="py-2 pr-3 font-semibold capitalize">{resource}</td>
                    {ACTIONS.map((action) => {
                      const perm = row[action];
                      if (!perm) {
                        return (
                          <td key={action} className="px-2 py-2 text-center text-slate-300">
                            -
                          </td>
                        );
                      }
                      const checked = isSuper || rolePermIds.has(perm.id);
                      return (
                        <td key={action} className="px-2 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={isSuper}
                            onChange={(e) => togglePermission(perm.id, e.target.checked)}
                            className="h-4 w-4 rounded border-slate-300 text-[var(--laranja)] focus:ring-[var(--laranja)]"
                          />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              {!resources.length ? (
                <tr>
                  <td className="py-3 text-slate-600" colSpan={1 + ACTIONS.length}>
                    Nenhuma permissao encontrada.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

