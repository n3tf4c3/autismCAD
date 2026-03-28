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

export type PlanoEnsinoReport = {
  paciente: {
    id: number;
    nome: string;
    cpf: string | null;
    dataNascimento: string | null;
  };
  periodo: { from: string; to: string };
  desempenhoEnsino: Array<{
    evolucaoId: number;
    data: string;
    ensino: string | null;
    desempenho: "ajuda" | "nao_fez" | "independente" | null;
    ajuda: string | null;
    tentativas: number;
    acertos: number;
  }>;
};

function fmtDate(value?: string | null): string {
  if (!value) return "-";
  const dateOnly = String(value).slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) {
    return `${dateOnly.slice(8, 10)}/${dateOnly.slice(5, 7)}/${dateOnly.slice(0, 4)}`;
  }
  const d = new Date(String(value));
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

function fmtMonth(ym: string): string {
  if (!/^\d{4}-\d{2}$/.test(ym)) return ym;
  const [y, m] = ym.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: env.APP_TIMEZONE });
}

function fmtPeriodLabel(from?: string | null, to?: string | null): string {
  if (!from || !to) return "periodo selecionado";
  const fromMonth = from.slice(0, 7);
  const toMonth = to.slice(0, 7);
  if (fromMonth === toMonth) return fmtMonth(fromMonth);
  return `${fmtMonth(fromMonth)} a ${fmtMonth(toMonth)}`;
}

function desempenhoLabel(value: "ajuda" | "nao_fez" | "independente" | null): string {
  if (value === "nao_fez") return "Nao faz";
  if (value === "ajuda") return "Ajuda";
  if (value === "independente") return "Independente";
  return "-";
}

function sectionTitle(text: string) {
  return new Paragraph({
    text,
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
    spacing: { after: 90 },
  });
}

export async function buildPlanoEnsinoDocx(report: PlanoEnsinoReport): Promise<Buffer> {
  const rows = report.desempenhoEnsino ?? [];
  const counters = rows.reduce(
    (acc, row) => {
      if (row.desempenho === "nao_fez") acc.naoFez += 1;
      if (row.desempenho === "ajuda") acc.ajuda += 1;
      if (row.desempenho === "independente") acc.independente += 1;
      return acc;
    },
    { naoFez: 0, ajuda: 0, independente: 0 }
  );

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
          text: "RELATORIO DE PLANO DE ENSINO",
          bold: true,
          size: 34,
          color: "4D392A",
        }),
      ],
    }),
    bodyParagraph(`Paciente: ${report.paciente.nome}`),
    bodyParagraph(`Periodo avaliado: ${fmtPeriodLabel(report.periodo.from, report.periodo.to)}`),
    bodyParagraph(`Recorte: ${fmtDate(report.periodo.from)} a ${fmtDate(report.periodo.to)}`),
    bodyParagraph(`Emissao: ${fmtNowPtBr()}`),
    sectionTitle("Desempenho do ensino"),
    bodyParagraph(
      "Consolidado a partir das evolucoes do periodo com foco em desempenho, tipo de ajuda, tentativas e acertos."
    ),
    bodyParagraph(
      "Legenda de ajuda: MOD - Modelo | INS - Instrucao | SV - Suporte Verbal | SVG - Suporte Verbal Gestual | SG - Suporte Gestual | SFP - Suporte Fisico Parcial | SFT - Suporte Fisico Total"
    ),
  ];

  if (!rows.length) {
    children.push(bodyParagraph("Sem evolucoes com metas de desempenho no periodo selecionado."));
  } else {
    children.push(
      bulletParagraph(`Registros consolidados: ${rows.length}`),
      bulletParagraph(`Nao faz: ${counters.naoFez}`),
      bulletParagraph(`Ajuda: ${counters.ajuda}`),
      bulletParagraph(`Independencia: ${counters.independente}`),
      sectionTitle("Registros detalhados")
    );

    rows.forEach((row) => {
      children.push(
        bodyParagraph(
          `${fmtDate(row.data)} | Ensino: ${row.ensino || "-"} | Desempenho: ${desempenhoLabel(row.desempenho)} | Ajuda: ${row.ajuda || "-"} | Tentativas: ${row.tentativas} | Acertos: ${row.acertos}`
        )
      );
    });
  }

  const doc = new Document({
    creator: "Clinica Girassois",
    title: "Relatorio de plano de ensino",
    description: "Exportacao DOCX do relatorio de plano de ensino",
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
