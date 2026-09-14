import { useEffect, useState } from "react";
import { FileWarning } from "lucide-react";
import * as floorPlanService from "@/services/floorPlanService";
import type { FloorPlan, FloorPlanAnalysisResult, Point2D } from "@/types";
import { Skeleton } from "@/components/ui/skeleton";

interface FloorPlanAnalysisOverlayProps {
  floorPlan: FloorPlan;
  analysis: FloorPlanAnalysisResult;
}

const ROOM_FILL = "rgba(37, 99, 235, 0.22)";
const ROOM_STROKE = "rgb(37, 99, 235)";
const WALL_STROKE = "rgb(30, 41, 59)";
const DOOR_STROKE = "rgb(217, 119, 6)";
const WINDOW_STROKE = "rgb(5, 150, 105)";

function toPolygonPoints(points: Point2D[]): string {
  return points.map((p) => `${p.x},${p.y}`).join(" ");
}

function centroid(points: Point2D[]): Point2D {
  const n = points.length;
  const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), {
    x: 0,
    y: 0,
  });
  return { x: sum.x / n, y: sum.y / n };
}

/**
 * Renders the floor plan image with an SVG overlay of AI-detected rooms,
 * walls, doors, and windows. All detection coordinates are percentages
 * (0-100) of image width/height (see FloorPlanAnalysisResult), so the
 * overlay's viewBox is a fixed "0 0 100 100" regardless of the image's
 * actual pixel dimensions — the wrapper's aspect-ratio is set to the
 * image's real aspect ratio once it loads, so image and overlay always
 * align exactly without distortion.
 */
export function FloorPlanAnalysisOverlay({
  floorPlan,
  analysis,
}: FloorPlanAnalysisOverlayProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);
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
    return <Skeleton className="h-96 w-full" />;
  }

  return (
    <div className="space-y-3">
      <div
        className="relative w-full overflow-hidden rounded-md border bg-muted"
        style={aspectRatio ? { aspectRatio } : { minHeight: "24rem" }}
      >
        <img
          src={url}
          alt={floorPlan.original_filename}
          className="absolute inset-0 h-full w-full object-fill"
          onLoad={(e) => {
            const img = e.currentTarget;
            if (img.naturalWidth && img.naturalHeight) {
              setAspectRatio(img.naturalWidth / img.naturalHeight);
            }
          }}
        />
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full"
        >
          {analysis.rooms.map((room) => {
            const c = room.polygon.length > 0 ? centroid(room.polygon) : null;
            return (
              <g key={room.temp_id}>
                <polygon
                  points={toPolygonPoints(room.polygon)}
                  fill={ROOM_FILL}
                  stroke={ROOM_STROKE}
                  strokeWidth={0.3}
                />
                {c && (
                  <text
                    x={c.x}
                    y={c.y}
                    fontSize={2.6}
                    textAnchor="middle"
                    fill={ROOM_STROKE}
                    className="font-medium"
                  >
                    {room.name}
                  </text>
                )}
              </g>
            );
          })}
          {analysis.walls.map((wall) => (
            <polyline
              key={wall.temp_id}
              points={toPolygonPoints(wall.points)}
              fill="none"
              stroke={WALL_STROKE}
              strokeWidth={0.6}
              strokeLinecap="round"
            />
          ))}
          {analysis.doors.map((door) => (
            <polyline
              key={door.temp_id}
              points={toPolygonPoints(door.points)}
              fill="none"
              stroke={DOOR_STROKE}
              strokeWidth={0.9}
              strokeLinecap="round"
            />
          ))}
          {analysis.windows.map((win) => (
            <polyline
              key={win.temp_id}
              points={toPolygonPoints(win.points)}
              fill="none"
              stroke={WINDOW_STROKE}
              strokeWidth={0.9}
              strokeLinecap="round"
            />
          ))}
        </svg>
      </div>

      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <LegendItem color={ROOM_STROKE} label="Room" />
        <LegendItem color={WALL_STROKE} label="Wall" />
        <LegendItem color={DOOR_STROKE} label="Door" />
        <LegendItem color={WINDOW_STROKE} label="Window" />
      </div>
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}
