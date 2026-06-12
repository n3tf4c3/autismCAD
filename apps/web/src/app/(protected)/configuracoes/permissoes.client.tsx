"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  createUserAction,
  deleteUserAction,
  getRolePermissionsAction,
  listPacientesForConfigAction,
  listPermissionsAction,
  listProfissionaisForConfigAction,
  listRolesAction,
  listUsersAction,
  updateRolePermissionsAction,
  updateUserAction,
  type ActionResult,
} from "@/app/(protected)/configuracoes/permissoes.actions";

type RoleRow = { slug: string; nome: string };
type PermissionRow = { id: number; resource: string; action: string };

type UserRow = {
  id: number;
  nome: string | null;
  email: string;
  role: string | null;
  pacienteIdVinculado?: number | null;
  pacienteNomeVinculado?: string | null;
  pacienteIdsVinculados?: number[];
  pacientesVinculados?: Array<{ id: number; nome: string | null }>;
  profissionalIdVinculado?: number | null;
  profissionalNomeVinculado?: string | null;
  createdAt?: string | Date | null;
};

type PacienteOption = {
  id: number;
  nome: string | null;
};

type Tone = "neutral" | "success" | "error";

// Ordem preferida das colunas; acoes desconhecidas entram no fim (matriz dinamica).
const ACTION_ORDER = [
  "view",
  "create",
  "edit",
  "edit_self",
  "delete",
  "cancel",
  "presence",
  "version",
  "finalize",
  "export",
  "pdf",
  "manage",
] as const;
const ACTION_LABEL: Record<string, string> = {
  view: "Ver",
  create: "Criar",
  edit: "Editar",
  edit_self: "Editar próprio",
  delete: "Excluir",
  cancel: "Cancelar",
  presence: "Presença",
  version: "Versionar",
  finalize: "Finalizar",
  export: "Exportar",
  pdf: "PDF",
  manage: "Gerenciar",
};

function actionLabel(action: string): string {
  return ACTION_LABEL[action] ?? action;
}

const ALLOWED_ROLES = ["admin-geral", "admin", "recepcao", "profissional", "responsavel"] as const;
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

function isAllowedRole(value: string): value is AllowedRole {
  return (ALLOWED_ROLES as readonly string[]).includes(value);
}

function groupPermissions(perms: PermissionRow[]) {
  const map = new Map<string, Record<string, PermissionRow>>();
  for (const p of perms) {
    const action = String(p.action);
    if (!map.has(p.resource)) map.set(p.resource, {});
    map.get(p.resource)![action] = p;
  }
  return map;
}

function sortActions(actions: Iterable<string>): string[] {
  const order = ACTION_ORDER as readonly string[];
  return Array.from(new Set(actions)).sort((a, b) => {
    const ia = order.indexOf(a);
    const ib = order.indexOf(b);
    const ra = ia === -1 ? order.length : ia;
    const rb = ib === -1 ? order.length : ib;
    return ra - rb || a.localeCompare(b);
  });
}

function unwrapAction<T>(result: ActionResult<T>): T {
  if (!result.ok) {
    throw new Error(result.error || "Erro inesperado");
  }
  return result.data;
}

