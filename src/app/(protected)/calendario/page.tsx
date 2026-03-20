import { requirePermission } from "@/server/auth/auth";
import { listarPacientes } from "@/server/modules/pacientes/pacientes.service";
import { listarProfissionais } from "@/server/modules/profissionais/profissionais.service";
import { CalendarioClient } from "@/app/(protected)/calendario/calendario.client";

export const dynamic = "force-dynamic";

function normalizeDateParam(value?: string): string | undefined {
  const parsed = String(value ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(parsed)) return undefined;
  return parsed;
}

export default async function CalendarioPage(props: {
  searchParams: Promise<{ profissionalId?: string; data?: string }>;
}) {
  await requirePermission("consultas:view");

  let profissionais: Array<{ id: number; nome: string; especialidade?: string | null }> = [];
  try {
    await requirePermission("profissionais:view");
    const profissionaisRows = await listarProfissionais({});
    profissionais = profissionaisRows.map((item) => ({
      id: item.id,
      nome: item.nome,
      especialidade: item.especialidade ?? null,
    }));
  } catch {
    profissionais = [];
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
  const profissionalParam = String(searchParams.profissionalId ?? "").trim();
  const hasProfissionalInList =
    profissionalParam &&
    profissionais.some((profissional) => String(profissional.id) === profissionalParam);

  const initialProfissionalId = hasProfissionalInList
    ? profissionalParam
    : profissionais.length === 1
      ? String(profissionais[0]?.id ?? "")
      : "";

  return (
    <CalendarioClient
      initialProfissionais={profissionais}
      initialPacientes={pacientes}
      initialProfissionalId={initialProfissionalId || undefined}
      initialData={normalizeDateParam(searchParams.data)}
    />
  );
}
