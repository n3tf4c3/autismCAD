import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { PDFDocument } from "pdf-lib";
const { loadSource } = createRequire(import.meta.url)("../../../../scripts/testing/load-source.cjs");

test("#152 PDF real incorpora fontes, preserva Unicode e quebra textos extensos", async () => {
  const { buildEvolutivoPdf } = await loadSource("apps/web/src/server/modules/relatorios/evolutivo-pdf.ts", { "@/lib/env": { env: { APP_TIMEZONE: "America/Cuiaba" } } });
  const text = "João, ação, evolução; α β ≥ ≤; emoji 🧩 e ideograma 漢. ";
  const report = {
    paciente: { id: 1, nome: "PACIENTE SINTÉTICO — NÃO É UM PRONTUÁRIO REAL", cpf: "00000000000" },
    periodo: { from: "2026-09-01", to: "2026-09-05" },
    indicadores: { totalAtendimentos: 8, presentes: 8, ausentes: 0, naoInformado: 0, taxaPresencaPercent: 100, tempoTotalMinutos: 400, mediaMinutosPorSessao: 50, primeiroAtendimento: null, ultimoAtendimento: null },
    destaques: { ultimasObservacoes: [{ data: "2026-09-05", profissional_nome: "Profissional sintético", texto: text.repeat(6) + "X".repeat(240) }], principaisMotivosAusencia: [] },
    resumoAutomatico: { texto: text.repeat(8), regrasDisparadas: ["SOMENTE TESTE"] },
    atendimentos: Array.from({ length: 8 }, () => ({ data: "2026-09-05", profissional_nome: "Teste", presenca: "Presente", duracao_min: 50, observacoes: text.repeat(6), resumo_repasse: null, motivo: null })),
  };
  const bytes = await buildEvolutivoPdf(report);
  assert.ok(bytes.length > 10000);
  const pdf = await PDFDocument.load(bytes);
  assert.ok(pdf.getPageCount() >= 2);
  for (const page of pdf.getPages()) assert.equal(Math.round(page.getWidth()), 595);
  if (process.env.AUDIT_EVIDENCE_DIR) {
    await mkdir(process.env.AUDIT_EVIDENCE_DIR, { recursive: true });
    await writeFile(join(process.env.AUDIT_EVIDENCE_DIR, "pdf-unicode-sintetico.pdf"), bytes);
  }
});
