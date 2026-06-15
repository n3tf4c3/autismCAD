import { redirect } from "next/navigation";
import { getAuthSession } from "@/server/auth/session";
import { hasPermission, loadUserAccess } from "@/server/auth/access";
import { parseSessionUserId } from "@/server/auth/user-id";
import { isPolicyConsentRequired } from "@/server/modules/consent/consent.service";
import { SidebarClient } from "@/components/sidebar/sidebar.client";
import { TopbarClient } from "@/components/topbar.client";
import { ShellProvider } from "@/components/shell/shell-provider.client";

type ProtectedLayoutProps = {
  children: React.ReactNode;
};

function initialsFromName(name?: string | null): string {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const first = parts[0]?.[0] ?? "U";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] : "";
  return `${first}${last}`.toUpperCase();
}

export default async function ProtectedLayout({ children }: ProtectedLayoutProps) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = parseSessionUserId(session.user.id);

  // Gate de consentimento LGPD: quem não aceitou a versão vigente da política vai para a
  // tela de consentimento antes de acessar qualquer área protegida.
  if (await isPolicyConsentRequired(userId)) {
    redirect("/consentimento");
  }

  const userName = session.user.name || "Usuário";
  const initials = initialsFromName(userName);

  // Navegacao montada com permissoes efetivas frescas (achado 42): so exibe links
  // que o usuario realmente pode abrir, evitando divergencia entre UI e RBAC.
  const access = await loadUserAccess(userId);
  const canonicalRole = access.canonicalRole ?? access.role;
  const isResponsavel = canonicalRole === "RESPONSAVEL";
  const isAdminGeral = canonicalRole === "ADMIN_GERAL";
  const nav = {
    agenda: hasPermission(access, "consultas:view"),
    pacientes: hasPermission(access, "pacientes:view"),
    profissionais: hasPermission(access, "profissionais:view"),
    consultas: hasPermission(access, "consultas:view"),
    relatorios:
      hasPermission(access, "relatorios_clinicos:view") ||
      hasPermission(access, "relatorios_admin:view"),
    controle: isAdminGeral,
  };

  return (
    <ShellProvider>
      <div className="min-h-screen bg-[var(--cinza)] text-[var(--texto)]">
        <div className="min-h-screen flex">
          <SidebarClient
            isResponsavel={isResponsavel}
            isAdminGeral={isAdminGeral}
            nav={nav}
          />

          <div className="flex min-w-0 flex-1 flex-col md:ml-64">
            <TopbarClient
              userName={userName}
              userRole={session.user.role}
              initials={initials}
            />
            <div className="relative z-10 p-4 md:p-8">{children}</div>
          </div>
        </div>
      </div>
    </ShellProvider>
  );
}

