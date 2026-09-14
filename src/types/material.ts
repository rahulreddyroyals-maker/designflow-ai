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
