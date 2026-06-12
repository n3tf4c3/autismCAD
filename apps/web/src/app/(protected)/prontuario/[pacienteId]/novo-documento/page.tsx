import { redirect } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { pacientes } from "@/server/db/schema";
import { requirePermission } from "@/server/auth/auth";
import { assertPacienteAccess } from "@/server/auth/paciente-access";
import { toAppError } from "@/server/shared/errors";

export default async function NovoDocumentoPage(props: {
  params: Promise<{ pacienteId: string }>;
}) {
  const { user } = await requirePermission("prontuario:create");
  const { pacienteId } = await props.params;
  const id = Number(pacienteId);
  if (!id) {
    return (
      <main className="rounded-2xl bg-white p-6 shadow-sm">
        <p className="text-sm text-red-600">Paciente inválido.</p>
      </main>
    );
  }

  try {
    await assertPacienteAccess(user, id);
  } catch (error) {
    const err = toAppError(error);
    return (
      <main className="rounded-2xl bg-white p-6 shadow-sm">
        <p className="text-sm text-red-600">{err.message}</p>
      </main>
    );
  }

  const [paciente] = await db
    .select({ id: pacientes.id, nome: pacientes.nome })
    .from(pacientes)
    .where(and(eq(pacientes.id, id), isNull(pacientes.deletedAt)))
    .limit(1);

  if (!paciente) {
    return (
      <main className="rounded-2xl bg-white p-6 shadow-sm">
        <p className="text-sm text-red-600">Paciente não encontrado.</p>
      </main>
    );
  }

  redirect(`/prontuario/${paciente.id}`);
}


