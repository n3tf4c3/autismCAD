"use client";

import { SkillsGrid } from "@/components/reports/skills-grid";
import type { SkillPerformanceRow } from "@/components/reports/report-types";

export function DesempenhoPorHabilidadeChart(props: {
  rows: SkillPerformanceRow[];
  title?: string;
  subtitle?: string;
  emptyMessage: string;
}) {
  return (
    <SkillsGrid
      rows={props.rows}
      title={props.title ?? "Desempenho por habilidade"}
      subtitle={props.subtitle}
      emptyMessage={props.emptyMessage}
    />
  );
}
