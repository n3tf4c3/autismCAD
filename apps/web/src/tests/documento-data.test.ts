import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

const { loadSource } = createRequire(import.meta.url)("../../../../scripts/testing/load-source.cjs");

for (const status of ["Rascunho", "Finalizado"]) {
  for (const createdAt of [new Date("2026-10-05T15:00:00.000Z"), "2026-10-05T15:00:00.000Z"]) {
    test(`plano de ensino ${status}: exibe o ano completo de createdAt ${typeof createdAt}`, async () => {
      const page = await loadSource("apps/web/src/app/(protected)/prontuario/documento/[id]/page.tsx", {
        "next/link": { default: "a" },
        "@/lib/env": { env: { APP_TIMEZONE: "America/Cuiaba" } },
        "@/server/auth/auth": { requirePermission: async () => ({ user: { id: 1 }, access: {} }) },
        "@/server/auth/access": { hasPermission: () => false },
        "@/server/auth/paciente-access": { assertPacienteAccess: async () => {} },
        "@/app/(protected)/prontuario/documento/[id]/documento-actions.client": {
          DocumentoActionsClient: () => null,
        },
        "@/server/modules/prontuario/prontuario.service": {
          obterDocumento: async () => ({
            id: 7,
            pacienteId: 1,
            tipo: "PLANO_ENSINO",
            titulo: "Plano de Ensino - Psicologia",
            status,
            createdAt,
            autorNome: "Sintético",
            payload: {
              especialidade: "Psicologia",
              responsavelTecnico: "Técnica sintética",
              dataInicio: "2026-10-01",
              dataFinal: "2026-12-01",
              blocos: [],
            },
          }),
        },
      });

      const html = renderToStaticMarkup(await page.default({ params: Promise.resolve({ id: "7" }) }));
      assert.match(html, /Data: 05\/10\/2026/);
      assert.doesNotMatch(html, /05\/10\/2001/);
      assert.match(html, /01\/10\/2026/);
      assert.match(html, /01\/12\/2026/);
      assert.match(html, /Responsável Técnico\(a\)/);
      assert.match(html, /Técnica sintética/);
    });
  }
}
