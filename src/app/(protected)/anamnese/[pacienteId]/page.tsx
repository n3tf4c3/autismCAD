import { requirePermission } from "@/server/auth/auth";
import { assertPacienteAccess } from "@/server/auth/paciente-access";
import { toAppError } from "@/server/shared/errors";
import AnamnesePacienteClient from "./anamnese-paciente.client";

export default async function AnamnesePacientePage(props: {
  params: Promise<{ pacienteId: string }>;
}) {
  const { user } = await requirePermission("pacientes:view");
  const { pacienteId } = await props.params;
  const id = Number(pacienteId);

  if (!Number.isFinite(id) || id <= 0) {
    return (
      <main className="rounded-2xl bg-white p-6 shadow-sm">
        <p className="text-sm text-red-600">Paciente invalido.</p>
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

  return <AnamnesePacienteClient pacienteId={id} />;
}
