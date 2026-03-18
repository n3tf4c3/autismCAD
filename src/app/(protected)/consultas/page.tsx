import { requirePermission } from "@/server/auth/auth";
import { listarPacientes } from "@/server/modules/pacientes/pacientes.service";
import { listarTerapeutas } from "@/server/modules/terapeutas/terapeutas.service";
import { ConsultasClient } from "@/app/(protected)/consultas/consultas.client";

export default async function ConsultasPage() {
  await requirePermission("consultas:view");

  let terapeutas: Array<{ id: number; nome: string }> = [];
  try {
    await requirePermission("terapeutas:view");
    const terapeutasRows = await listarTerapeutas({});
    terapeutas = terapeutasRows.map((item) => ({ id: item.id, nome: item.nome }));
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

  return <ConsultasClient initialTerapeutas={terapeutas} initialPacientes={pacientes} />;
}
