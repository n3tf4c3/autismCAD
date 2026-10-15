import "server-only";

import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { atendimentos, pacientes, prontuarioDocumentos, terapeutas as profissionaisTabela } from "@autismcad/db/schema";
import { db } from "@/db";
import type { AuthenticatedUser } from "@/server/auth/auth";
import { assertHasPermission, type UserAccess } from "@/server/auth/access";
import { ADMIN_ROLES } from "@/server/auth/permissions";
import { assertPacienteAccess } from "@/server/auth/paciente-access";
import { obterProfissionalPorUsuario } from "@/server/modules/profissionais/profissionais.service";
import { sanitizePlanoEnsinoPayload } from "@/server/modules/prontuario/plano-ensino";
import { marcarPlanosEnsinoAtuais } from "@/lib/prontuario/plano-ensino-validade";
import { ymdNowInClinicTz } from "@/server/shared/clock";
import { AppError } from "@/server/shared/errors";

// Projeta apenas metadados; conteudo clinico dos blocos nao e enviado ao dashboard.
const fields = {
  id: prontuarioDocumentos.id,
  pacienteId: prontuarioDocumentos.pacienteId,
  pacienteNome: pacientes.nome,
  version: prontuarioDocumentos.version,
  status: prontuarioDocumentos.status,
  createdAt: prontuarioDocumentos.createdAt,
  especialidade: sql<string | null>`${prontuarioDocumentos.payload}->>'especialidade'`,
  dataInicio: sql<string | null>`coalesce(${prontuarioDocumentos.payload}->>'dataInicio', ${prontuarioDocumentos.payload}->>'data_inicio')`,
  dataFinal: sql<string | null>`coalesce(${prontuarioDocumentos.payload}->>'dataFinal', ${prontuarioDocumentos.payload}->>'data_final')`,
};
const especialidadeKey = sql`lower(trim(coalesce(${prontuarioDocumentos.payload}->>'especialidade', '')))`;

export async function listarPlanosEnsinoComValidade(params: {
  user: AuthenticatedUser;
  access: UserAccess;
  pacienteId?: number;
}) {
  assertHasPermission(params.access, ["prontuario:view"]);
  const where = [eq(prontuarioDocumentos.tipo, "PLANO_ENSINO"), isNull(prontuarioDocumentos.deletedAt)];
  if (params.pacienteId !== undefined) {
    await assertPacienteAccess(params.user, params.pacienteId, params.access);
    where.push(eq(prontuarioDocumentos.pacienteId, params.pacienteId));
  } else {
    const role = params.access.canonicalRole ?? params.access.role;
    if (role === "PROFISSIONAL") {
      const profissional = await obterProfissionalPorUsuario(params.user.id);
      if (!profissional) throw new AppError("Profissional sem vínculo", 403, "FORBIDDEN");
      where.push(inArray(prontuarioDocumentos.pacienteId,
        db.select({ id: atendimentos.pacienteId }).from(atendimentos)
          .innerJoin(profissionaisTabela, and(
            eq(profissionaisTabela.id, atendimentos.profissionalId),
            eq(profissionaisTabela.ativo, true), isNull(profissionaisTabela.deletedAt)
          ))
          .where(and(eq(atendimentos.profissionalId, profissional.id), isNull(atendimentos.deletedAt)))
      ));
    } else if (!role || (!ADMIN_ROLES.has(role) && role !== "RECEPCAO")) {
      throw new AppError("Acesso negado", 403, "FORBIDDEN");
    }
    // No painel, buscar apenas o ultimo finalizado por paciente e especialidade.
    where.push(eq(prontuarioDocumentos.status, "Finalizado"), eq(pacientes.ativo, true));
  }

  const selection = params.pacienteId !== undefined
    ? db.select(fields)
    : db.selectDistinctOn([prontuarioDocumentos.pacienteId, especialidadeKey], fields);
  const rows = await selection.from(prontuarioDocumentos)
    .innerJoin(pacientes, and(eq(pacientes.id, prontuarioDocumentos.pacienteId), isNull(pacientes.deletedAt)))
    .where(and(...where))
    .orderBy(asc(prontuarioDocumentos.pacienteId), especialidadeKey, desc(prontuarioDocumentos.version), desc(prontuarioDocumentos.id));

  return marcarPlanosEnsinoAtuais(rows.map((row) => {
    const plano = sanitizePlanoEnsinoPayload(row);
    return {
      id: row.id, pacienteId: row.pacienteId, pacienteNome: row.pacienteNome,
      version: row.version, status: row.status,
      especialidade: plano.especialidade, dataInicio: plano.dataInicio, dataFinal: plano.dataFinal,
      cadastradoEm: row.createdAt ? ymdNowInClinicTz(new Date(row.createdAt)) : null,
    };
  }));
}
