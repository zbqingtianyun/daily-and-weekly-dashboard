import type { DashboardRow, MetricDefinition, MetricFormat } from "./types";

export const KPI_KEYS = ["DAU", "活跃用户14日留存率", "平均单日使用时长（分）", "总付费人数", "总付费金额", "客单价"];

export function formatMetric(value: unknown, format: MetricFormat, compact = false) {
  if (value === null || value === undefined || value === "") return "暂无数据";
  const number = Number(value);
  if (!Number.isFinite(number)) return "暂无数据";
  if (format === "percent") return `${(number * 100).toFixed(1)}%`;
  if (format === "currency") {
    return new Intl.NumberFormat("zh-CN", {
      style: "currency",
      currency: "CNY",
      notation: compact ? "compact" : "standard",
      maximumFractionDigits: compact ? 1 : 0
    }).format(number);
  }
  if (format === "minutes") return `${number.toFixed(1)} 分`;
  return new Intl.NumberFormat("zh-CN", {
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: format === "integer" ? 0 : 1
  }).format(number);
}

export function delta(current: unknown, previous: unknown) {
  const now = Number(current);
  const before = Number(previous);
  if (!Number.isFinite(now) || !Number.isFinite(before) || before === 0) return null;
  return (now - before) / Math.abs(before);
}

export function conversionRate(current: unknown, previous: unknown) {
  if (current === null || current === undefined || current === "" || previous === null || previous === undefined || previous === "") return null;
  const numerator = Number(current);
  const denominator = Number(previous);
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return null;
  return numerator / denominator;
}

export function isMature(row: DashboardRow, latestPeriod: string, maturityDays: number) {
  if (!maturityDays) return true;
  const rowDate = new Date(`${row.period}T00:00:00`);
  const latest = new Date(`${latestPeriod}T00:00:00`);
  const elapsedDays = Math.floor((latest.getTime() - rowDate.getTime()) / 86400000);
  return elapsedDays >= maturityDays;
}

export function metricMap(catalog: MetricDefinition[]) {
  return new Map(catalog.map((metric) => [metric.key, metric]));
}

export function parseQueryDate(value: string | null, fallback: string) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : fallback;
}

