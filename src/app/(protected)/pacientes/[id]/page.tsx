import Link from "next/link";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { pacientes } from "@/server/db/schema";
import { requirePermission } from "@/server/auth/auth";
import { assertPacienteAccess } from "@/server/auth/paciente-access";
import { toAppError } from "@/server/shared/errors";
import { PacienteArquivosClient } from "@/app/(protected)/pacientes/[id]/arquivos.client";

export default async function PacienteDetalhePage(props: {
  params: Promise<{ id: string }>;
}) {
  const { user } = await requirePermission("pacientes:view");
  const { id } = await props.params;
  const pacienteId = Number(id);
  if (!pacienteId) {
    return (
      <main className="rounded-2xl bg-white p-6 shadow-sm">
        <p className="text-sm text-red-600">Paciente invalido.</p>
      </main>
    );
  }

  try {
    await assertPacienteAccess(user, pacienteId);
  } catch (error) {
    const err = toAppError(error);
    return (
      <main className="rounded-2xl bg-white p-6 shadow-sm">
        <p className="text-sm text-red-600">{err.message}</p>
      </main>
    );
  }

  const [paciente] = await db
    .select({
      id: pacientes.id,
      nome: pacientes.nome,
      cpf: pacientes.cpf,
      convenio: pacientes.convenio,
      email: pacientes.email,
      telefone: pacientes.telefone,
      foto: pacientes.foto,
      laudo: pacientes.laudo,
      documento: pacientes.documento,
    })
    .from(pacientes)
    .where(and(eq(pacientes.id, pacienteId), isNull(pacientes.deletedAt)))
    .limit(1);

  if (!paciente) {
    return (
      <main className="rounded-2xl bg-white p-6 shadow-sm">
        <p className="text-sm text-red-600">Paciente nao encontrado.</p>
      </main>
    );
  }

  return (
    <main className="space-y-4">
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-gray-500">Consulta</p>
            <h1 className="text-2xl font-bold text-[var(--marrom)]">
              {paciente.nome} <span className="text-gray-500">#{paciente.id}</span>
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              CPF: <span className="font-medium">{paciente.cpf}</span> • Convenio:{" "}
              <span className="font-medium">{paciente.convenio || "Particular"}</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/pacientes"
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              &larr; Voltar
            </Link>
            <Link
              href={`/prontuario/${paciente.id}`}
              className="rounded-lg bg-[var(--laranja)] px-4 py-2 text-sm font-semibold text-white hover:bg-[#e6961f]"
            >
              Abrir prontuario
            </Link>
          </div>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-[var(--marrom)]">Contato</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
            <p className="text-xs uppercase tracking-wide text-gray-500">E-mail</p>
            <p className="mt-1 text-sm font-semibold text-[var(--texto)]">{paciente.email || "-"}</p>
          </div>
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
            <p className="text-xs uppercase tracking-wide text-gray-500">Telefone</p>
            <p className="mt-1 text-sm font-semibold text-[var(--texto)]">{paciente.telefone || "-"}</p>
          </div>
        </div>
      </section>

      <PacienteArquivosClient
        pacienteId={paciente.id}
        existing={{
          foto: paciente.foto,
          laudo: paciente.laudo,
          documento: paciente.documento,
        }}
      />
    </main>
  );
}

