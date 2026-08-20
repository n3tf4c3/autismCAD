import { requirePermission } from "@/server/auth/auth";
import { hasPermission } from "@/server/auth/access";
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
  const { access } = await requirePermission("consultas:view");

  // A agenda e somente leitura para atendimento: marcar consulta acontece na tela
  // do paciente. Aqui sobra o bloqueio de horario, que usa a mesma permissao.
  let canBloquearHorario = false;
  try {
    await requirePermission("consultas:create");
    canBloquearHorario = true;
  } catch {
    canBloquearHorario = false;
  }

  // Desbloquear remove bloqueio (consultas:cancel), permissao distinta de criar (achado 43).
  const canDeleteBloqueio = hasPermission(access, "consultas:cancel");

  let profissionais: Array<{ id: number; nome: string; especialidade?: string | null }> = [];
  try {
    await requirePermission("profissionais:view");
    const profissionaisRows = await listarProfissionais({ somenteAssistencial: true });
    profissionais = profissionaisRows.filter((item) => item.ativo).map((item) => ({
      id: item.id,
      nome: item.nome,
      especialidade: item.especialidade ?? null,
    }));
  } catch {
    profissionais = [];
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
      initialProfissionalId={initialProfissionalId || undefined}
      initialData={normalizeDateParam(searchParams.data)}
      canBloquearHorario={canBloquearHorario}
      canDeleteBloqueio={canDeleteBloqueio}
    />
  );
}
