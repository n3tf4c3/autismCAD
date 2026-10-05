import Link from "next/link";
import { redirect } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { pacientes } from "@autismcad/db/schema";
import { normalizeDateOnlyLoose } from "@autismcad/shared/normalize";
import { db } from "@/db";
import { env } from "@/lib/env";
import { requirePermission } from "@/server/auth/auth";
import { hasPermissionKey } from "@/server/auth/permissions";
import { assertPacienteAccess } from "@/server/auth/paciente-access";
import { listarDocumentos } from "@/server/modules/prontuario/prontuario.service";
import { sanitizePlanoEnsinoPayload } from "@/server/modules/prontuario/plano-ensino";
import { AppError, toAppError } from "@/server/shared/errors";
import { PlanoEnsinoDocumentoImpressaoClient } from "./plano-ensino-documento-impressao.client";

export const metadata = { title: "Plano de Ensino — Impressão | AutismCAD" };

function Aviso(props: { mensagem: string; pacienteId?: number }) {
  return (
    <main className="mx-auto max-w-4xl space-y-4 rounded-2xl bg-white p-6 shadow-sm">
      <p className="text-sm text-red-600">{props.mensagem}</p>
      <Link
        href={props.pacienteId ? `/prontuario/${props.pacienteId}` : "/prontuario"}
        className="text-sm font-semibold text-[var(--laranja)]"
      >
        &larr; Voltar ao prontuário
      </Link>
    </main>
  );
}

export default async function PlanoEnsinoDocumentoImpressaoPage(props: {
  searchParams: Promise<{ pacienteId?: string; documentoId?: string }>;
}) {
  let authorization: Awaited<ReturnType<typeof requirePermission>>;
  try {
    authorization = await requirePermission("prontuario:view");
  } catch (error) {
    if (error instanceof AppError) {
      if (error.status === 401) redirect("/login");
      if (error.code === "CONSENT_REQUIRED") redirect("/consentimento");
      if (error.status === 403) return <Aviso mensagem={error.message} />;
    }
    throw error;
  }
  const { user, access } = authorization;
  const { pacienteId, documentoId } = await props.searchParams;
  const id = Number(pacienteId);
  const docId = documentoId === undefined ? null : Number(documentoId);
  if (!Number.isSafeInteger(id) || id <= 0) {
    return <Aviso mensagem="Paciente inválido." />;
  }
  if (docId !== null && (!Number.isSafeInteger(docId) || docId <= 0)) {
    return <Aviso mensagem="Plano de ensino inválido." pacienteId={id} />;
  }

  try {
    await assertPacienteAccess(user, id, access);
  } catch (error) {
    return <Aviso mensagem={toAppError(error).message} />;
  }

  const [rows, documentos] = await Promise.all([
    db.select({ id: pacientes.id, nome: pacientes.nome, dataNascimento: pacientes.dataNascimento })
      .from(pacientes)
      .where(and(eq(pacientes.id, id), isNull(pacientes.deletedAt)))
      .limit(1),
    listarDocumentos(id, "PLANO_ENSINO"),
  ]);
  const paciente = rows[0];
  if (!paciente) return <Aviso mensagem="Paciente não encontrado." />;

  const documento = docId === null ? documentos[0] : documentos.find((item) => item.id === docId);
  if (docId !== null && !documento) {
    return <Aviso mensagem="Plano de ensino não encontrado para este paciente." pacienteId={id} />;
  }

  return (
    <PlanoEnsinoDocumentoImpressaoClient
      paciente={paciente}
      canCriarPlano={hasPermissionKey(access.permissions, "prontuario:create")}
      planos={documentos.map((item) => ({
        id: item.id,
        titulo: item.titulo || "Plano de Ensino",
        status: item.status,
        updatedAt: normalizeDateOnlyLoose(item.updatedAt ? String(item.updatedAt) : null, env.APP_TIMEZONE),
      }))}
      documento={documento ? {
        id: documento.id,
        titulo: documento.titulo || "Plano de Ensino",
        status: documento.status,
        autorNome: documento.autorNome || documento.createdByRole || "Usuário",
        updatedAt: normalizeDateOnlyLoose(documento.updatedAt ? String(documento.updatedAt) : null, env.APP_TIMEZONE),
        plano: sanitizePlanoEnsinoPayload(documento.payload),
      } : null}
    />
  );
}
