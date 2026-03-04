import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { pacientes, userPacienteVinculos } from "@/server/db/schema";

export async function getPacienteVinculadoByUserId(userId: number): Promise<{ id: number; nome: string } | null> {
  if (!Number.isFinite(userId) || userId <= 0) return null;
  const [row] = await db
    .select({
      id: pacientes.id,
      nome: pacientes.nome,
    })
    .from(userPacienteVinculos)
    .innerJoin(
      pacientes,
      and(eq(pacientes.id, userPacienteVinculos.pacienteId), isNull(pacientes.deletedAt))
    )
    .where(eq(userPacienteVinculos.userId, userId))
    .limit(1);
  return row ?? null;
}

