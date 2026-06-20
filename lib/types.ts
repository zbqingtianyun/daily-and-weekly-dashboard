export type MetricFormat = "integer" | "decimal" | "percent" | "currency" | "minutes";
export type MetricGroup = "growth" | "retention" | "engagement" | "revenue" | "camp" | "column" | "membership";

export interface MetricDefinition {
  key: string;
  label: string;
  group: MetricGroup;
  format: MetricFormat;
  unit: string;
  aggregation: "daily_value";
  maturityDays: number;
  description: string;
}

export interface DashboardRow {
  period: string;
  [key: string]: string | number | null;
}

export interface DashboardDataset {
  rows: DashboardRow[];
}

export interface SnapshotMetadata {
  generatedAt: string;
  sourceDatabase: string;
  sources: {
    daily: { table: string; rowCount: number; minPeriod: string; maxPeriod: string };
  };
  validation: { passed: boolean; warnings: string[] };
}

