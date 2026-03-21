import "server-only";

import { and, desc, eq, gte, ilike, isNull, lte } from "drizzle-orm";
import { db } from "@/db";
import {
  atendimentos,
  evolucoes,
  pacientes,
  prontuarioDocumentos,
  terapeutas as profissionaisTabela,
  users,
} from "@/server/db/schema";
import { canonicalRoleName } from "@/server/auth/permissions";
import { AppError } from "@/server/shared/errors";
import { ymdMinusDaysInClinicTz, ymdNowInClinicTz } from "@/server/shared/clock";
import { escapeLikePattern, normalizeDateOnlyLoose } from "@/server/shared/normalize";
import { assertPacienteAccess } from "@/server/auth/paciente-access";
import { obterProfissionalPorUsuario } from "@/server/modules/profissionais/profissionais.service";
import { sanitizeEvolucaoPayload } from "@/lib/prontuario/evolucao-payload";
import { isEspecialidadeQuadroAdministrativo } from "@/lib/profissionais/especialidades";
import {
  sanitizePlanoEnsinoPayload,
  type PlanoEnsinoBloco,
} from "@/server/modules/prontuario/plano-ensino";
import type {
  AssiduidadeQueryInput,
  EvolutivoQueryInput,
  PlanoEnsinoQueryInput,
} from "@/server/modules/relatorios/relatorios.schema";

type EvolutivoAtendimentoInternal = {
  id: number;
  data: string;
  hora_inicio: string | null;
  hora_fim: string | null;
  duracao_min: number;
  presenca: string;
  profissional_id: number | null;
  profissional_nome: string | null;
  motivo: string | null;
  observacoes: string | null;
  resumo_repasse: string | null;
};

type EvolutivoAtendimentoContract = {
  id: number;
  data: string;
  hora_inicio: string | null;
  hora_fim: string | null;
  duracao_min: number;
  presenca: string;
  profissional_id: number | null;
  profissional_nome: string | null;
  motivo: string | null;
  observacoes: string | null;
  resumo_repasse: string | null;
};

