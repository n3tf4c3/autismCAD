import "server-only";

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type ClinicoReport = {
  paciente: { id: number; nome: string; cpf: string; convenio: string };
  periodo: { from: string; to: string };
  atendimentos: {
    total: number;
    presentes: number;
    ausentes: number;
    taxaPresenca: number;
    observacoes: Array<{
      data: string;
      hora_inicio: string;
      presenca: string;
      observacoes: string | null;
      motivo: string | null;
    }>;
  };
  anamnese: { version: number; status: string; created_at: string } | null;
};

function wrapText(text: string, maxWidth: number, measure: (t: string) => number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (measure(next) <= maxWidth) {
      cur = next;
      continue;
    }
    if (cur) lines.push(cur);
    cur = w;
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [""];
}

export async function buildClinicoPdf(report: ClinicoReport): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const pageSize: [number, number] = [595.28, 841.89];
  const margin = 40;
  const contentWidth = pageSize[0] - margin * 2;

  let page = pdf.addPage(pageSize);
  let y = pageSize[1] - margin;

  const line = (text: string, opts?: { bold?: boolean; size?: number }) => {
    const size = opts?.size ?? 11;
    page.drawText(text, {
      x: margin,
      y,
      size,
      font: opts?.bold ? fontBold : font,
      color: rgb(0.12, 0.12, 0.12),
    });
    y -= size + 4;
  };

  const ensure = (need: number) => {
    if (y - need > margin) return;
    page = pdf.addPage(pageSize);
    y = pageSize[1] - margin;
  };

  line("Clinica Girassois", { bold: true, size: 18 });
  line("RELATORIO CLINICO", { bold: true, size: 14 });
  line(`Emitido em ${new Date().toLocaleString("pt-BR")}`, { size: 10 });
  y -= 8;

  line(`Paciente: ${report.paciente.nome} (ID ${report.paciente.id})`, { bold: true });
  line(`CPF: ${report.paciente.cpf || "-"}   Convenio: ${report.paciente.convenio || "Particular"}`);
  line(`Periodo: ${report.periodo.from} a ${report.periodo.to}`);
  y -= 6;

  line("Atendimentos", { bold: true, size: 13 });
  line(
    `Total: ${report.atendimentos.total}  Presencas: ${report.atendimentos.presentes}  Faltas: ${report.atendimentos.ausentes}  Taxa: ${report.atendimentos.taxaPresenca}%`
  );
  y -= 6;

  line("Anamnese", { bold: true, size: 13 });
  if (report.anamnese) {
    line(`Versao ${report.anamnese.version} - ${report.anamnese.status || ""} - ${report.anamnese.created_at || ""}`);
  } else {
    line("Sem anamnese encontrada");
  }
  y -= 6;

  line("Observacoes recentes", { bold: true, size: 13 });
  if (!report.atendimentos.observacoes.length) {
    line("- Sem observacoes");
  } else {
    const measure = (t: string) => font.widthOfTextAtSize(t, 10);
    for (const o of report.atendimentos.observacoes) {
      const raw = `${o.data} ${o.hora_inicio} - ${o.presenca} - ${(o.observacoes || o.motivo || "-").trim()}`;
      const lines = wrapText(raw, contentWidth, measure);
      for (const l of lines) {
        ensure(16);
        page.drawText(l, { x: margin, y, size: 10, font });
        y -= 14;
      }
      y -= 2;
    }
  }

  return pdf.save();
}

