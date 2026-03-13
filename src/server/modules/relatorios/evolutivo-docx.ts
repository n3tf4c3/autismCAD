import "server-only";

import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import { env } from "@/lib/env";
import { buildDesempenhoResumo } from "@/lib/relatorios/desempenho";

type ComportamentoResultado = "negativo" | "positivo" | "parcial";

export type EvolutivoDocxReport = {
  paciente: { id: number; nome: string; cpf: string };
  periodo: { from: string; to: string };
  indicadores: {
    totalAtendimentos: number;
    presentes: number;
    ausentes: number;
    naoInformado: number;
    taxaPresencaPercent: number;
    tempoTotalMinutos: number;
    mediaMinutosPorSessao: number;
    primeiroAtendimento: string | null;
    ultimoAtendimento: string | null;
  };
  resumoAutomatico: { texto: string; regrasDisparadas: string[] };
  destaques: {
    ultimasObservacoes: Array<{ data: string; terapeuta_nome: string; texto: string; origem: string }>;
    principaisMotivosAusencia: Array<{ motivo: string; count: number }>;
  };
  atendimentos: Array<{
    id: number;
    data: string;
    hora_inicio?: string | null;
    hora_fim?: string | null;
    terapeuta_nome: string | null;
    presenca: string;
    duracao_min: number;
    observacoes: string | null;
    resumo_repasse: string | null;
    motivo: string | null;
  }>;
  evolucoes?: Array<{
    id: number;
    data: string;
    payload?: Record<string, unknown> | null;
  }>;
};

function fmtDate(value?: string | null): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("pt-BR", { timeZone: env.APP_TIMEZONE });
}

function fmtNowPtBr(): string {
  return new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: env.APP_TIMEZONE,
  });
}

function normalizeComportamentoResultado(value: unknown): ComportamentoResultado | null {
  if (typeof value !== "string") return null;
  const normalized = value.toLowerCase().trim().replace(/\s+/g, "_");
  if (normalized === "negativo" || normalized === "positivo" || normalized === "parcial") return normalized;
  return null;
}

function normalizeComportamentoKey(value: string): string {
  return value.toLowerCase().trim().replace(/\s+/g, "_");
}

function asPositiveInt(value: unknown, fallback = 1): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.trunc(n);
}

function pickStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item ?? "").trim()).filter(Boolean);
}

const COMPORTAMENTO_LABELS: Record<string, string> = {
  autoagressao: "Autoagressao",
  heteroagressao: "Hetero agressao",
  estereotipia_vocal: "Estereotipia vocal",
  estereotipia_motora: "Estereotipia motora",
  ecolalia_imediata: "Ecolalia imediata",
  ecolalia_tardia: "Ecolalia tardia",
  fugas_esquivas: "Fugas / esquivas",
  agitacao_motora: "Agitacao motora",
  demanda_atencao: "Demanda de atencao",
  crise_ausencia: "Crise de ausencia",
  isolamento: "Isolamento",
  comportamento_desafiador: "Comportamento desafiador",
  baixo_interesse: "Baixo interesse",
  desregulacao_emocional: "Desregulacao emocional",
  calmo: "Calmo",
  animado: "Animado",
  alto_interesse: "Alto interesse",
  foco_atencao: "Foco / atencao",
  compartilhamento: "Compartilhamento",
  empatia: "Empatia",
  autonomia: "Autonomia",
};

