import type { BaseRecord, UUID } from "./common";
import type { FloorPlanAnalysisResult } from "./floorPlan";
import type { PlacedFurniture } from "./furniture";

/**
 * AI provider abstraction. The frontend never talks to a provider directly
 * (see CLAUDE.md §5) — these types describe the contract the Edge Function
 * orchestrator exposes to the client, and that each ProviderAdapter must
 * fulfill internally.
 */
export type AIProvider = "claude" | "gemini" | "groq";

export type AITaskType =
  | "floor_plan_analysis"
  | "space_planning"
  | "design_consultant"
  | "budget_optimizer";

export type AIGenerationStatus = "queued" | "processing" | "completed" | "failed";

/** Row in `ai_generations` — every AI call is logged for auditability. */
export interface AIGeneration extends BaseRecord {
  project_id: UUID;
  task_type: AITaskType;
  provider: AIProvider;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  status: AIGenerationStatus;
  error: string | null;
}

// ---------------------------------------------------------------------------
// AI Task #1 — Floor Plan Understanding
// (FloorPlanAnalysisResult itself lives in floorPlan.ts, colocated with the
// FloorPlan/Room types it produces.)
// ---------------------------------------------------------------------------

export interface FloorPlanAnalysisRequest {
  floor_plan_id: UUID;
  /** Path in the private `floor-plans` bucket — the orchestrator's Edge
   * Function generates its own signed URL server-side to fetch the file,
   * since the client never has standing access to storage internals. */
  storage_path: string;
  file_type: "pdf" | "jpg" | "jpeg" | "png";
  project_context: {
    property_type: string;
    bhk: string | null;
    area_sqft: number | null;
  };
}

export type FloorPlanAnalysisResponse = FloorPlanAnalysisResult;

// ---------------------------------------------------------------------------
// AI Task #2 — Space Planning
// ---------------------------------------------------------------------------

export type SpacePlanningPriority = "space" | "storage" | "balanced";

export interface SpacePlanningRequest {
  room_id: UUID;
  room_geometry: {
    width: number;
    length: number;
    polygon?: { x: number; y: number }[];
  };
  /** Catalog item names the designer wants included — populated from the
   * real furniture_items catalog in the UI, not free text, so the AI has
   * an unambiguous, real set of items to choose from. */
  furniture_requirements: string[];
  style: string;
  priority: SpacePlanningPriority;
}

/**
 * A single placed item within an AI-proposed layout. Deliberately minimal:
 * no id, no roomId, no dimensions — the AI selects an EXISTING catalog
 * item by id and only proposes where to put it. Width/depth/name are
 * always read from the real furniture_items catalog when a layout is
 * applied, never trusted from the model's output (CLAUDE.md §4 — AI must
 * not invent dimensions).
 */
export interface SpacePlanningPlacedItem {
  furniture_item_id: UUID; // must match a real furniture_items row
  x: number; // ft, relative to the room's top-left corner
  y: number; // ft, relative to the room's top-left corner
  rotation: number; // degrees
}

export interface SpaceLayoutConcept {
  name: string; // e.g. "Space Optimized", "Storage Optimized", "Premium"
  description: string;
  items: SpacePlanningPlacedItem[];
}

export interface SpacePlanningResponse {
  layouts: SpaceLayoutConcept[];
}

// ---------------------------------------------------------------------------
// AI Task #3 — Design Consultant
// ---------------------------------------------------------------------------

export interface DesignConsultantRequest {
  room_id: UUID;
  dimensions: { width: number; length: number; ceiling_height: number | null };
  existing_furniture: PlacedFurniture[];
  style: string;
  budget: number | null;
  preferred_materials?: string[];
}

export interface DesignConsultantResponse {
  design_direction: string;
  color_palette: string[];
  materials: { category: string; suggestion: string }[];
  lighting: { type: string; color_temperature: string; notes: string }[];
  furniture_recommendations: string[];
  potential_issues: string[];
}

// ---------------------------------------------------------------------------
// AI Task #4 — Budget Optimizer
// ---------------------------------------------------------------------------

export interface BudgetOptimizerRequest {
  project_id: UUID;
  target_reduction: number; // absolute currency amount
  currency: string;
  constraints?: {
    preserve_style?: boolean;
    locked_item_ids?: UUID[]; // furniture/material ids the designer won't change
  };
}

export interface BudgetOptimizationSuggestion {
  type: "replace_material" | "modify_furniture" | "change_lighting" | "reduce_decor";
  target_id: UUID;
  target_label: string;
  current_cost: number | null;
  suggested_cost: number | null;
  estimated_savings: number;
  rationale: string;
}

export interface BudgetOptimizerResponse {
  target_reduction: number;
  achieved_estimate: number;
  suggestions: BudgetOptimizationSuggestion[];
  disclaimer: string; // must always state prices are estimates, not fabricated quotes
}

// ---------------------------------------------------------------------------
// Generic envelope every orchestrator response follows
// ---------------------------------------------------------------------------

export interface AITaskEnvelope<TOutput> {
  generation_id: UUID;
  provider: AIProvider;
  status: AIGenerationStatus;
  output: TOutput | null;
  error: string | null;
  /** True when the orchestrator returned a development fallback because no
   * provider was configured — see CLAUDE.md §7. Never true in production. */
  is_dev_fallback: boolean;
}
