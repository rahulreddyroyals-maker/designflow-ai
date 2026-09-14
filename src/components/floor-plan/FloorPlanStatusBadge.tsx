import { Badge } from "@/components/ui/badge";
import type { FloorPlanAnalysisStatus } from "@/types";

const STATUS_CONFIG: Record<
  FloorPlanAnalysisStatus,
  { label: string; variant: "default" | "warning" | "success" | "destructive" }
> = {
  pending: { label: "Pending analysis", variant: "default" },
  processing: { label: "Processing", variant: "warning" },
  completed: { label: "Analyzed", variant: "success" },
  failed: { label: "Analysis failed", variant: "destructive" },
  needs_review: { label: "Needs review", variant: "warning" },
};

export function FloorPlanStatusBadge({ status }: { status: FloorPlanAnalysisStatus }) {
  const config = STATUS_CONFIG[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
