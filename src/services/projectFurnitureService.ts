import { supabase } from "@/lib/supabase";
import type { ProjectFurniture, UUID } from "@/types";

/** All Supabase access for `project_furniture` (placed furniture
 * instances, as opposed to the shared catalog — see
 * furnitureCatalogService.ts) lives here. */

export async function listForProject(projectId: UUID): Promise<ProjectFurniture[]> {
  const { data, error } = await supabase
    .from("project_furniture")
    .select("*")
    .eq("project_id", projectId);

  if (error) throw error;
  return data ?? [];
}

export interface NewPlacementInput {
  furniture_item_id: UUID;
  room_id?: UUID | null;
  x: number;
  y: number;
  rotation?: number;
  custom_width?: number | null;
  custom_depth?: number | null;
}

export async function createPlacement(
  projectId: UUID,
  input: NewPlacementInput
): Promise<ProjectFurniture> {
  const { data, error } = await supabase
    .from("project_furniture")
    .insert({
      project_id: projectId,
      furniture_item_id: input.furniture_item_id,
      room_id: input.room_id ?? null,
      x: input.x,
      y: input.y,
      z: 0,
      rotation: input.rotation ?? 0,
      scale: 1,
      custom_width: input.custom_width ?? null,
      custom_depth: input.custom_depth ?? null,
      custom_height: null,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export interface PlacementGeometry {
  x: number;
  y: number;
  rotation: number;
  custom_width?: number | null;
  custom_depth?: number | null;
  room_id?: UUID | null;
}

export async function updatePlacement(
  placementId: UUID,
  geometry: PlacementGeometry
): Promise<void> {
  const patch: Record<string, unknown> = {
    x: geometry.x,
    y: geometry.y,
    rotation: geometry.rotation,
  };
  if (geometry.custom_width !== undefined) patch.custom_width = geometry.custom_width;
  if (geometry.custom_depth !== undefined) patch.custom_depth = geometry.custom_depth;
  if (geometry.room_id !== undefined) patch.room_id = geometry.room_id;

  const { error } = await supabase
    .from("project_furniture")
    .update(patch)
    .eq("id", placementId);

  if (error) throw error;
}

export async function deletePlacement(placementId: UUID): Promise<void> {
  const { error } = await supabase.from("project_furniture").delete().eq("id", placementId);
  if (error) throw error;
}
