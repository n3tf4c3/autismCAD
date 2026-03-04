import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePermission } from "@/server/auth/auth";
import { canonicalRoleName } from "@/server/auth/permissions";
import { getPacienteVinculadoByUserId } from "@/server/modules/pacientes/paciente-vinculos.service";
import { DevolutivaDiaClient } from "@/app/(protected)/relatorios/devolutiva-dia/devolutiva-dia.client";

export default async function RelatorioDevolutivaDiaPage() {
  const { user } = await requirePermission("relatorios_clinicos:view");
  const roleCanon = canonicalRoleName(user.role ?? null) ?? user.role ?? null;
  const isResponsavel = roleCanon === "RESPONSAVEL";

  if (!isResponsavel) {
    redirect("/relatorios");
  }

  const pacienteVinculado = await getPacienteVinculadoByUserId(Number(user.id));

  return (
    <div className="space-y-4">
      <section className="rounded-xl bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-gray-500">Acompanhamento</p>
            <h2 className="text-xl font-semibold text-[var(--marrom)]">Devolutiva diaria</h2>
          </div>
          <Link href="/relatorios" className="text-sm font-semibold text-[var(--laranja)]">
            &larr; Voltar
          </Link>
        </div>
      </section>

      {!pacienteVinculado ? (
        <section className="rounded-xl bg-white p-6 shadow-sm">
          <p className="text-sm text-red-600">
            Seu perfil ainda nao possui paciente vinculado. Solicite ao administrador.
          </p>
        </section>
      ) : (
        <DevolutivaDiaClient pacienteId={pacienteVinculado.id} pacienteNome={pacienteVinculado.nome} />
      )}
    </div>
  );
}

