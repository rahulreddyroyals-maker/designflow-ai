// Schema validation for AI Task #1 output. CLAUDE.md §4 requires AI JSON to
// be validated against a schema before it's saved — this is that schema.
// Mirrors src/types/floorPlan.ts's FloorPlanAnalysisResult; keep both in
// sync if either changes.

import { z } from "https://esm.sh/zod@3.23.8";

const pointSchema = z.object({ x: z.number(), y: z.number() });

const detectedRoomSchema = z.object({
  temp_id: z.string(),
  name: z.string(),
  room_type: z.string(),
  width_ft: z.number(),
  length_ft: z.number(),
  area_sqft: z.number(),
  polygon: z.array(pointSchema).min(3),
  confidence: z.number().min(0).max(1),
  needs_verification: z.boolean(),
});

const detectedWallSchema = z.object({
  temp_id: z.string(),
  points: z.array(pointSchema).min(2),
  confidence: z.number().min(0).max(1),
});

const detectedOpeningSchema = z.object({
  temp_id: z.string(),
  points: z.array(pointSchema).min(2),
  width_ft: z.number(),
  room_ids: z.array(z.string()),
  confidence: z.number().min(0).max(1),
});

const detectedDimensionSchema = z.object({
  label: z.string(),
  value_ft: z.number(),
  points: z.array(pointSchema).min(2),
});

export const floorPlanAnalysisResultSchema = z.object({
  rooms: z.array(detectedRoomSchema),
  walls: z.array(detectedWallSchema),
  doors: z.array(detectedOpeningSchema),
  windows: z.array(detectedOpeningSchema),
  dimensions: z.array(detectedDimensionSchema),
  confidence: z.number().min(0).max(1),
  warnings: z.array(z.string()),
});

export type FloorPlanAnalysisResult = z.infer<typeof floorPlanAnalysisResultSchema>;

// ---------------------------------------------------------------------------
// AI Task #2 — Space Planning
// ---------------------------------------------------------------------------

const spacePlacedItemSchema = z.object({
  furniture_item_id: z.string(),
  x: z.number(),
  y: z.number(),
  rotation: z.number(),
});

const spaceLayoutConceptSchema = z.object({
  name: z.string(),
  description: z.string(),
  items: z.array(spacePlacedItemSchema),
});

export const spacePlanningResponseSchema = z.object({
  layouts: z.array(spaceLayoutConceptSchema).min(1).max(4),
});

export type SpacePlanningResponse = z.infer<typeof spacePlanningResponseSchema>;
