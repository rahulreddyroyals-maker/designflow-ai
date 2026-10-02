import { supabase } from "@/lib/supabase";
import type {
  Material,
  MaterialInput,
  ProjectMaterial,
  ProjectMaterialWithDetails,
  UUID,
} from "@/types";

/** All Supabase access for `materials` (the company-wide library) and
 * `project_materials` (which of those a project has picked, optionally
 * scoped to a room) lives here — pages never query these tables directly.
 *
 * Both tables already have RLS from 0001_init.sql ("materials: member all",
 * "project_materials: via project") — no new migration needed for this
 * feature, it's frontend + service layer only. */

// ---------------------------------------------------------------------------
// Company-wide materials library
// ---------------------------------------------------------------------------

export async function listMaterialsForCompany(companyId: UUID): Promise<Material[]> {
  const { data, error } = await supabase
    .from("materials")
    .select("*")
    .eq("company_id", companyId)
    .order("name", { ascending: true });

  if (error) throw error;
  return (data ?? []) as unknown as Material[];
}

export async function createMaterial(
  companyId: UUID,
  input: MaterialInput
): Promise<Material> {
  const { data, error } = await supabase
    .from("materials")
    .insert({
      company_id: companyId,
      name: input.name,
      category: input.category,
      brand: input.brand ?? null,
      product_code: input.product_code ?? null,
      color: input.color ?? null,
      finish: input.finish ?? null,
      price_per_unit: input.price_per_unit ?? null,
      unit: input.unit ?? null,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as unknown as Material;
}

export async function updateMaterial(
  materialId: UUID,
  input: MaterialInput
): Promise<Material> {
  const { data, error } = await supabase
    .from("materials")
    .update({
      name: input.name,
      category: input.category,
      brand: input.brand ?? null,
      product_code: input.product_code ?? null,
      color: input.color ?? null,
      finish: input.finish ?? null,
      price_per_unit: input.price_per_unit ?? null,
      unit: input.unit ?? null,
    })
    .eq("id", materialId)
    .select("*")
    .single();

  if (error) throw error;
  return data as unknown as Material;
}

/** Deleting a library material also removes it from any project board it
 * was added to — `project_materials.material_id` has no explicit FK action
 * in 0001_init.sql (defaults to RESTRICT), so a material still referenced
 * by a project board must be removed from those boards first, or this
 * throws a real foreign-key violation rather than silently orphaning
 * anything. The UI surfaces that error rather than hiding it. */
export async function deleteMaterial(materialId: UUID): Promise<void> {
  const { error } = await supabase.from("materials").delete().eq("id", materialId);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Per-project material board
// ---------------------------------------------------------------------------

export async function listProjectMaterials(
  projectId: UUID
): Promise<ProjectMaterialWithDetails[]> {
  const { data, error } = await supabase
    .from("project_materials")
    .select("*, material:materials(*), room:rooms(name)")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return ((data ?? []) as unknown as (ProjectMaterial & {
    material: Material;
    room: { name: string } | null;
  })[]).map((row) => ({
    ...row,
    room_name: row.room?.name ?? null,
  }));
}

export async function addMaterialToProject(
  projectId: UUID,
  materialId: UUID,
  roomId: UUID | null,
  notes: string | null
): Promise<ProjectMaterial> {
  const { data, error } = await supabase
    .from("project_materials")
    .insert({
      project_id: projectId,
      material_id: materialId,
      room_id: roomId,
      notes: notes || null,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as unknown as ProjectMaterial;
}

export async function updateProjectMaterial(
  projectMaterialId: UUID,
  input: { room_id: UUID | null; notes: string | null }
): Promise<ProjectMaterial> {
  const { data, error } = await supabase
    .from("project_materials")
    .update({ room_id: input.room_id, notes: input.notes || null })
    .eq("id", projectMaterialId)
    .select("*")
    .single();

  if (error) throw error;
  return data as unknown as ProjectMaterial;
}

export async function removeMaterialFromProject(projectMaterialId: UUID): Promise<void> {
  const { error } = await supabase
    .from("project_materials")
    .delete()
    .eq("id", projectMaterialId);

  if (error) throw error;
}
