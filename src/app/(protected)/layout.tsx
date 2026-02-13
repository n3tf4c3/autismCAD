import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/logout-button";
import { getAuthSession } from "@/server/auth/session";

type ProtectedLayoutProps = {
  children: React.ReactNode;
};

const navItems = [
  { href: "/", label: "Dashboard" },
  { href: "/pacientes", label: "Pacientes" },
  { href: "/terapeutas", label: "Terapeutas" },
  { href: "/consultas", label: "Consultas" },
  { href: "/calendario", label: "Calendario" },
  { href: "/anamnese", label: "Anamnese" },
  { href: "/prontuario", label: "Prontuario" },
];

export default async function ProtectedLayout({ children }: ProtectedLayoutProps) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-[var(--cinza)] text-[var(--texto)]">
      <div className="mx-auto flex max-w-7xl gap-4 px-4 py-4 lg:px-6">
        <aside className="hidden w-64 shrink-0 rounded-2xl bg-white p-4 shadow-sm md:block">
          <div className="mb-5 border-b border-amber-100 pb-4">
            <p className="text-lg font-bold text-[var(--marrom)]">Clinica Girassois</p>
            <p className="mt-1 text-xs text-gray-500">Sistema Clinico</p>
          </div>
          <nav className="space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block rounded-lg px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-amber-50 hover:text-[var(--marrom)]"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        <div className="flex-1">
          <header className="mb-4 rounded-2xl bg-white px-5 py-3 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Logado como</p>
                <p className="font-semibold text-[var(--marrom)]">
                  {session.user.name} ({session.user.role})
                </p>
              </div>
              <LogoutButton />
            </div>
          </header>
          {children}
        </div>
      </div>
    </div>
  );
}
