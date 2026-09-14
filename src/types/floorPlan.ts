import type { BaseRecord, Point2D, UUID } from "./common";

export type FloorPlanFileType = "pdf" | "jpg" | "jpeg" | "png";

export type FloorPlanAnalysisStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "needs_review";

export interface FloorPlan extends BaseRecord {
  project_id: UUID;
  /** Path within the private `floor-plans` storage bucket — not a public
   * URL. Call floorPlanService.getFloorPlanPreviewUrl(floorPlan) to get a
   * short-lived signed URL for display. */
  storage_path: string;
  file_type: FloorPlanFileType;
  original_filename: string;
  width: number | null; // px, of the source image/render
  height: number | null;
  scale: number | null; // px-per-foot, once calibrated
  analysis_status: FloorPlanAnalysisStatus;
  /** Raw structured AI output for this floor plan — unverified. This is
   * NEVER treated as ground truth by itself (CLAUDE.md §4/§6): a detected
   * room only becomes a real `rooms` row, and a detected wall/door/window
   * only becomes a real `floor_plan_elements` row, once a designer
   * explicitly accepts it via the verification UI. */
  analysis_result: FloorPlanAnalysisResult | null;
}

export type FloorPlanElementType = "wall" | "door" | "window" | "column";

/** Which coordinate space an element's `points` are expressed in.
 * "image_percentage": 0-100 percentage of an uploaded floor plan image's
 * width/height (AI-detected, see FloorPlanAnalysisResult). "scene_feet":
 * real-world feet in the 2D Designer's canvas space, matching
 * `rooms.width/length/position_x/position_y`. These are never mixed —
 * always check this field before interpreting `points`. */
export type FloorPlanCoordinateSystem = "image_percentage" | "scene_feet";

export interface FloorPlanElement extends BaseRecord {
  project_id: UUID;
  /** Set only for AI-detected elements tied to a specific uploaded scan;
   * null for elements drawn directly on the 2D canvas. */
  floor_plan_id: UUID | null;
  room_id: UUID | null;
  element_type: FloorPlanElementType;
  coordinate_system: FloorPlanCoordinateSystem;
  /** Polyline describing the element. See `coordinate_system` for units. */
  points: Point2D[];
  width: number | null;
  height: number | null;
  metadata: Record<string, unknown> | null;
  /** Set when this row was created from an AI detection; null for
   * elements a designer draws by hand. */
  confidence_score: number | null;
  verified: boolean;
}

/**
 * Structured output contract for AI Task #1 (Floor Plan Understanding).
 * See CLAUDE.md §4 — this must be schema-validated before being persisted
 * to `floor_plans.analysis_result`, and is never written directly into
 * `rooms` / `floor_plan_elements` — only a designer's explicit "Accept"
 * action does that (see roomService / floorPlanElementService).
 *
 * Coordinate system: every point's x/y is a PERCENTAGE (0-100) of the
 * source image's width/height, not a pixel value. This lets the overlay
 * be positioned correctly at any display size without knowing the image's
 * native pixel dimensions.
 */
export interface FloorPlanAnalysisResult {
  rooms: DetectedRoom[];
  walls: DetectedWall[];
  doors: DetectedOpening[];
  windows: DetectedOpening[];
  dimensions: DetectedDimension[];
  confidence: number; // 0..1 overall
  warnings: string[];
}

export interface DetectedRoom {
  temp_id: string; // client-side id before it becomes a `rooms` row
  name: string;
  room_type: string;
  width_ft: number;
  length_ft: number;
  area_sqft: number;
  /** Percentage coordinates (0-100), see FloorPlanAnalysisResult doc. */
  polygon: Point2D[];
  confidence: number; // 0..1
  needs_verification: boolean;
}

export interface DetectedWall {
  temp_id: string;
  /** Percentage coordinates (0-100); usually 2 points (start/end) but may
   * be a longer polyline for an angled or L-shaped wall run. */
  points: Point2D[];
  confidence: number;
}

export interface DetectedOpening {
  temp_id: string;
  /** Percentage coordinates (0-100). */
  points: Point2D[];
  width_ft: number;
  room_ids: string[]; // temp_ids of adjoining rooms
  confidence: number;
}

export interface DetectedDimension {
  label: string;
  value_ft: number;
  /** Percentage coordinates (0-100) — the two (or more) points this
   * dimension spans. */
  points: Point2D[];
}
