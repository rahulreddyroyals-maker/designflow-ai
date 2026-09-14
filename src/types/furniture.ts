import type { BaseRecord, UUID } from "./common";

export type FurnitureCategory =
  | "living"
  | "bedroom"
  | "dining"
  | "kitchen"
  | "lighting"
  | "storage"
  | "other";

/** Master catalog entry — company-agnostic (or company-scoped custom items
 * later; MVP treats this as a shared/global catalog). */
export interface FurnitureItem extends BaseRecord {
  name: string;
  category: FurnitureCategory;
  subcategory: string | null;
  width: number; // cm
  depth: number; // cm
  height: number; // cm
  thumbnail_url: string | null;
  model_url: string | null; // future: glTF for 3D
  metadata: Record<string, unknown> | null;
}

/**
 * A furniture item placed into a specific room of a specific project.
 * This is the structured object referenced throughout CLAUDE.md — the
 * canonical "reconstruct the design from data" record.
 */
export interface ProjectFurniture extends BaseRecord {
  project_id: UUID;
  /** Null when the furniture isn't placed inside any verified room — a
   * hallway piece, or furniture placed before rooms exist. */
  room_id: UUID | null;
  furniture_item_id: UUID;
  x: number;
  y: number;
  z: number;
  rotation: number; // degrees
  scale: number; // 1.0 = default size
  custom_width: number | null;
  custom_depth: number | null;
  custom_height: number | null;
  material_id: UUID | null;
}

/** Lightweight shape used on the 2D canvas (Konva), joined with catalog
 * data so the canvas doesn't need a separate lookup per render. */
export interface PlacedFurniture {
  id: UUID;
  roomId: UUID | null;
  furnitureItemId: UUID;
  furnitureType: string; // denormalized FurnitureItem.name for display
  x: number;
  y: number;
  rotation: number;
  width: number;
  depth: number;
  height: number;
  materialId: UUID | null;
}
