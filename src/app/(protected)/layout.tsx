import { redirect } from "next/navigation";
import { getAuthSession } from "@/server/auth/session";
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

  const userName = session.user.name || "Usuario";
  const initials = initialsFromName(userName);

  return (
    <ShellProvider>
      <div className="min-h-screen bg-[var(--cinza)] text-[var(--texto)]">
        <div className="min-h-screen flex">
          <SidebarClient />

          <div className="flex min-w-0 flex-1 flex-col md:ml-64">
            <TopbarClient
              userName={userName}
              userRole={session.user.role}
              initials={initials}
            />
            <div className="p-4 md:p-8">{children}</div>
          </div>
        </div>
      </div>
    </ShellProvider>
  );
}
