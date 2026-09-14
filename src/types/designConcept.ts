import type { BaseRecord, UUID } from "./common";

export type DesignConceptStatus = "draft" | "generated" | "selected" | "rejected";

export interface DesignConcept extends BaseRecord {
  project_id: UUID;
  room_id: UUID;
  name: string;
  style: string;
  description: string | null;
  color_palette: string[]; // hex codes or named swatches
  design_prompt: string | null; // the prompt/spec sent to the visual generator
  image_url: string | null;
  status: DesignConceptStatus;
}

export type RenderCameraView =
  | "living_view_1"
  | "living_view_2"
  | "wide_angle"
  | "feature_wall"
  | "custom";

export type RenderStatus = "queued" | "processing" | "completed" | "failed";

export interface Render extends BaseRecord {
  project_id: UUID;
  room_id: UUID;
  design_concept_id: UUID | null;
  camera_view: RenderCameraView;
  image_url: string | null;
  status: RenderStatus;
}
