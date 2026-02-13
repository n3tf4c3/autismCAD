import "server-only";

import { and, desc, eq, gte, isNull, lte } from "drizzle-orm";
import { db } from "@/db";
import { atendimentos, evolucoes, pacientes, terapeutas } from "@/server/db/schema";
import { canonicalRoleName } from "@/server/auth/permissions";
import { AppError } from "@/server/shared/errors";
import { assertPacienteAccess } from "@/server/auth/paciente-access";
import { obterTerapeutaPorUsuario } from "@/server/modules/terapeutas/terapeutas.service";
import type { EvolutivoQueryInput } from "@/server/modules/relatorios/relatorios.schema";

function ymdToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function ymdMinusDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function normalizeDate(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function calcularDuracaoMinutos(horaInicio?: string | null, horaFim?: string | null): number {
  if (!horaInicio || !horaFim) return 0;
  const hi = String(horaInicio).slice(0, 5);
  const hf = String(horaFim).slice(0, 5);
  const [hiH, hiM] = hi.split(":").map(Number);
  const [hfH, hfM] = hf.split(":").map(Number);
  if ([hiH, hiM, hfH, hfM].some((v) => Number.isNaN(v))) return 0;
  return hfH * 60 + hfM - (hiH * 60 + hiM);
}

function normalizeTextoObservacao(a: {
  observacoes?: string | null;
  resumo_repasse?: string | null;
  motivo?: string | null;
}) {
  const texto =
    (a.observacoes || "").trim() ||
    (a.resumo_repasse || "").trim() ||
    (a.motivo || "").trim() ||
    "";
  if (!texto) return null;
  const clean = texto.replace(/\s+/g, " ").trim();
  const curto = clean.length > 240 ? `${clean.slice(0, 240)}...` : clean;
  return {
    texto: curto,
    origem: a.observacoes ? "observacoes" : a.resumo_repasse ? "resumo_repasse" : "motivo",
    original: clean,
  };
}

export async function consolidateEvolutivoReport(params: {
  query: EvolutivoQueryInput;
  user: { id: number | string; role?: string | null };
}) {
  const pacienteId = Number(params.query.pacienteId);
  if (!pacienteId) throw new AppError("Paciente obrigatorio", 400, "INVALID_INPUT");

  const from = normalizeDate(params.query.from) ?? ymdMinusDays(29);
  const to = normalizeDate(params.query.to) ?? ymdToday();

  if (from > to) throw new AppError("Periodo invalido", 400, "INVALID_PERIOD");

  const roleCanon = canonicalRoleName(params.user.role ?? null) ?? params.user.role ?? null;

  // Enforce paciente access (admins ok; terapeutas must be linked)
  await assertPacienteAccess(params.user, pacienteId);

  let terapeutaFiltro = params.query.terapeutaId ? Number(params.query.terapeutaId) : null;
  if (roleCanon === "TERAPEUTA") {
    const terapeuta = await obterTerapeutaPorUsuario(Number(params.user.id));
    if (!terapeuta) throw new AppError("Terapeuta nao encontrado", 403, "FORBIDDEN");
    terapeutaFiltro = terapeuta.id;
  }

  const [paciente] = await db
    .select({
      id: pacientes.id,
      nome: pacientes.nome,
      cpf: pacientes.cpf,
      data_nascimento: pacientes.dataNascimento,
      convenio: pacientes.convenio,
    })
    .from(pacientes)
    .where(and(eq(pacientes.id, pacienteId), isNull(pacientes.deletedAt)))
    .limit(1);

  if (!paciente) throw new AppError("Paciente nao encontrado", 404, "NOT_FOUND");

  const whereAtend = [
    eq(atendimentos.pacienteId, pacienteId),
    isNull(atendimentos.deletedAt),
    gte(atendimentos.data, from),
    lte(atendimentos.data, to),
  ];
  if (terapeutaFiltro) whereAtend.push(eq(atendimentos.terapeutaId, terapeutaFiltro));

  const atendRaw = await db
    .select({
      id: atendimentos.id,
      data: atendimentos.data,
      hora_inicio: atendimentos.horaInicio,
      hora_fim: atendimentos.horaFim,
      presenca: atendimentos.presenca,
      terapeuta_id: atendimentos.terapeutaId,
      terapeuta_nome: terapeutas.nome,
      motivo: atendimentos.motivo,
      observacoes: atendimentos.observacoes,
      resumo_repasse: atendimentos.resumoRepasse,
    })
    .from(atendimentos)
    .leftJoin(terapeutas, eq(terapeutas.id, atendimentos.terapeutaId))
    .where(and(...whereAtend))
    .orderBy(desc(atendimentos.data), desc(atendimentos.horaInicio), desc(atendimentos.id));

  const atend = atendRaw.map((a) => {
    const dur = calcularDuracaoMinutos(a.hora_inicio, a.hora_fim);
    return { ...a, data: String(a.data).slice(0, 10), duracao_min: dur };
  });

  const indicadores = {
    totalAtendimentos: atend.length,
    presentes: atend.filter((a) => a.presenca === "Presente").length,
    ausentes: atend.filter((a) => a.presenca === "Ausente").length,
    naoInformado: atend.filter((a) => a.presenca === "Nao informado").length,
    taxaPresencaPercent: 0,
    tempoTotalMinutos: 0,
    mediaMinutosPorSessao: 0,
    primeiroAtendimento: atend.length ? atend[atend.length - 1]?.data ?? null : null,
    ultimoAtendimento: atend.length ? atend[0]?.data ?? null : null,
  };

  let totalDuracao = 0;
  let countDuracao = 0;
  atend.forEach((a) => {
    if (a.duracao_min > 0) {
      totalDuracao += a.duracao_min;
      countDuracao += 1;
    }
  });
  indicadores.tempoTotalMinutos = totalDuracao;
  indicadores.mediaMinutosPorSessao = countDuracao
    ? Math.round((totalDuracao / countDuracao) * 10) / 10
    : 0;
  indicadores.taxaPresencaPercent = indicadores.totalAtendimentos
    ? Math.round((indicadores.presentes / indicadores.totalAtendimentos) * 1000) / 10
    : 0;

  const distribuicao = {
    porPresenca: {
      Presente: indicadores.presentes,
      Ausente: indicadores.ausentes,
      "Nao informado": indicadores.naoInformado,
    },
    porTerapeuta: [] as Array<{
      terapeuta_id: number | null;
      terapeuta_nome: string;
      total: number;
      presentes: number;
      ausentes: number;
    }>,
  };
  type DistTerapeuta = {
    terapeuta_id: number | null;
    terapeuta_nome: string;
    total: number;
    presentes: number;
    ausentes: number;
  };
  const mapTer = new Map<number, DistTerapeuta>();
  atend.forEach((a) => {
    const key = a.terapeuta_id ? Number(a.terapeuta_id) : 0;
    if (!mapTer.has(key)) {
      mapTer.set(key, {
        terapeuta_id: a.terapeuta_id ? Number(a.terapeuta_id) : null,
        terapeuta_nome: a.terapeuta_nome || "N/A",
        total: 0,
        presentes: 0,
        ausentes: 0,
      });
    }
    const obj = mapTer.get(key);
    if (!obj) return;
    obj.total += 1;
    if (a.presenca === "Presente") obj.presentes += 1;
    if (a.presenca === "Ausente") obj.ausentes += 1;
  });
  distribuicao.porTerapeuta = Array.from(mapTer.values());

  const evols = await db
    .select({
      id: evolucoes.id,
      data: evolucoes.data,
      terapeuta_id: evolucoes.terapeutaId,
      terapeuta_nome: terapeutas.nome,
      payload: evolucoes.payload,
    })
    .from(evolucoes)
    .leftJoin(terapeutas, eq(terapeutas.id, evolucoes.terapeutaId))
    .where(
      and(
        eq(evolucoes.pacienteId, pacienteId),
        isNull(evolucoes.deletedAt),
        gte(evolucoes.data, from),
        lte(evolucoes.data, to)
      )
    )
    .orderBy(desc(evolucoes.data), desc(evolucoes.createdAt));

  const observacoes: Array<{
    data: string;
    terapeuta_nome: string;
    texto: string;
    origem: string;
  }> = [];

  const motivosAusencia = new Map<string, number>();
  atend.forEach((a) => {
    const obs = normalizeTextoObservacao(a);
    if (obs) {
      observacoes.push({
        data: a.data,
        terapeuta_nome: a.terapeuta_nome || "Terapeuta",
        texto: obs.texto,
        origem: obs.origem,
      });
    }
    if (a.presenca === "Ausente") {
      const mot = (a.motivo || "").trim();
      if (mot) motivosAusencia.set(mot, (motivosAusencia.get(mot) || 0) + 1);
    }
  });

  evols.forEach((e) => {
    const p = (e.payload ?? {}) as Record<string, unknown>;
    const textos = [
      p.descricao,
      p.conduta,
      Array.isArray(p.metas) ? (p.metas as string[]).join("; ") : null,
      p.titulo,
    ]
      .map((t) => String(t || "").trim())
      .filter(Boolean);
    if (textos.length) {
      observacoes.push({
        data: String(e.data).slice(0, 10),
        terapeuta_nome: e.terapeuta_nome || "Terapeuta",
        texto: textos.join(" | "),
        origem: "evolucao",
      });
    }
  });

  observacoes.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
  const ultimasObservacoes = observacoes.slice(0, 8);
  const principaisMotivosAusencia = Array.from(motivosAusencia.entries())
    .map(([motivo, count]) => ({ motivo, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const regras: string[] = [];
  const tp = indicadores.taxaPresencaPercent;
  if (tp >= 85 && indicadores.totalAtendimentos >= 4) regras.push("ADESAO_BOA");
  if (indicadores.ausentes >= 3 || tp < 70) regras.push("MUITAS_FALTAS");
  if (indicadores.totalAtendimentos && indicadores.naoInformado / indicadores.totalAtendimentos > 0.4) {
    regras.push("MUITOS_SEM_REGISTRO");
  }
  if (!observacoes.length && evols.length === 0) regras.push("SEM_EVOLUCOES_TEXTUAIS");
  if (observacoes.length + evols.length >= 5) regras.push("COM_REGISTROS_CLINICOS");

  const adesaoTexto =
    tp >= 85
      ? "Adesao considerada boa no periodo, com alta taxa de presenca."
      : tp < 70
        ? "Adesao abaixo do esperado, com presencas reduzidas."
        : "Adesao moderada, com variacao na presenca.";
  const faltasTexto =
    indicadores.ausentes >= 3
      ? "Houve numero elevado de faltas; investigar causas e ajustar agenda."
      : "Faltas dentro do esperado.";
  const registrosTexto = observacoes.length
    ? `Foram registrados ${observacoes.length} apontamentos clinicos relevantes.`
    : "Nao ha registros textuais de evolucao no periodo.";
  const recomendacaoTexto = regras.includes("MUITAS_FALTAS")
    ? "Recomenda-se reforcar contato com a familia e revisar horarios."
    : regras.includes("SEM_EVOLUCOES_TEXTUAIS")
      ? "Reforcar registro de observacoes clinicas para melhor acompanhamento."
      : "Manter acompanhamento atual e revisitar metas periodicamente.";

  const resumoAutomatico = {
    texto: `${adesaoTexto} ${faltasTexto}\n${registrosTexto}\n${recomendacaoTexto}`,
    regrasDisparadas: regras,
  };

  return {
    paciente,
    periodo: { from, to },
    filtros: { terapeutaId: terapeutaFiltro, role: roleCanon },
    indicadores,
    distribuicao,
    destaques: { ultimasObservacoes, principaisMotivosAusencia },
    resumoAutomatico,
    evolucoes: evols.map((e) => ({ ...e, data: String(e.data).slice(0, 10) })),
    atendimentos: atend.map((a) => ({
      id: a.id,
      data: a.data,
      hora_inicio: a.hora_inicio,
      hora_fim: a.hora_fim,
      duracao_min: a.duracao_min,
      presenca: a.presenca,
      terapeuta_id: a.terapeuta_id,
      terapeuta_nome: a.terapeuta_nome,
      motivo: a.motivo,
      observacoes: a.observacoes,
      resumo_repasse: a.resumo_repasse,
    })),
  };
}