function behaviorLabelFromValue(value: string): string {
  const key = normalizeComportamentoKey(value);
  if (COMPORTAMENTO_LABELS[key]) return COMPORTAMENTO_LABELS[key];
  const clean = value.trim().replace(/_/g, " ");
  if (!clean) return "-";
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

function buildComportamentoResumo(report: EvolutivoDocxReport) {
  const resultado: Record<ComportamentoResultado, number> = {
    negativo: 0,
    positivo: 0,
    parcial: 0,
  };
  const mapNeg = new Map<string, { label: string; value: number }>();
  const mapPos = new Map<string, { label: string; value: number }>();

  const addItem = (side: "negativo" | "positivo", rawValue: string, qty: number) => {
    const key = normalizeComportamentoKey(rawValue);
    if (!key) return;
    const target = side === "negativo" ? mapNeg : mapPos;
    const current = target.get(key);
    if (current) {
      current.value += qty;
      return;
    }
    target.set(key, { label: behaviorLabelFromValue(rawValue), value: qty });
  };

  (report.evolucoes || []).forEach((evolucao) => {
    const payload = evolucao?.payload;
    if (!payload || typeof payload !== "object") return;
    const comportamentoRaw = payload.comportamentos ?? payload.comportamento;
    if (!comportamentoRaw || typeof comportamentoRaw !== "object") return;
    const comportamento = comportamentoRaw as Record<string, unknown>;

    const result = normalizeComportamentoResultado(comportamento.resultado);
    if (result) resultado[result] += 1;

    const quantidades =
      comportamento.quantidades && typeof comportamento.quantidades === "object"
        ? (comportamento.quantidades as Record<string, unknown>)
        : null;
    const qtyNeg =
      quantidades?.negativo && typeof quantidades.negativo === "object"
        ? (quantidades.negativo as Record<string, unknown>)
        : null;
    const qtyPos =
      quantidades?.positivo && typeof quantidades.positivo === "object"
        ? (quantidades.positivo as Record<string, unknown>)
        : null;

    pickStringList(comportamento.negativos).forEach((item) => {
      const key = normalizeComportamentoKey(item);
      const qty = asPositiveInt((qtyNeg?.[item] ?? qtyNeg?.[key]) as unknown, 1);
      addItem("negativo", item, qty);
    });

    pickStringList(comportamento.positivos).forEach((item) => {
      const key = normalizeComportamentoKey(item);
      const qty = asPositiveInt((qtyPos?.[item] ?? qtyPos?.[key]) as unknown, 1);
      addItem("positivo", item, qty);
    });
  });

  const totalNegativo = Array.from(mapNeg.values()).reduce((acc, item) => acc + item.value, 0);
  const totalPositivo = Array.from(mapPos.values()).reduce((acc, item) => acc + item.value, 0);
  const total = totalNegativo + totalPositivo;
  const percent = (value: number, totalRef: number) => (totalRef ? Math.round((value / totalRef) * 100) : 0);

  const allKeys = new Set([...mapNeg.keys(), ...mapPos.keys()]);
  const rowsGeral = Array.from(allKeys)
    .map((key) => {
      const neg = mapNeg.get(key)?.value ?? 0;
      const pos = mapPos.get(key)?.value ?? 0;
      const label = mapNeg.get(key)?.label ?? mapPos.get(key)?.label ?? key;
      return {
        key,
        label,
        value: neg + pos,
        pct: percent(neg + pos, total),
        positivo: pos,
        negativo: neg,
      };
    })
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  return {
    total,
    totalNegativo,
    totalPositivo,
    pctNegativo: percent(totalNegativo, total),
    pctPositivo: percent(totalPositivo, total),
    resultado,
    rowsGeral,
  };
}

function buildSinteseClinica(report: EvolutivoDocxReport) {
  const desempenhoResumo = buildDesempenhoResumo(report.evolucoes);
  const comportamentoResumo = buildComportamentoResumo(report);
  const lines: string[] = [];

  lines.push(
    `Paciente acompanhado no periodo de ${fmtDate(report.periodo.from)} a ${fmtDate(report.periodo.to)}, com ${report.indicadores.totalAtendimentos} atendimento(s) registrado(s) e taxa de presenca de ${report.indicadores.taxaPresencaPercent}%.`
  );

  if (report.resumoAutomatico?.texto) {
    lines.push(...report.resumoAutomatico.texto.split("\n").map((line) => line.trim()).filter(Boolean));
  }

  if (desempenhoResumo.total) {
    const topSkill = desempenhoResumo.rowsBySkill[0];
    if (topSkill) {
      lines.push(
        `A habilidade com maior volume de avaliacao foi ${topSkill.label}, com ${topSkill.total} registro(s) e ${topSkill.pctIndependente}% de respostas independentes.`
      );
    }
  }

  if (comportamentoResumo.total) {
    const topBehavior = comportamentoResumo.rowsGeral[0];
    lines.push(
      `Foram consolidados ${comportamentoResumo.total} registro(s) comportamentais, sendo ${comportamentoResumo.totalPositivo} positivo(s) e ${comportamentoResumo.totalNegativo} negativo(s).`
    );
    if (topBehavior) {
      lines.push(
        `Comportamento com maior recorrencia no periodo: ${topBehavior.label} (${topBehavior.value} ocorrencia(s)).`
      );
    }
  }

  return {
    lines,
    desempenhoResumo,
    comportamentoResumo,
  };
}

function sectionTitle(title: string) {
  return new Paragraph({
    text: title,
    heading: HeadingLevel.HEADING_2,
    thematicBreak: true,
    spacing: { before: 280, after: 140 },
  });
}

function bodyParagraph(text: string) {
  return new Paragraph({
    text,
    spacing: { after: 120 },
  });
}

function bulletParagraph(text: string) {
  return new Paragraph({
    text,
    bullet: { level: 0 },
    spacing: { after: 80 },
  });
}

export async function buildEvolutivoDocx(report: EvolutivoDocxReport): Promise<Buffer> {
  const { lines, desempenhoResumo, comportamentoResumo } = buildSinteseClinica(report);
  const topSkillRows = desempenhoResumo.rowsBySkill.slice(0, 8);
  const behaviorRows = comportamentoResumo.rowsGeral.slice(0, 10);
  const observacoes = report.destaques?.ultimasObservacoes ?? [];
  const motivosAusencia = report.destaques?.principaisMotivosAusencia ?? [];

  const children: Paragraph[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
      children: [
        new TextRun({
          text: "CLINICA GIRASSOIS",
          bold: true,
          size: 22,
          color: "A26F3C",
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 220 },
      children: [
        new TextRun({
          text: "RELATORIO DEVOLUTIVO INTERDISCIPLINAR",
          bold: true,
          size: 34,
          color: "4D392A",
        }),
      ],
    }),
    bodyParagraph(`Paciente: ${report.paciente.nome} (ID ${report.paciente.id})`),
    bodyParagraph(`CPF: ${report.paciente.cpf || "-"}`),
    bodyParagraph(`Periodo avaliado: ${fmtDate(report.periodo.from)} a ${fmtDate(report.periodo.to)}`),
    bodyParagraph(`Emissao: ${fmtNowPtBr()}`),
    sectionTitle("Sintese clinica do periodo"),
    ...lines.map((line) => bodyParagraph(line)),
    sectionTitle("Frequencia e continuidade assistencial"),
    bulletParagraph(`Total de atendimentos: ${report.indicadores.totalAtendimentos}`),
    bulletParagraph(`Presencas confirmadas: ${report.indicadores.presentes}`),
    bulletParagraph(`Ausencias registradas: ${report.indicadores.ausentes}`),
    bulletParagraph(`Sem informacao de presenca: ${report.indicadores.naoInformado}`),
    bulletParagraph(`Taxa de presenca: ${report.indicadores.taxaPresencaPercent}%`),
    bulletParagraph(`Tempo total registrado: ${report.indicadores.tempoTotalMinutos} minuto(s)`),
    bulletParagraph(`Media por sessao: ${report.indicadores.mediaMinutosPorSessao} minuto(s)`),
    bulletParagraph(`Primeiro atendimento no periodo: ${fmtDate(report.indicadores.primeiroAtendimento)}`),
    bulletParagraph(`Ultimo atendimento no periodo: ${fmtDate(report.indicadores.ultimoAtendimento)}`),
    sectionTitle("Intercorrencias e ausencias"),
  ];

  if (motivosAusencia.length) {
    children.push(...motivosAusencia.map((item) => bulletParagraph(`${item.motivo}: ${item.count} registro(s)`)));
  } else {
    children.push(bodyParagraph("Nao houve motivos de ausencia consolidados no periodo."));
  }

  children.push(sectionTitle("Habilidades com maior volume de registro"));
  if (topSkillRows.length) {
    children.push(
      ...topSkillRows.map((item) =>
        bulletParagraph(
          `${item.label}: ${item.total} registro(s), ${item.pctIndependente}% independente, ${item.pctAjuda}% com ajuda, ${item.pctNaoFez}% nao fez.`
        )
      )
    );
  } else {
    children.push(bodyParagraph("Nao houve registros de desempenho no periodo selecionado."));
  }

  children.push(sectionTitle("Comportamentos observados"));
  if (comportamentoResumo.total) {
    children.push(bodyParagraph(`Total de registros comportamentais: ${comportamentoResumo.total}.`));
    children.push(
      bodyParagraph(
        `Distribuicao geral: ${comportamentoResumo.totalPositivo} positivo(s) (${comportamentoResumo.pctPositivo}%) e ${comportamentoResumo.totalNegativo} negativo(s) (${comportamentoResumo.pctNegativo}%).`
      )
    );
    children.push(...behaviorRows.map((item) => bulletParagraph(`${item.label}: ${item.value} ocorrencia(s).`)));
  } else {
    children.push(bodyParagraph("Nao houve registros comportamentais consolidados no periodo."));
  }

  children.push(sectionTitle("Observacoes clinicas selecionadas"));
  if (observacoes.length) {
    children.push(
      ...observacoes.map((item) =>
        bulletParagraph(`${fmtDate(item.data)} | ${item.terapeuta_nome || "Terapeuta"} | ${item.texto}`)
      )
    );
  } else {
    children.push(bodyParagraph("Nao ha observacoes clinicas registradas para este recorte."));
  }

  const doc = new Document({
    creator: "Clinica Girassois",
    title: "Relatorio devolutivo interdisciplinar",
    description: "Exportacao DOCX do relatorio devolutivo interdisciplinar",
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 720,
              right: 720,
              bottom: 720,
              left: 720,
            },
          },
        },
        children,
      },
    ],
  });

  return Packer.toBuffer(doc);
}
