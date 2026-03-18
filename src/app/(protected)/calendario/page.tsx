import { requirePermission } from "@/server/auth/auth";
import { listarPacientes } from "@/server/modules/pacientes/pacientes.service";
import { listarTerapeutas } from "@/server/modules/terapeutas/terapeutas.service";
import { CalendarioClient } from "@/app/(protected)/calendario/calendario.client";

export const dynamic = "force-dynamic";

function normalizeDateParam(value?: string): string | undefined {
  const parsed = String(value ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(parsed)) return undefined;
  return parsed;
}

export default async function CalendarioPage(props: {
  searchParams: Promise<{ terapeutaId?: string; data?: string }>;
}) {
  await requirePermission("consultas:view");

  let terapeutas: Array<{ id: number; nome: string; especialidade?: string | null }> = [];
  try {
    await requirePermission("terapeutas:view");
    const terapeutasRows = await listarTerapeutas({});
    terapeutas = terapeutasRows.map((item) => ({
      id: item.id,
      nome: item.nome,
      especialidade: item.especialidade ?? null,
    }));
  } catch {
    terapeutas = [];
  }

  let pacientes: Array<{ id: number; nome: string }> = [];
  try {
    await requirePermission("pacientes:view");
    const pacientesRows = await listarPacientes({});
    pacientes = pacientesRows.map((item) => ({ id: item.id, nome: item.nome }));
  } catch {
    pacientes = [];
  }

  const searchParams = await props.searchParams;
  const terapeutaParam = String(searchParams.terapeutaId ?? "").trim();
  const hasTherapistInList =
    terapeutaParam &&
    terapeutas.some((terapeuta) => String(terapeuta.id) === terapeutaParam);

  const initialTerapeutaId = hasTherapistInList
    ? terapeutaParam
    : terapeutas.length === 1
      ? String(terapeutas[0]?.id ?? "")
      : "";

  return (
    <CalendarioClient
      initialTerapeutas={terapeutas}
      initialPacientes={pacientes}
      initialTerapeutaId={initialTerapeutaId || undefined}
      initialData={normalizeDateParam(searchParams.data)}
    />
  );
}
