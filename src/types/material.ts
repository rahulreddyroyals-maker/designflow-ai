import type { BaseRecord, UUID } from "./common";

export type MaterialCategory =
  | "flooring"
  | "wall_paint"
  | "laminate"
  | "wood"
  | "fabric"
  | "glass"
  | "metal"
  | "lighting";

export interface Material extends BaseRecord {
  company_id: UUID;
  name: string;
  category: MaterialCategory;
  brand: string | null;
  product_code: string | null;
  color: string | null;
  finish: string | null;
  texture_url: string | null;
  price_per_unit: number | null;
  unit: string | null; // e.g. "sq.ft", "running ft", "piece"
  metadata: Record<string, unknown> | null;
}

export interface ProjectMaterial extends BaseRecord {
  project_id: UUID;
  room_id: UUID | null;
  material_id: UUID;
  notes: string | null;
}

/** Joined shape for the per-project materials board — the material's own
 * details plus (if assigned) the room's name, so the UI never has to do a
 * second round trip just to show "Living Room — Italian Marble". */
export interface ProjectMaterialWithDetails extends ProjectMaterial {
  material: Material;
  room_name: string | null;
}

export const MATERIAL_CATEGORY_LABELS: Record<MaterialCategory, string> = {
  flooring: "Flooring",
  wall_paint: "Wall Paint",
  laminate: "Laminate",
  wood: "Wood",
  fabric: "Fabric",
  glass: "Glass",
  metal: "Metal",
  lighting: "Lighting",
};

export const MATERIAL_CATEGORIES = Object.keys(
  MATERIAL_CATEGORY_LABELS
) as MaterialCategory[];

/** Form shape for creating/editing a library material. */
export interface MaterialInput {
  name: string;
  category: MaterialCategory;
  brand?: string | null;
  product_code?: string | null;
  color?: string | null;
  finish?: string | null;
  price_per_unit?: number | null;
  unit?: string | null;
}
