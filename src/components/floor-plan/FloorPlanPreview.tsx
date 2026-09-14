import { useEffect, useState } from "react";
import { FileWarning } from "lucide-react";
import * as floorPlanService from "@/services/floorPlanService";
import type { FloorPlan } from "@/types";
import { Skeleton } from "@/components/ui/skeleton";

interface FloorPlanPreviewProps {
  floorPlan: FloorPlan;
  className?: string;
}

/** Fetches a fresh signed URL for the given floor plan and renders it —
 * an <img> for JPG/PNG, an <iframe> (native browser PDF viewer) for PDFs.
 * Re-fetches whenever the floor plan changes since signed URLs expire. */
export function FloorPlanPreview({ floorPlan, className }: FloorPlanPreviewProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setUrl(null);
    setError(null);

    floorPlanService
      .getFloorPlanPreviewUrl(floorPlan)
      .then((signedUrl) => {
        if (!cancelled) setUrl(signedUrl);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load preview.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [floorPlan.id, floorPlan.storage_path]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
        <FileWarning className="h-6 w-6" />
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  if (!url) {
    return <Skeleton className={className ?? "h-96 w-full"} />;
  }

  if (floorPlan.file_type === "pdf") {
    return (
      <iframe
        src={url}
        title={floorPlan.original_filename}
        className={className ?? "h-96 w-full rounded-md border"}
      />
    );
  }

  return (
    <img
      src={url}
      alt={floorPlan.original_filename}
      className={className ?? "w-full rounded-md border object-contain"}
    />
  );
}
