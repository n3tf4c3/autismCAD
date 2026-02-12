import { redirect } from "next/navigation";
import { getAuthSession } from "@/server/auth/session";
import { LogoutButton } from "@/components/logout-button";

export default async function Home() {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-[var(--cinza)] px-6 py-10">
      <div className="mx-auto max-w-5xl rounded-2xl bg-white p-8 shadow-sm">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-[var(--marrom)]">Painel Principal</h1>
            <p className="mt-2 text-sm text-gray-600">
              Logado como {session.user.name} ({session.user.role})
            </p>
          </div>
          <LogoutButton />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
            <p className="text-sm font-semibold text-[var(--marrom)]">Pacientes</p>
            <p className="mt-1 text-xs text-gray-600">Modulo em migracao</p>
          </div>
          <div className="rounded-xl border border-orange-100 bg-orange-50 p-4">
            <p className="text-sm font-semibold text-[var(--marrom)]">Agenda</p>
            <p className="mt-1 text-xs text-gray-600">Modulo em migracao</p>
          </div>
          <div className="rounded-xl border border-yellow-100 bg-yellow-50 p-4">
            <p className="text-sm font-semibold text-[var(--marrom)]">Prontuario</p>
            <p className="mt-1 text-xs text-gray-600">Modulo em migracao</p>
          </div>
        </div>
      </div>
    </main>
  );
}
