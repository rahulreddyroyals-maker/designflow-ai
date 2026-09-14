import { supabase } from "@/lib/supabase";
import type {
  NewProjectInput,
  Project,
  ProjectSummary,
  UpdateProjectInput,
  UUID,
} from "@/types";

/**
 * Reference implementation of the service-layer pattern (CLAUDE.md §3.7).
 * UI components must never call `supabase.from(...)` directly — they call
 * a function here instead. This keeps query logic testable and in one
 * place per domain.
 */

export async function listProjectSummaries(
  companyId: UUID
): Promise<ProjectSummary[]> {
  const { data, error } = await supabase
    .from("projects")
    .select(
      `id, name, property_type, bhk, status, updated_at, clients ( name )`
    )
    .eq("company_id", companyId)
    .order("updated_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    id: row.id,
    name: row.name,
    client_name: row.clients?.name ?? null,
    property_type: row.property_type,
    bhk: row.bhk,
    status: row.status,
    updated_at: row.updated_at,
    thumbnail_url: null, // wired up once floor_plans/renders exist
  }));
}

export async function getProject(projectId: UUID): Promise<Project | null> {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function createProject(
  companyId: UUID,
  createdBy: UUID,
  input: NewProjectInput
): Promise<Project> {
  const { data, error } = await supabase
    .from("projects")
    .insert({
      company_id: companyId,
      created_by: createdBy,
      name: input.name,
      client_id: input.client_id ?? null,
      property_type: input.property_type,
      bhk: input.bhk ?? null,
      area_sqft: input.area_sqft ?? null,
      budget: input.budget ?? null,
      currency: input.currency,
      style: input.style ?? null,
      status: "draft",
      description: input.notes ?? null,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

/** Partial edit — used by the Project Detail page's "Edit project" dialog.
 * `undefined` fields are left untouched; explicit `null` clears a field. */
export async function updateProject(
  projectId: UUID,
  input: UpdateProjectInput
): Promise<Project> {
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.client_id !== undefined) patch.client_id = input.client_id;
  if (input.property_type !== undefined) patch.property_type = input.property_type;
  if (input.bhk !== undefined) patch.bhk = input.bhk;
  if (input.area_sqft !== undefined) patch.area_sqft = input.area_sqft;
  if (input.budget !== undefined) patch.budget = input.budget;
  if (input.style !== undefined) patch.style = input.style;
  if (input.notes !== undefined) patch.description = input.notes;

  const { data, error } = await supabase
    .from("projects")
    .update(patch)
    .eq("id", projectId)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function updateProjectStatus(
  projectId: UUID,
  status: Project["status"]
): Promise<void> {
  const { error } = await supabase
    .from("projects")
    .update({ status })
    .eq("id", projectId);

  if (error) throw error;
}

/** Hard delete. Every child table (floor_plans, rooms, project_furniture,
 * design_concepts, renders, client_presentations, ai_generations, ...) is
 * ON DELETE CASCADE from `projects` (see 0001_init.sql), so this genuinely
 * removes the whole project tree — surface a real confirmation in the UI
 * before calling this. */
export async function deleteProject(projectId: UUID): Promise<void> {
  const { error } = await supabase.from("projects").delete().eq("id", projectId);
  if (error) throw error;
}

export interface DashboardData {
  stats: { total: number; active: number; completed: number };
  recentProjects: ProjectSummary[];
}

const IN_PROGRESS_STATUSES: Project["status"][] = [
  "draft",
  "analysis",
  "designing",
  "review",
];
const COMPLETED_STATUSES: Project["status"][] = ["approved", "completed"];
const RECENT_PROJECTS_LIMIT = 5;

/** Powers the Dashboard's stat cards + recent-projects list. Computed
 * client-side from the summary list, which is fine at MVP scale — move to
 * a SQL aggregate (or a Postgres view) if company project counts grow
 * large enough that fetching every row becomes wasteful. */
export async function getDashboardData(companyId: UUID): Promise<DashboardData> {
  const summaries = await listProjectSummaries(companyId);

  const total = summaries.length;
  const active = summaries.filter((p) =>
    IN_PROGRESS_STATUSES.includes(p.status)
  ).length;
  const completed = summaries.filter((p) =>
    COMPLETED_STATUSES.includes(p.status)
  ).length;

  return {
    stats: { total, active, completed },
    recentProjects: summaries.slice(0, RECENT_PROJECTS_LIMIT),
  };
}
