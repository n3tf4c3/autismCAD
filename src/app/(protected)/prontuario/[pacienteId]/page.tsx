import Link from "next/link";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { pacientes } from "@/server/db/schema";
import { requirePermission } from "@/server/auth/auth";
import { assertPacienteAccess } from "@/server/auth/paciente-access";
import { obterTimelineProntuario } from "@/server/modules/prontuario/prontuario.service";
import { TimelineClient, type TimelineItem } from "@/app/(protected)/prontuario/[pacienteId]/timeline.client";
import { toAppError } from "@/server/shared/errors";

export default async function ProntuarioPacientePage(props: {
  params: Promise<{ pacienteId: string }>;
}) {
  const { user } = await requirePermission("prontuario:view");
  const { pacienteId } = await props.params;
  const id = Number(pacienteId);
  if (!id) {
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

  const [paciente, timeline] = await Promise.all([
    db
      .select({ id: pacientes.id, nome: pacientes.nome })
      .from(pacientes)
      .where(and(eq(pacientes.id, id), isNull(pacientes.deletedAt)))
      .limit(1)
      .then((rows) => rows[0] ?? null),
    obterTimelineProntuario(id),
  ]);

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
            <p className="text-sm text-gray-500">Prontuario multiprofissional</p>
            <h1 className="text-2xl font-bold text-[var(--marrom)]">
              {paciente.nome} <span className="text-gray-500">#{paciente.id}</span>
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/prontuario/${paciente.id}/evolucao/nova`}
              className="rounded-lg bg-[var(--laranja)] px-4 py-2 text-sm font-semibold text-white hover:bg-[#e6961f]"
            >
              Nova Evolucao
            </Link>
            <Link
              href={`/relatorios/evolutivo?pacienteId=${paciente.id}`}
              className="rounded-lg border border-[var(--laranja)] bg-white px-4 py-2 text-sm font-semibold text-[var(--laranja)] hover:bg-amber-50"
            >
              Relatorio Evolutivo
            </Link>
            <Link
              href={`/prontuario/${paciente.id}/novo-documento?tipo=ANAMNESE`}
              className="rounded-lg border border-[var(--laranja)] bg-white px-4 py-2 text-sm font-semibold text-[var(--laranja)] hover:bg-amber-50"
            >
              Novo Documento
            </Link>
          </div>
        </div>
      </section>

      <TimelineClient pacienteId={paciente.id} initialItems={timeline as TimelineItem[]} />
    </main>
  );
}
