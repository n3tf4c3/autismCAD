import Link from "next/link";
import { requirePermission } from "@/server/auth/auth";
import { assertPacienteAccess } from "@/server/auth/paciente-access";
import { listarPacientes } from "@/server/modules/pacientes/pacientes.service";
import { toAppError } from "@/server/shared/errors";
import { PacienteFormClient } from "@/app/(protected)/pacientes/paciente-form.client";

type PacienteRow = Awaited<ReturnType<typeof listarPacientes>>[number];

export default async function EditarPacientePage(props: {
  params: Promise<{ id: string }>;
}) {
  const { user } = await requirePermission("pacientes:edit");
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

  const rows = (await listarPacientes({ id: pacienteId })) as PacienteRow[];
  const paciente = rows[0] ?? null;
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
            <p className="text-sm text-gray-500">Cadastro</p>
            <h1 className="text-2xl font-bold text-[var(--marrom)]">Editar paciente</h1>
            <p className="mt-1 text-sm text-gray-600">
              {paciente.nome} <span className="text-gray-500">#{paciente.id}</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/pacientes/${paciente.id}`}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              &larr; Voltar
            </Link>
          </div>
        </div>
      </section>

      <PacienteFormClient
        mode="edit"
        initial={{
          id: paciente.id,
          nome: paciente.nome,
          cpf: paciente.cpf,
          sexo: paciente.sexo,
          nascimento: paciente.nascimento,
          convenio: paciente.convenio,
          nomeMae: paciente.nomeMae,
          nomePai: paciente.nomePai,
          nomeResponsavel: paciente.nomeResponsavel,
          telefone: paciente.telefone,
          telefone2: paciente.telefone2,
          email: paciente.email,
          dataInicio: paciente.dataInicio,
          ativo: paciente.ativo,
          terapias: paciente.terapias,
          foto: paciente.foto ?? null,
          laudo: paciente.laudo ?? null,
          documento: paciente.documento ?? null,
        }}
      />
    </main>
  );
}
