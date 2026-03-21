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
  resumo: {
    totalPlanos: number;
    totalBlocos: number;
    status: Array<{ label: string; total: number }>;
    especialidades: Array<{ label: string; total: number }>;
    ultimoPlano:
      | {
          id: number;
          version: number;
          status: string;
          titulo: string;
          especialidade: string | null;
          dataInicio: string | null;
          dataFinal: string | null;
          totalBlocos: number;
          autorNome: string;
          createdAt: string | null;
          updatedAt: string | null;
        }
      | null;
  };
  planos: Array<{
    id: number;
    version: number;
    status: string;
    titulo: string;
    especialidade: string | null;
    dataInicio: string | null;
    dataFinal: string | null;
    totalBlocos: number;
    autorNome: string;
    createdAt: string | null;
    updatedAt: string | null;
    blocos: Array<{
      habilidade: string | null;
      ensino: string | null;
      objetivoEnsino: string | null;
      recursos: string | null;
      procedimento: string | null;
      suportes: string | null;
      objetivoEspecifico: string | null;
      criterioSucesso: string | null;
    }>;
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
  const latest = report.resumo.ultimoPlano;
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
    bodyParagraph(`Paciente: ${report.paciente.nome} (ID ${report.paciente.id})`),
    bodyParagraph(`CPF: ${report.paciente.cpf || "-"}`),
    bodyParagraph(`Periodo avaliado: ${fmtDate(report.periodo.from)} a ${fmtDate(report.periodo.to)}`),
    bodyParagraph(`Emissao: ${fmtNowPtBr()}`),
    sectionTitle("Resumo do periodo"),
    bulletParagraph(`Planos encontrados: ${report.resumo.totalPlanos}`),
    bulletParagraph(`Total de blocos: ${report.resumo.totalBlocos}`),
  ];

  if (latest) {
    children.push(
      bulletParagraph(
        `Ultimo plano: versao ${latest.version} (${latest.status}) - ${latest.especialidade || "Nao informado"}`
      )
    );
  }

  if (report.resumo.status.length) {
    children.push(bodyParagraph("Distribuicao por status:"));
    children.push(
      ...report.resumo.status.map((item) => bulletParagraph(`${item.label}: ${item.total}`))
    );
  }

  if (report.resumo.especialidades.length) {
    children.push(bodyParagraph("Especialidades com mais registros:"));
    children.push(
      ...report.resumo.especialidades
        .slice(0, 8)
        .map((item) => bulletParagraph(`${item.label}: ${item.total}`))
    );
  }

  children.push(sectionTitle("Planos de ensino consolidados"));

  if (!report.planos.length) {
    children.push(bodyParagraph("Nenhum plano de ensino encontrado para o periodo informado."));
  } else {
    report.planos.forEach((plano) => {
      children.push(
        bodyParagraph(
          `Plano #${plano.id} | Versao ${plano.version} | ${plano.status} | ${plano.especialidade || "Nao informado"}`
        )
      );
      children.push(
        bulletParagraph(`Titulo: ${plano.titulo || "Plano de Ensino"}`),
        bulletParagraph(`Autor: ${plano.autorNome || "Usuario"}`),
        bulletParagraph(`Inicio: ${fmtDate(plano.dataInicio)} | Fim: ${fmtDate(plano.dataFinal)}`),
        bulletParagraph(`Criado em: ${fmtDate(plano.createdAt)} | Atualizado em: ${fmtDate(plano.updatedAt)}`),
        bulletParagraph(`Total de blocos: ${plano.totalBlocos}`)
      );

      if (!plano.blocos.length) {
        children.push(bulletParagraph("Sem blocos preenchidos."));
      } else {
        plano.blocos.forEach((bloco, index) => {
          children.push(
            bulletParagraph(`Bloco ${index + 1}: ${bloco.habilidade || "Sem habilidade"}`),
            bulletParagraph(`Ensino: ${bloco.ensino || "-"}`),
            bulletParagraph(`Objetivo de ensino: ${bloco.objetivoEnsino || "-"}`),
            bulletParagraph(`Procedimento: ${bloco.procedimento || "-"}`),
            bulletParagraph(`Recursos: ${bloco.recursos || "-"}`),
            bulletParagraph(`Suportes: ${bloco.suportes || "-"}`),
            bulletParagraph(`Objetivo especifico: ${bloco.objetivoEspecifico || "-"}`),
            bulletParagraph(`Criterio de sucesso: ${bloco.criterioSucesso || "-"}`)
          );
        });
      }
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
