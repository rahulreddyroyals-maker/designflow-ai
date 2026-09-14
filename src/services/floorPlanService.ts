import { supabase } from "@/lib/supabase";
import type { FloorPlan, UUID } from "@/types";

/**
 * Service layer for floor plan upload, retrieval, and storage. Analysis
 * itself will be triggered via aiService.analyzeFloorPlan() in a later
 * sprint — this file only owns storage and the `floor_plans` table row.
 *
 * The `floor-plans` bucket is private (see 0003_floor_plan_storage_security
 * .sql). Callers must use getFloorPlanPreviewUrl() to get a short-lived,
 * signed URL for display — `storage_path` alone is not browsable.
 */

const BUCKET = "floor-plans";
const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour — plenty for a page view

const ALLOWED_FILE_TYPES: FloorPlan["file_type"][] = ["pdf", "jpg", "jpeg", "png"];

export async function uploadFloorPlan(
  projectId: UUID,
  file: File
): Promise<FloorPlan> {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (!extension || !ALLOWED_FILE_TYPES.includes(extension as FloorPlan["file_type"])) {
    throw new Error("Floor plan must be a PDF, JPG, or PNG file.");
  }

  // Path's first segment is the project id — storage RLS uses this to
  // scope access to the project's company (see the migration above).
  const path = `${projectId}/${crypto.randomUUID()}-${file.name}`;

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file);
  if (uploadError) throw uploadError;

  const { data, error } = await supabase
    .from("floor_plans")
    .insert({
      project_id: projectId,
      storage_path: path,
      file_type: extension as FloorPlan["file_type"],
      original_filename: file.name,
      analysis_status: "pending",
    })
    .select("*")
    .single();

  if (error) {
    // Don't leave an orphaned file if the DB insert failed.
    await supabase.storage.from(BUCKET).remove([path]);
    throw error;
  }

  return data;
}

export async function getFloorPlan(floorPlanId: UUID): Promise<FloorPlan | null> {
  const { data, error } = await supabase
    .from("floor_plans")
    .select("*")
    .eq("id", floorPlanId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function listFloorPlansForProject(projectId: UUID): Promise<FloorPlan[]> {
  const { data, error } = await supabase
    .from("floor_plans")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

/** Generates a short-lived signed URL for displaying a floor plan. Call
 * this fresh each time you need to render one — don't cache the URL past
 * the current page view, since it expires. */
export async function getFloorPlanPreviewUrl(floorPlan: FloorPlan): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(floorPlan.storage_path, SIGNED_URL_TTL_SECONDS);

  if (error) throw error;
  return data.signedUrl;
}

export async function deleteFloorPlan(floorPlan: FloorPlan): Promise<void> {
  const { error: storageError } = await supabase.storage
    .from(BUCKET)
    .remove([floorPlan.storage_path]);
  if (storageError) throw storageError;

  const { error } = await supabase.from("floor_plans").delete().eq("id", floorPlan.id);
  if (error) throw error;
}
