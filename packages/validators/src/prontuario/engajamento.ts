import { z } from "zod";

// Engajamento das metas da evolucao: so admite Sim / Nao. Fica aqui para web,
// mobile e os relatorios usarem a mesma lista e a mesma normalizacao.
//
// O campo e o `opcao` do item de desempenho, que antes se chamava "Alvo" e
// guardava texto livre (o estimulo apresentado: "Vogais", "Bola"...). Registros
// anteriores ao rename continuam com esse conteudo; `normalizeEngajamento`
// devolve null para eles, e cabe a cada tela decidir o que fazer.

export const ENGAJAMENTO_VALUES = ["sim", "nao"] as const;
export const engajamentoValueSchema = z.enum(ENGAJAMENTO_VALUES);
export type EngajamentoValue = z.infer<typeof engajamentoValueSchema>;

export const ENGAJAMENTO_OPTIONS: ReadonlyArray<{ value: EngajamentoValue; label: string }> = [
  { value: "sim", label: "Sim" },
  { value: "nao", label: "Nao" },
];

export function normalizeEngajamento(value: unknown): EngajamentoValue | null {
  if (typeof value !== "string") return null;
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
  if (normalized === "sim" || normalized === "s") return "sim";
  if (normalized === "nao" || normalized === "n") return "nao";
  return null;
}