function toEvolutivoAtendimentoContract(
  atendimento: EvolutivoAtendimentoInternal
): EvolutivoAtendimentoContract {
  // Relatorios continuam em snake_case por contrato historico com telas e exportacao (PDF/DOCX).
  return {
    id: atendimento.id,
    data: atendimento.data,
    hora_inicio: atendimento.hora_inicio,
    hora_fim: atendimento.hora_fim,
    duracao_min: atendimento.duracao_min,
    presenca: atendimento.presenca,
    profissional_id: atendimento.profissional_id,
    profissional_nome: atendimento.profissional_nome,
    motivo: atendimento.motivo,
    observacoes: atendimento.observacoes,
    resumo_repasse: atendimento.resumo_repasse,
  };
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

async function resolveProfissionalFiltro(params: {
  roleCanon: string | null;
  userId: number;
  profissionalId?: number | null;
}): Promise<number | null> {
  if (params.roleCanon === "PROFISSIONAL") {
    const profissional = await obterProfissionalPorUsuario(params.userId);
    if (!profissional) throw new AppError("Profissional nao encontrado", 403, "FORBIDDEN");
    return assertProfissionalAssistencial(Number(profissional.id));
  }
  if (!params.profissionalId) return null;
  return assertProfissionalAssistencial(Number(params.profissionalId));
}

function overlapDateRange(params: {
  targetFrom: string;
  targetTo: string;
  sourceFrom: string | null;
  sourceTo: string | null;
}): boolean {
  const from = params.sourceFrom ?? params.sourceTo;
  const to = params.sourceTo ?? params.sourceFrom;
  if (!from || !to) return false;
  return from <= params.targetTo && to >= params.targetFrom;
}

function toIsoDateKey(value: unknown): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

async function assertProfissionalAssistencial(profissionalId: number): Promise<number> {
  const [profissional] = await db
    .select({
      id: profissionaisTabela.id,
      especialidade: profissionaisTabela.especialidade,
    })
    .from(profissionaisTabela)
    .where(and(eq(profissionaisTabela.id, profissionalId), isNull(profissionaisTabela.deletedAt)))
    .limit(1);

  if (!profissional) {
    throw new AppError("Profissional nao encontrado", 404, "NOT_FOUND");
  }

  if (isEspecialidadeQuadroAdministrativo(profissional.especialidade)) {
    throw new AppError(
      "Profissional do quadro administrativo nao pode ser usado neste relatorio",
      400,
      "INVALID_INPUT"
    );
  }

  return Number(profissional.id);
}

export async function consolidateEvolutivoReport(params: {
  query: EvolutivoQueryInput;
  user: { id: number | string; role?: string | null };
}) {
  const pacienteId = Number(params.query.pacienteId);
  if (!pacienteId) throw new AppError("Paciente obrigatorio", 400, "INVALID_INPUT");

  const from = normalizeDateOnlyLoose(params.query.from) ?? ymdMinusDaysInClinicTz(29);
  const to = normalizeDateOnlyLoose(params.query.to) ?? ymdNowInClinicTz();

  if (from > to) throw new AppError("Periodo invalido", 400, "INVALID_PERIOD");

  const roleCanon = canonicalRoleName(params.user.role ?? null) ?? params.user.role ?? null;

  // Enforce paciente access (admins ok; profissionais must be linked)
  await assertPacienteAccess(params.user, pacienteId);

  const profissionalFiltro = await resolveProfissionalFiltro({
    roleCanon,
    userId: Number(params.user.id),
    profissionalId: params.query.profissionalId ?? null,
  });

  const [paciente] = await db
    .select({
      id: pacientes.id,
      nome: pacientes.nome,
      cpf: pacientes.cpf,
      dataNascimento: pacientes.dataNascimento,
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
  if (profissionalFiltro) whereAtend.push(eq(atendimentos.profissionalId, profissionalFiltro));

  const atendRaw = await db
    .select({
      id: atendimentos.id,
      data: atendimentos.data,
      hora_inicio: atendimentos.horaInicio,
      hora_fim: atendimentos.horaFim,
      presenca: atendimentos.presenca,
      profissional_id: atendimentos.profissionalId,
      profissional_nome: profissionaisTabela.nome,
      motivo: atendimentos.motivo,
      observacoes: atendimentos.observacoes,
      resumo_repasse: atendimentos.resumoRepasse,
    })
    .from(atendimentos)
    .leftJoin(profissionaisTabela, eq(profissionaisTabela.id, atendimentos.profissionalId))
    .where(and(...whereAtend))
    .orderBy(desc(atendimentos.data), desc(atendimentos.horaInicio), desc(atendimentos.id));

  const atend = atendRaw.map((a) => {
    const dur = calcularDuracaoMinutos(a.hora_inicio, a.hora_fim);
    return {
      ...a,
      data: String(a.data).slice(0, 10),
      duracao_min: dur,
    };
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
    porProfissional: [] as Array<{
      profissional_id: number | null;
      profissional_nome: string;
      total: number;
      presentes: number;
      ausentes: number;
    }>,
  };
  type DistProfissional = {
    profissional_id: number | null;
    profissional_nome: string;
    total: number;
    presentes: number;
    ausentes: number;
  };
  const mapProfissionais = new Map<number, DistProfissional>();
  atend.forEach((a) => {
    const key = a.profissional_id ? Number(a.profissional_id) : 0;
    if (!mapProfissionais.has(key)) {
      mapProfissionais.set(key, {
        profissional_id: a.profissional_id ? Number(a.profissional_id) : null,
        profissional_nome: a.profissional_nome || "N/A",
        total: 0,
        presentes: 0,
        ausentes: 0,
      });
    }
    const obj = mapProfissionais.get(key);
    if (!obj) return;
    obj.total += 1;
    if (a.presenca === "Presente") obj.presentes += 1;
    if (a.presenca === "Ausente") obj.ausentes += 1;
  });
  const distribuicaoProfissionais = Array.from(mapProfissionais.values());
  distribuicao.porProfissional = distribuicaoProfissionais;

  const evols = await db
    .select({
      id: evolucoes.id,
      data: evolucoes.data,
      profissional_id: evolucoes.profissionalId,
      profissional_nome: profissionaisTabela.nome,
      payload: evolucoes.payload,
    })
    .from(evolucoes)
    .leftJoin(profissionaisTabela, eq(profissionaisTabela.id, evolucoes.profissionalId))
    .where(
      and(
        eq(evolucoes.pacienteId, pacienteId),
        isNull(evolucoes.deletedAt),
        gte(evolucoes.data, from),
        lte(evolucoes.data, to)
      )
    )
    .orderBy(desc(evolucoes.data), desc(evolucoes.createdAt));

  const evolsSanitized = evols.map((e) => ({
    ...e,
    payload: sanitizeEvolucaoPayload(e.payload).payload,
  }));

  const observacoes: Array<{
    data: string;
    profissional_nome: string;
    texto: string;
    origem: string;
  }> = [];

  const motivosAusencia = new Map<string, number>();
  atend.forEach((a) => {
    const obs = normalizeTextoObservacao(a);
    if (obs) {
      observacoes.push({
        data: a.data,
        profissional_nome: a.profissional_nome || "Profissional",
        texto: obs.texto,
        origem: obs.origem,
      });
    }
    if (a.presenca === "Ausente") {
      const mot = (a.motivo || "").trim();
      if (mot) motivosAusencia.set(mot, (motivosAusencia.get(mot) || 0) + 1);
    }
  });

  evolsSanitized.forEach((e) => {
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
        profissional_nome: e.profissional_nome || "Profissional",
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
  if (!observacoes.length && evolsSanitized.length === 0) regras.push("SEM_EVOLUCOES_TEXTUAIS");
  if (observacoes.length + evolsSanitized.length >= 5) regras.push("COM_REGISTROS_CLINICOS");

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
    filtros: {
      profissionalId: profissionalFiltro,
      role: roleCanon,
    },
    indicadores,
    distribuicao,
    destaques: { ultimasObservacoes, principaisMotivosAusencia },
    resumoAutomatico,
    evolucoes: evolsSanitized.map((e) => ({ ...e, data: String(e.data).slice(0, 10) })),
    atendimentos: atend.map((a) =>
      toEvolutivoAtendimentoContract({
        id: a.id,
        data: a.data,
        hora_inicio: a.hora_inicio,
        hora_fim: a.hora_fim,
        duracao_min: a.duracao_min,
        presenca: a.presenca,
        profissional_id: a.profissional_id,
        profissional_nome: a.profissional_nome,
        motivo: a.motivo,
        observacoes: a.observacoes,
        resumo_repasse: a.resumo_repasse,
      })
    ),
  };
}

type PlanoEnsinoBlocoReport = {
  habilidade: string | null;
  ensino: string | null;
  objetivoEnsino: string | null;
  recursos: string | null;
  procedimento: string | null;
  suportes: string | null;
  objetivoEspecifico: string | null;
  criterioSucesso: string | null;
};

function toPlanoBlocoReport(bloco: PlanoEnsinoBloco): PlanoEnsinoBlocoReport {
  return {
    habilidade: bloco.habilidade,
    ensino: bloco.ensino,
    objetivoEnsino: bloco.objetivoEnsino,
    recursos: bloco.recursos,
    procedimento: bloco.procedimento,
    suportes: bloco.suportes,
    objetivoEspecifico: bloco.objetivoEspecifico,
    criterioSucesso: bloco.criterioSucesso,
  };
}

export async function consolidatePlanoEnsinoReport(params: {
  query: PlanoEnsinoQueryInput;
  user: { id: number | string; role?: string | null };
}) {
  const pacienteId = Number(params.query.pacienteId);
  if (!pacienteId) throw new AppError("Paciente obrigatorio", 400, "INVALID_INPUT");

  const from = normalizeDateOnlyLoose(params.query.from) ?? ymdMinusDaysInClinicTz(29);
  const to = normalizeDateOnlyLoose(params.query.to) ?? ymdNowInClinicTz();
  if (from > to) throw new AppError("Periodo invalido", 400, "INVALID_PERIOD");

  await assertPacienteAccess(params.user, pacienteId);

  const [paciente] = await db
    .select({
      id: pacientes.id,
      nome: pacientes.nome,
      cpf: pacientes.cpf,
      dataNascimento: pacientes.dataNascimento,
    })
    .from(pacientes)
    .where(and(eq(pacientes.id, pacienteId), isNull(pacientes.deletedAt)))
    .limit(1);

  if (!paciente) throw new AppError("Paciente nao encontrado", 404, "NOT_FOUND");

  const rawRows = await db
    .select({
      id: prontuarioDocumentos.id,
      version: prontuarioDocumentos.version,
      status: prontuarioDocumentos.status,
      titulo: prontuarioDocumentos.titulo,
      payload: prontuarioDocumentos.payload,
      createdAt: prontuarioDocumentos.createdAt,
      updatedAt: prontuarioDocumentos.updatedAt,
      autorNome: users.nome,
      createdByRole: prontuarioDocumentos.createdByRole,
    })
    .from(prontuarioDocumentos)
    .leftJoin(users, eq(users.id, prontuarioDocumentos.createdByUserId))
    .where(
      and(
        eq(prontuarioDocumentos.pacienteId, pacienteId),
        eq(prontuarioDocumentos.tipo, "PLANO_ENSINO"),
        isNull(prontuarioDocumentos.deletedAt)
      )
    )
    .orderBy(desc(prontuarioDocumentos.version), desc(prontuarioDocumentos.createdAt));

  const planos = rawRows
    .map((row) => {
      const payload = sanitizePlanoEnsinoPayload(row.payload);
      const createdAtDate = toIsoDateKey(row.createdAt);
      const dataInicio = payload.dataInicio ?? createdAtDate;
      const dataFinal = payload.dataFinal ?? dataInicio;
      return {
        id: row.id,
        version: row.version,
        status: row.status,
        titulo: row.titulo || "Plano de Ensino",
        especialidade: payload.especialidade || null,
        dataInicio,
        dataFinal,
        totalBlocos: payload.blocos.length,
        blocos: payload.blocos.map(toPlanoBlocoReport),
        autorNome: row.autorNome || row.createdByRole || "Usuario",
        createdAt: row.createdAt ? String(row.createdAt) : null,
        updatedAt: row.updatedAt ? String(row.updatedAt) : null,
      };
    })
    .filter((plano) =>
      overlapDateRange({
        targetFrom: from,
        targetTo: to,
        sourceFrom: plano.dataInicio,
        sourceTo: plano.dataFinal,
      })
    );

  const statusMap = new Map<string, number>();
  const especialidadeMap = new Map<string, number>();
  let totalBlocos = 0;

  planos.forEach((plano) => {
    totalBlocos += plano.totalBlocos;
    const status = String(plano.status || "-");
    statusMap.set(status, (statusMap.get(status) || 0) + 1);
    const especialidade = (plano.especialidade || "Nao informado").trim();
    especialidadeMap.set(especialidade, (especialidadeMap.get(especialidade) || 0) + 1);
  });

  const resumo = {
    totalPlanos: planos.length,
    totalBlocos,
    status: Array.from(statusMap.entries())
      .map(([label, total]) => ({ label, total }))
      .sort((a, b) => b.total - a.total),
    especialidades: Array.from(especialidadeMap.entries())
      .map(([label, total]) => ({ label, total }))
      .sort((a, b) => b.total - a.total),
    ultimoPlano:
      planos.find((plano) => plano.status === "Finalizado") ??
      planos[0] ??
      null,
  };

  return {
    paciente: {
      id: paciente.id,
      nome: paciente.nome,
      cpf: paciente.cpf,
      dataNascimento: paciente.dataNascimento,
    },
    periodo: { from, to },
    resumo,
    planos,
  };
}

export async function consolidateAssiduidadeReport(params: {
  query: AssiduidadeQueryInput;
  user: { id: number | string; role?: string | null };
}) {
  const roleCanon = canonicalRoleName(params.user.role ?? null) ?? params.user.role ?? null;
  const userId = Number(params.user.id);

  const from = normalizeDateOnlyLoose(params.query.from) ?? ymdMinusDaysInClinicTz(29);
  const to = normalizeDateOnlyLoose(params.query.to) ?? ymdNowInClinicTz();
  if (from > to) throw new AppError("Periodo invalido", 400, "INVALID_PERIOD");

  const profissionalFiltro = await resolveProfissionalFiltro({
    roleCanon,
    userId,
    profissionalId: params.query.profissionalId ?? null,
  });

  const where = [
    isNull(atendimentos.deletedAt),
    gte(atendimentos.data, from),
    lte(atendimentos.data, to),
  ];
  if (profissionalFiltro) where.push(eq(atendimentos.profissionalId, profissionalFiltro));
  if (params.query.presenca) where.push(eq(atendimentos.presenca, params.query.presenca));
  const nomeFiltro = params.query.pacienteNome?.trim() || null;
  if (nomeFiltro) {
    where.push(ilike(pacientes.nome, `%${escapeLikePattern(nomeFiltro)}%`));
  }

  const baseFrom = db
    .select({
      id: atendimentos.id,
      paciente_id: atendimentos.pacienteId,
      paciente_nome: pacientes.nome,
      data: atendimentos.data,
      presenca: atendimentos.presenca,
      profissional_nome: profissionaisTabela.nome,
    })
    .from(atendimentos)
    .innerJoin(pacientes, and(eq(pacientes.id, atendimentos.pacienteId), isNull(pacientes.deletedAt)))
    .leftJoin(profissionaisTabela, eq(profissionaisTabela.id, atendimentos.profissionalId))
    .where(and(...where));

  const rows = await baseFrom.orderBy(desc(atendimentos.data), desc(atendimentos.id));

  // Summary
  const total = rows.length;
  const presentes = rows.filter((a) => a.presenca === "Presente").length;
  const faltas = rows.filter((a) => a.presenca === "Ausente").length;
  const semRegistro = rows.filter((a) => a.presenca !== "Presente" && a.presenca !== "Ausente").length;
  const denominador = presentes + faltas;
  const taxa = denominador ? Math.round((presentes / denominador) * 100) : 0;

  // Per patient
  const mapa = new Map<number, {
    pacienteNome: string;
    total: number;
    presencas: number;
    faltas: number;
    neutros: number;
    ultimo: string;
    profissionais: Set<string>;
  }>();

  rows.forEach((a) => {
    const key = Number(a.paciente_id);
    if (!mapa.has(key)) {
      mapa.set(key, {
        pacienteNome: a.paciente_nome || "Paciente",
        total: 0,
        presencas: 0,
        faltas: 0,
        neutros: 0,
        ultimo: "",
        profissionais: new Set<string>(),
      });
    }
    const item = mapa.get(key);
    if (!item) return;
    item.total += 1;
    if (a.presenca === "Presente") item.presencas += 1;
    else if (a.presenca === "Ausente") item.faltas += 1;
    else item.neutros += 1;
    const d = String(a.data).slice(0, 10);
    if (d && (!item.ultimo || d > item.ultimo)) item.ultimo = d;
    if (a.profissional_nome) item.profissionais.add(String(a.profissional_nome));
  });

  const linhas = Array.from(mapa.values())
    .map((l) => {
      const denom = l.presencas + l.faltas;
      const taxaLinha = denom ? Math.round((l.presencas / denom) * 100) : 0;
      return {
        pacienteNome: l.pacienteNome,
        total: l.total,
        presencas: l.presencas,
        faltas: l.faltas,
        taxa: taxaLinha,
        neutros: l.neutros,
        ultimo: l.ultimo,
        profissionais: Array.from(l.profissionais).join(", ") || "-",
      };
    })
    .sort((a, b) => (a.taxa !== b.taxa ? a.taxa - b.taxa : a.pacienteNome.localeCompare(b.pacienteNome)));

  return {
    periodo: { from, to },
    filtros: {
      profissionalId: profissionalFiltro,
      pacienteNome: nomeFiltro,
      presenca: params.query.presenca ?? null,
      role: roleCanon,
    },
    resumo: { total, presentes, faltas, semRegistro, taxa },
    linhas,
  };
}
