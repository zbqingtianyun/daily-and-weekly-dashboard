import daily from "@/data/daily.json";
import weekly from "@/data/weekly.json";
import catalog from "@/data/metric-catalog.json";
import metadata from "@/data/data-metadata.json";
import Dashboard from "@/components/dashboard";
import type { DashboardDataset, MetricDefinition, SnapshotMetadata } from "@/lib/types";

export default function Home() {
  return (
    <Dashboard
      daily={daily as DashboardDataset}
      weekly={weekly as DashboardDataset}
      catalog={catalog as MetricDefinition[]}
      metadata={metadata as SnapshotMetadata}
    />
  );
}

