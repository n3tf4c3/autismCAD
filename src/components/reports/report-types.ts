export type ReportSummaryTone = "neutral" | "brand" | "success" | "warning" | "danger";

export type ReportSummaryCardItem = {
  label: string;
  value: number | string;
  description?: string;
  tone?: ReportSummaryTone;
};

export type ReportSectionTabItem = {
  id: string;
  label: string;
  badge?: number | string;
};

export type SkillPerformanceRow = {
  key: string;
  label: string;
  total: number;
  ajuda: number;
  nao_fez: number;
  independente: number;
  pctAjuda: number;
  pctNaoFez: number;
  pctIndependente: number;
};

export type DailyDistributionRow = {
  date: string;
  total: number;
  ajuda: number;
  nao_fez: number;
  independente: number;
  pctAjuda: number;
  pctNaoFez: number;
  pctIndependente: number;
};

export type RecentFeedbackItem = {
  id: string;
  dateLabel: string;
  professional: string;
  origin: string;
  text: string;
};
