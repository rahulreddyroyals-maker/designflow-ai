import { supabase } from "@/lib/supabase";
import type {
  FloorPlanCoordinateSystem,
  FloorPlanElement,
  FloorPlanElementType,
  Point2D,
  UUID,
} from "@/types";

/**
 * All Supabase access for `floor_plan_elements` lives here. Two distinct
 * uses share this table (see FloorPlanCoordinateSystem in floorPlan.ts):
 *   - AI-detected elements from Sprint 4's floor plan analysis
 *     (coordinate_system: "image_percentage", tied to a floor_plan_id)
 *   - 2D Designer canvas elements (coordinate_system: "scene_feet", tied
 *     only to a project_id)
 * Never mix the two — always filter by coordinate_system.
 */

export async function listElementsForFloorPlan(
  floorPlanId: UUID
): Promise<FloorPlanElement[]> {
  const { data, error } = await supabase
    .from("floor_plan_elements")
    .select("*")
    .eq("floor_plan_id", floorPlanId);

  if (error) throw error;
  return data ?? [];
}

/** The 2D Designer's canvas-native elements for a project (scene_feet
 * only — never returns AI-detection rows from an uploaded scan). */
export async function listSceneElementsForProject(
  projectId: UUID
): Promise<FloorPlanElement[]> {
  const { data, error } = await supabase
    .from("floor_plan_elements")
    .select("*")
    .eq("project_id", projectId)
    .eq("coordinate_system", "scene_feet");

  if (error) throw error;
  return data ?? [];
}

export interface NewElementInput {
  element_type: FloorPlanElementType;
  points: Point2D[];
  width?: number;
  confidence_score?: number;
}

/** Inserts many elements at once — used by the Floor Plan Analyzer's
 * "Accept structure" bulk action (Sprint 4). Always writes
 * coordinate_system: "image_percentage" and a floor_plan_id, since bulk
 * acceptance only happens for AI detections tied to an uploaded scan. */
export async function bulkCreateElements(
  projectId: UUID,
  floorPlanId: UUID,
  elements: NewElementInput[]
): Promise<void> {
  if (elements.length === 0) return;

  const { error } = await supabase.from("floor_plan_elements").insert(
    elements.map((el) => ({
      project_id: projectId,
      floor_plan_id: floorPlanId,
      coordinate_system: "image_percentage" as const,
      element_type: el.element_type,
      points: el.points,
      width: el.width ?? null,
      confidence_score: el.confidence_score ?? null,
      verified: true,
    }))
  );

  if (error) throw error;
}

export interface NewSceneElementInput {
  element_type: FloorPlanElementType;
  points: Point2D[];
  width?: number;
}

/** Creates a single canvas-drawn element (scene_feet, no floor_plan_id) —
 * used by the 2D Designer when saving newly-drawn walls/doors/windows. */
export async function createSceneElement(
  projectId: UUID,
  input: NewSceneElementInput
): Promise<FloorPlanElement> {
  const { data, error } = await supabase
    .from("floor_plan_elements")
    .insert({
      project_id: projectId,
      floor_plan_id: null,
      coordinate_system: "scene_feet",
      element_type: input.element_type,
      points: input.points,
      width: input.width ?? null,
      verified: true,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function updateSceneElement(
  elementId: UUID,
  input: { points?: Point2D[]; width?: number }
): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (input.points !== undefined) patch.points = input.points;
  if (input.width !== undefined) patch.width = input.width;

  const { error } = await supabase
    .from("floor_plan_elements")
    .update(patch)
    .eq("id", elementId);

  if (error) throw error;
}

export async function deleteElement(elementId: UUID): Promise<void> {
  const { error } = await supabase.from("floor_plan_elements").delete().eq("id", elementId);
  if (error) throw error;
}
