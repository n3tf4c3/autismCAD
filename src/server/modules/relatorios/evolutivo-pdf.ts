import "server-only";

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type EvolutivoReport = {
  paciente: { id: number; nome: string; cpf: string; convenio: string };
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
  destaques: {
    ultimasObservacoes: Array<{ data: string; terapeuta_nome: string; texto: string }>;
    principaisMotivosAusencia: Array<{ motivo: string; count: number }>;
  };
  resumoAutomatico: { texto: string; regrasDisparadas: string[] };
  atendimentos: Array<{
    data: string;
    terapeuta_nome: string | null;
    presenca: string;
    duracao_min: number;
    observacoes: string | null;
    resumo_repasse: string | null;
    motivo: string | null;
  }>;
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

export async function buildEvolutivoPdf(report: EvolutivoReport): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const pageSize: [number, number] = [595.28, 841.89]; // A4
  const margin = 40;
  const lineH = 14;

  let page = pdf.addPage(pageSize);
  let y = pageSize[1] - margin;

  const drawLine = (text: string, opts?: { bold?: boolean; size?: number; color?: ReturnType<typeof rgb> }) => {
    const size = opts?.size ?? 11;
    const f = opts?.bold ? fontBold : font;
    page.drawText(text, { x: margin, y, size, font: f, color: opts?.color });
    y -= size + 4;
  };

  const ensureSpace = (need: number) => {
    if (y - need > margin) return;
    page = pdf.addPage(pageSize);
    y = pageSize[1] - margin;
  };

  const contentWidth = pageSize[0] - margin * 2;

  drawLine("Clinica Girassois", { bold: true, size: 18, color: rgb(0.42, 0.27, 0.14) });
  drawLine("RELATORIO EVOLUTIVO", { bold: true, size: 14 });
  drawLine(`Emitido em ${new Date().toLocaleString("pt-BR")}`, { size: 10 });
  y -= 6;

  const p = report.paciente;
  const periodo = report.periodo;
  drawLine(`Paciente: ${p.nome} (ID ${p.id})`, { bold: true });
  drawLine(`CPF: ${p.cpf || "-"}   Convenio: ${p.convenio || "Particular"}`);
  drawLine(`Periodo: ${periodo.from} a ${periodo.to}`);
  y -= 8;

  const i = report.indicadores;
  drawLine("Indicadores", { bold: true, size: 13 });
  drawLine(
    `Total: ${i.totalAtendimentos}  Presencas: ${i.presentes}  Ausencias: ${i.ausentes}  Sem registro: ${i.naoInformado}`
  );
  drawLine(
    `Taxa de presenca: ${i.taxaPresencaPercent}%  Tempo total (min): ${i.tempoTotalMinutos}  Media (min): ${i.mediaMinutosPorSessao}`
  );
  y -= 6;

  drawLine("Resumo automatico", { bold: true, size: 13 });
  const resumo = String(report.resumoAutomatico?.texto || "").trim() || "-";
  const resumoLines = resumo.split("\n").flatMap((line) => {
    const measure = (t: string) => font.widthOfTextAtSize(t, 11);
    return wrapText(line, contentWidth, measure);
  });
  for (const l of resumoLines) {
    ensureSpace(lineH + 6);
    drawLine(l);
  }
  const regras = Array.isArray(report.resumoAutomatico?.regrasDisparadas)
    ? report.resumoAutomatico.regrasDisparadas.join(", ")
    : "-";
  ensureSpace(lineH + 6);
  drawLine(`Regras: ${regras}`, { size: 10 });
  y -= 6;

  drawLine("Ultimas observacoes", { bold: true, size: 13 });
  const obs = report.destaques?.ultimasObservacoes ?? [];
  if (!obs.length) {
    drawLine("- Sem observacoes registradas.");
  } else {
    for (const o of obs) {
      const prefix = `${o.data} - ${o.terapeuta_nome || "Terapeuta"}: `;
      const text = `${prefix}${o.texto || ""}`.trim();
      const measure = (t: string) => font.widthOfTextAtSize(t, 11);
      const lines = wrapText(text, contentWidth, measure);
      for (const l of lines) {
        ensureSpace(lineH + 6);
        drawLine(`- ${l}`);
      }
    }
  }
  y -= 6;

  drawLine("Principais motivos de ausencia", { bold: true, size: 13 });
  const motivos = report.destaques?.principaisMotivosAusencia ?? [];
  if (!motivos.length) {
    drawLine("- Sem faltas registradas.");
  } else {
    for (const m of motivos) {
      ensureSpace(lineH + 6);
      drawLine(`- ${m.motivo} (${m.count})`);
    }
  }
  y -= 6;

  drawLine("Atendimentos (resumo)", { bold: true, size: 13 });
  const atend = report.atendimentos ?? [];
  if (!atend.length) {
    drawLine("- Nenhum atendimento no periodo.");
  } else {
    for (const a of atend.slice(0, 40)) {
      const obsText = (a.observacoes || a.resumo_repasse || a.motivo || "").trim();
      const row = `${a.data} | ${(a.terapeuta_nome || "Terapeuta").trim()} | ${a.presenca} | ${a.duracao_min || 0} min | ${obsText}`;
      const measure = (t: string) => font.widthOfTextAtSize(t, 9);
      const lines = wrapText(row, contentWidth, measure);
      for (const l of lines) {
        ensureSpace(12);
        page.drawText(l, { x: margin, y, size: 9, font });
        y -= 12;
      }
      y -= 2;
    }
    if (atend.length > 40) {
      ensureSpace(lineH + 6);
      drawLine(`(Mostrando 40 de ${atend.length} atendimentos)`, { size: 9 });
    }
  }

  return pdf.save();
}