export function ConfiguracoesPermissoesClient() {
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [permissions, setPermissions] = useState<PermissionRow[]>([]);

  const [roleSelected, setRoleSelected] = useState<string>("");
  const [rolePermIds, setRolePermIds] = useState<Set<number>>(new Set());
  const isSuper = roleSelected === "admin-geral";
  const isProtectedRole = roleSelected === "admin-geral" || roleSelected === "admin";

  const [statusMsg, setStatusMsg] = useState<string>("");
  const [statusTone, setStatusTone] = useState<Tone>("neutral");
  const [savingPerms, setSavingPerms] = useState(false);

  const [users, setUsers] = useState<UserRow[]>([]);
  const [pacientes, setPacientes] = useState<PacienteOption[]>([]);
  const [pacientesLoaded, setPacientesLoaded] = useState(false);
  const [pacientesLoading, setPacientesLoading] = useState(false);
  const [pacientesError, setPacientesError] = useState("");
  const [profissionais, setProfissionais] = useState<PacienteOption[]>([]);
  const [profissionaisLoaded, setProfissionaisLoaded] = useState(false);
  const [profissionaisLoading, setProfissionaisLoading] = useState(false);
  const [profissionaisError, setProfissionaisError] = useState("");
  const [userListMsg, setUserListMsg] = useState<string>("");
  const [userListTone, setUserListTone] = useState<Tone>("neutral");

  const [createNome, setCreateNome] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createSenha, setCreateSenha] = useState("");
  const [createRole, setCreateRole] = useState<AllowedRole | "">("");
  const [createPacienteIds, setCreatePacienteIds] = useState<string[]>([]);
  const [createProfissionalId, setCreateProfissionalId] = useState("");
  const [createMsg, setCreateMsg] = useState<string>("");
  const [createTone, setCreateTone] = useState<Tone>("neutral");
  const [creatingUser, setCreatingUser] = useState(false);

  const [editRoleByUserId, setEditRoleByUserId] = useState<Record<number, string>>({});
  const [editPacienteIdsByUserId, setEditPacienteIdsByUserId] = useState<Record<number, string[]>>({});
  const [editProfissionalIdByUserId, setEditProfissionalIdByUserId] = useState<Record<number, string>>({});
  const [editPassByUserId, setEditPassByUserId] = useState<Record<number, string>>({});
  const [savingUserId, setSavingUserId] = useState<number | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<number | null>(null);
  const pacientesLoadRequestedRef = useRef(false);
  const profissionaisLoadRequestedRef = useRef(false);

  const grouped = useMemo(() => groupPermissions(permissions), [permissions]);
  const resources = useMemo(() => Array.from(grouped.keys()).sort((a, b) => a.localeCompare(b)), [grouped]);
  const actionColumns = useMemo(
    () => sortActions(permissions.map((p) => String(p.action))),
    [permissions]
  );

  async function refreshUsers() {
    setUserListMsg("Carregando usuarios...");
    setUserListTone("neutral");
    try {
      const data = unwrapAction(await listUsersAction());
      setUsers(Array.isArray(data) ? data : []);
      setUserListMsg("");
    } catch (err) {
      setUsers([]);
      setUserListMsg(normalizeApiError(err));
      setUserListTone("error");
    }
  }

  async function ensurePacientesLoaded() {
    if (pacientesLoaded || pacientesLoading || pacientesLoadRequestedRef.current) return;
    pacientesLoadRequestedRef.current = true;
    setPacientesLoading(true);
    setPacientesError("");
    try {
      const data = unwrapAction(await listPacientesForConfigAction());
      setPacientes(Array.isArray(data) ? data : []);
      setPacientesLoaded(true);
    } catch (err) {
      setPacientes([]);
      setPacientesError(normalizeApiError(err));
    } finally {
      setPacientesLoading(false);
      pacientesLoadRequestedRef.current = false;
    }
  }

  async function ensureProfissionaisLoaded() {
    if (profissionaisLoaded || profissionaisLoading || profissionaisLoadRequestedRef.current) return;
    profissionaisLoadRequestedRef.current = true;
    setProfissionaisLoading(true);
    setProfissionaisError("");
    try {
      const data = unwrapAction(await listProfissionaisForConfigAction());
      setProfissionais(Array.isArray(data) ? data : []);
      setProfissionaisLoaded(true);
    } catch (err) {
      setProfissionais([]);
      setProfissionaisError(normalizeApiError(err));
    } finally {
      setProfissionaisLoading(false);
      profissionaisLoadRequestedRef.current = false;
    }
  }

  async function refreshRolePermissions(roleName: string) {
    if (!roleName) {
      setRolePermIds(new Set());
      return;
    }
    try {
      const data = unwrapAction(await getRolePermissionsAction(roleName));
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
          listRolesAction(),
          listPermissionsAction(),
        ]);
        if (cancelled) return;
        const roleList = unwrapAction(rolesResp);
        const permList = unwrapAction(permsResp);
        setRoles(roleList);
        setPermissions(permList);

        const first = roleList[0]?.slug || "";
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
    // Pre-fill edit selects with current values (so the table is usable immediately).
    const nextRole: Record<number, string> = {};
    const nextPacientes: Record<number, string[]> = {};
    const nextProfissional: Record<number, string> = {};
    users.forEach((u) => {
      nextRole[u.id] = String(u.role || "");
      const ids = Array.isArray(u.pacienteIdsVinculados)
        ? u.pacienteIdsVinculados
        : u.pacienteIdVinculado
          ? [u.pacienteIdVinculado]
          : [];
      nextPacientes[u.id] = ids.map((id) => String(id));
      nextProfissional[u.id] = u.profissionalIdVinculado ? String(u.profissionalIdVinculado) : "";
    });
    setEditRoleByUserId(nextRole);
    setEditPacienteIdsByUserId(nextPacientes);
    setEditProfissionalIdByUserId(nextProfissional);
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
    if (!roleSelected || isProtectedRole) return;
    setSavingPerms(true);
    setStatusMsg("Salvando...");
    setStatusTone("neutral");
    try {
      unwrapAction(
        await updateRolePermissionsAction(roleSelected, {
          permissions: Array.from(rolePermIds.values()),
        })
      );
      await refreshRolePermissions(roleSelected);
      setStatusMsg("Permissões salvas com sucesso.");
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
      setCreateMsg("Papel inválido. Use admin, recepcao, profissional ou responsavel.");
      setCreateTone("error");
      return;
    }
    const pacienteIdsVinculados = createPacienteIds
      .map((value) => Number(value))
      .filter((id) => Number.isFinite(id) && id > 0);
    if (role === "responsavel" && !pacienteIdsVinculados.length) {
      setCreateMsg("Para responsavel, selecione ao menos um paciente vinculado.");
      setCreateTone("error");
      return;
    }
    const profissionalIdRaw = createProfissionalId.trim();
    const profissionalId = role === "profissional" && profissionalIdRaw ? Number(profissionalIdRaw) : null;

    setCreatingUser(true);
    setCreateMsg("Criando usuario...");
    setCreateTone("neutral");
    try {
      unwrapAction(
        await createUserAction({ nome, email, senha, role, pacienteIdsVinculados, profissionalId })
      );
      setCreateMsg("Usuário criado/atualizado com sucesso.");
      setCreateTone("success");
      setCreateNome("");
      setCreateEmail("");
      setCreateSenha("");
      setCreateRole("");
      setCreatePacienteIds([]);
      setCreateProfissionalId("");
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
    const pacienteIdsVinculados = (editPacienteIdsByUserId[userId] ?? [])
      .map((value) => Number(value))
      .filter((id) => Number.isFinite(id) && id > 0);
    const profissionalIdRaw = String(editProfissionalIdByUserId[userId] || "").trim();
    const senha = String(editPassByUserId[userId] || "");
    if (!nome || !email || !role) {
      setUserListMsg("Nome, email e papel sao obrigatorios.");
      setUserListTone("error");
      return;
    }
    if (!isAllowedRole(role)) {
      setUserListMsg("Papel inválido para este sistema.");
      setUserListTone("error");
      return;
    }
    if (role === "responsavel" && !pacienteIdsVinculados.length) {
      setUserListMsg("Usuário responsavel precisa de ao menos um paciente vinculado.");
      setUserListTone("error");
      return;
    }

    setSavingUserId(userId);
    setUserListMsg("Salvando usuario...");
    setUserListTone("neutral");
    try {
      unwrapAction(
        await updateUserAction(userId, {
          nome,
          email,
          role,
          senha: senha.trim() ? senha : undefined,
          pacienteIdsVinculados,
          profissionalId:
            role === "profissional" ? (profissionalIdRaw ? Number(profissionalIdRaw) : null) : null,
        })
      );
      setUserListMsg("Usuário atualizado.");
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
      unwrapAction(await deleteUserAction(userId));
      setUserListMsg("Usuário excluido.");
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

  const pacientesById = useMemo(() => {
    const map = new Map<string, PacienteOption>();
    pacientes.forEach((p) => map.set(String(p.id), p));
    return map;
  }, [pacientes]);

  return (
    <main className="space-y-6">
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-gray-500">Gestao de acesso</p>
            <h2 className="text-xl font-semibold text-[var(--marrom)]">Cadastrar novo usuario</h2>
            <p className="text-sm text-slate-600">
              Crie usuarios com papel admin, recepcao, profissional ou responsavel.
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 text-sm md:grid-cols-2 lg:grid-cols-5">
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

          <label className="flex flex-col gap-1">
            <span className="font-semibold text-[var(--marrom)]">
              {createRole === "profissional" ? "Profissional vinculado" : "Pacientes vinculados"}
            </span>
            {createRole === "profissional" ? (
              <>
                <select
                  value={createProfissionalId}
                  onChange={(e) => setCreateProfissionalId(e.target.value)}
                  onFocus={() => void ensureProfissionaisLoaded()}
                  className="rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--laranja)]/40"
                >
                  <option value="">
                    {profissionaisLoading
                      ? "Carregando profissionais..."
                      : !profissionaisLoaded
                        ? "Clique para carregar profissionais"
                        : profissionais.length
                          ? "Selecione..."
                          : "Nenhum profissional disponivel"}
                  </option>
                  {profissionais.map((p) => (
                    <option key={p.id} value={String(p.id)}>
                      {(p.nome || "Sem nome").trim()} (#{p.id})
                    </option>
                  ))}
                </select>
                {profissionaisError ? (
                  <span className="text-xs text-red-600">{profissionaisError}</span>
                ) : null}
              </>
            ) : (
              <>
                <select
                  multiple
                  value={createPacienteIds}
                  onChange={(e) =>
                    setCreatePacienteIds(
                      Array.from(e.target.selectedOptions).map((option) => option.value)
                    )
                  }
                  onFocus={() => void ensurePacientesLoaded()}
                  disabled={createRole !== "responsavel"}
                  className="min-h-[42px] rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--laranja)]/40 disabled:bg-gray-100 disabled:text-gray-400"
                >
                  {createRole !== "responsavel" ? (
                    <option value="" disabled>
                      Somente responsavel
                    </option>
                  ) : pacientesLoading ? (
                    <option value="" disabled>
                      Carregando pacientes...
                    </option>
                  ) : !pacientesLoaded ? (
                    <option value="" disabled>
                      Clique para carregar pacientes
                    </option>
                  ) : !pacientes.length ? (
                    <option value="" disabled>
                      Nenhum paciente disponivel
                    </option>
                  ) : null}
                  {pacientes.map((p) => (
                    <option key={p.id} value={String(p.id)}>
                      {(p.nome || "Sem nome").trim()} (#{p.id})
                    </option>
                  ))}
                </select>
                {createRole === "responsavel" && pacientesError ? (
                  <span className="text-xs text-red-600">{pacientesError}</span>
                ) : null}
              </>
            )}
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
          <table className="min-w-[1040px] w-full text-sm">
            <thead>
              <tr className="border-b text-left text-slate-600">
                <th className="px-2 py-2">Nome</th>
                <th className="px-2 py-2">E-mail</th>
                <th className="px-2 py-2">Papel</th>
                <th className="px-2 py-2">Vinculo (paciente/profissional)</th>
                <th className="px-2 py-2">Nova senha (opcional)</th>
                <th className="px-2 py-2 text-center">Ações</th>
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
                        {(() => {
                          const roleAtual = String(editRoleByUserId[u.id] || "");
                          if (roleAtual === "profissional") {
                            const selectedProfissionalId = editProfissionalIdByUserId[u.id] ?? "";
                            const selectedMissing =
                              selectedProfissionalId &&
                              !profissionais.some((p) => String(p.id) === selectedProfissionalId);
                            return (
                              <select
                                value={selectedProfissionalId}
                                onChange={(e) =>
                                  setEditProfissionalIdByUserId((prev) => ({
                                    ...prev,
                                    [u.id]: e.target.value,
                                  }))
                                }
                                onFocus={() => void ensureProfissionaisLoaded()}
                                className="w-full rounded-lg border border-gray-200 px-2 py-1"
                              >
                                <option value="">
                                  {profissionaisLoading
                                    ? "Carregando profissionais..."
                                    : !profissionaisLoaded
                                      ? "Clique para carregar profissionais"
                                      : "Sem vinculo"}
                                </option>
                                {selectedMissing ? (
                                  <option value={selectedProfissionalId}>
                                    {(u.profissionalNomeVinculado || "Profissional vinculado").trim()} (#
                                    {selectedProfissionalId})
                                  </option>
                                ) : null}
                                {profissionais.map((p) => (
                                  <option key={p.id} value={String(p.id)}>
                                    {(p.nome || "Sem nome").trim()} (#{p.id})
                                  </option>
                                ))}
                              </select>
                            );
                          }

                          const selectedPacienteIds = editPacienteIdsByUserId[u.id] ?? [];
                          const isResponsavel = roleAtual === "responsavel";
                          const missingIds = selectedPacienteIds.filter(
                            (id) => !pacientesById.has(id)
                          );
                          if (!isResponsavel) {
                            return <span className="text-xs text-gray-400">Nao se aplica</span>;
                          }
                          return (
                            <select
                              multiple
                              value={selectedPacienteIds}
                              onChange={(e) =>
                                setEditPacienteIdsByUserId((prev) => ({
                                  ...prev,
                                  [u.id]: Array.from(e.target.selectedOptions).map(
                                    (option) => option.value
                                  ),
                                }))
                              }
                              onFocus={() => void ensurePacientesLoaded()}
                              className="min-h-[42px] w-full rounded-lg border border-gray-200 px-2 py-1"
                            >
                              {pacientesLoading ? (
                                <option value="" disabled>
                                  Carregando pacientes...
                                </option>
                              ) : !pacientesLoaded && !missingIds.length ? (
                                <option value="" disabled>
                                  Clique para carregar pacientes
                                </option>
                              ) : null}
                              {missingIds.map((id) => {
                                const vinculo = (u.pacientesVinculados ?? []).find(
                                  (item) => String(item.id) === id
                                );
                                return (
                                  <option key={`missing-${id}`} value={id}>
                                    {(vinculo?.nome || "Paciente vinculado").trim()} (#{id})
                                  </option>
                                );
                              })}
                              {pacientes.map((p) => (
                                <option key={p.id} value={String(p.id)}>
                                  {(p.nome || "Sem nome").trim()} (#{p.id})
                                </option>
                              ))}
                            </select>
                          );
                        })()}
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
                  <td className="px-2 py-3 text-slate-600" colSpan={6}>
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
                <option key={r.slug} value={r.slug}>
                  {r.nome}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1 text-sm text-slate-500">
            {isProtectedRole
              ? "Roles admin e admin-geral sao protegidos e nao podem ser alterados por esta tela."
              : ""}
          </div>

          <button
            type="button"
            disabled={savingPerms || !roleSelected || isProtectedRole}
            onClick={() => void savePermissions()}
            className="rounded-lg bg-[var(--laranja)] px-4 py-2 font-semibold text-white transition hover:bg-[#e6961f] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Salvar Permissões
          </button>
        </div>

        <div className={["mt-3 text-sm", classForTone(statusTone)].join(" ")}>{statusMsg}</div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-[980px] w-full text-sm">
            <thead>
              <tr className="border-b text-left text-slate-600">
                <th className="py-2 pr-3">Recurso</th>
                {actionColumns.map((action) => (
                  <th key={action} className="px-2 py-2 text-center">
                    {actionLabel(action)}
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
                    {actionColumns.map((action) => {
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
                            disabled={isProtectedRole}
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
                  <td className="py-3 text-slate-600" colSpan={1 + actionColumns.length}>
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



