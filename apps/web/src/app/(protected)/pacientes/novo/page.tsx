import Link from "next/link";
import { requirePermission } from "@/server/auth/auth";
import { PacienteFormClient } from "@/app/(protected)/pacientes/paciente-form.client";

export default async function NovoPacientePage() {
  await requirePermission("pacientes:create");

  return (
    <main className="space-y-4">
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-gray-500">Cadastro</p>
            <h1 className="text-2xl font-bold text-[var(--marrom)]">Novo paciente</h1>
          </div>
          <Link href="/pacientes" className="text-sm font-semibold text-[var(--laranja)]">
            &larr; Voltar
          </Link>
        </div>
      </section>

      <PacienteFormClient mode="create" />
    </main>
  );
}

