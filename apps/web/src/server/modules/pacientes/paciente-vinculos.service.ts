import "server-only";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { pacientes, userPacienteVinculos } from "@/server/db/schema";

export async function getPacientesVinculadosByUserId(
  userId: number
): Promise<Array<{ id: number; nome: string; foto: string | null }>> {
  if (!Number.isFinite(userId) || userId <= 0) return [];
  const rows = await db
    .select({
      id: pacientes.id,
      nome: pacientes.nome,
      foto: pacientes.foto,
    })
    .from(userPacienteVinculos)
    .innerJoin(
      pacientes,
      and(eq(pacientes.id, userPacienteVinculos.pacienteId), isNull(pacientes.deletedAt))
    )
    .where(eq(userPacienteVinculos.userId, userId))
    .orderBy(asc(pacientes.nome), asc(pacientes.id));
  return rows;
}

export async function getPacienteVinculadoByUserId(
  userId: number
): Promise<{ id: number; nome: string; foto: string | null } | null> {
  const rows = await getPacientesVinculadosByUserId(userId);
  return rows[0] ?? null;
}
