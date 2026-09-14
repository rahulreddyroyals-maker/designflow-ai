import type { BaseRecord, CurrencyCode, ISODateString, UUID } from "./common";

export type PropertyType =
  | "apartment"
  | "villa"
  | "independent_house"
  | "office"
  | "retail"
  | "other";

/** e.g. "2BHK", "3BHK", "4BHK" — kept as a string rather than an enum since
 * designers use variants like "2.5BHK" or "3BHK + Study". */
export type BHKConfig = string;

export type ProjectStatus =
  | "draft"
  | "analysis"
  | "designing"
  | "review"
  | "approved"
  | "completed"
  | "archived";

export const PROJECT_STATUSES: ProjectStatus[] = [
  "draft",
  "analysis",
  "designing",
  "review",
  "approved",
  "completed",
  "archived",
];

export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  apartment: "Apartment",
  villa: "Villa",
  independent_house: "Independent House",
  office: "Office",
  retail: "Retail",
  other: "Other",
};

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  draft: "Draft",
  analysis: "Analysis",
  designing: "Designing",
  review: "Review",
  approved: "Approved",
  completed: "Completed",
  archived: "Archived",
};

/** Suggestions for the style input's <datalist> — not an enum, designers
 * can type anything. Keeps the field lightweight (no new dependency) while
 * still feeling guided. */
export const STYLE_SUGGESTIONS: string[] = [
  "Modern Luxury",
  "Contemporary",
  "Minimalist",
  "Traditional Indian",
  "Scandinavian",
  "Industrial",
  "Transitional",
  "Bohemian",
];

export interface Project extends BaseRecord {
  company_id: UUID;
  client_id: UUID | null;
  name: string;
  property_type: PropertyType;
  bhk: BHKConfig | null;
  area_sqft: number | null;
  budget: number | null;
  currency: CurrencyCode;
  style: string | null;
  status: ProjectStatus;
  description: string | null;
  created_by: UUID;
  updated_at: ISODateString;
}

/** Shape used by the "New Project" wizard. `client_id` must reference an
 * already-created client — see clientService.createClient for creating one
 * inline before submitting the wizard. `notes` maps to the `description`
 * column; kept as `notes` here since that's what it means to the designer. */
export interface NewProjectInput {
  name: string;
  client_id?: UUID;
  property_type: PropertyType;
  bhk?: BHKConfig;
  area_sqft?: number;
  budget?: number;
  currency: CurrencyCode;
  style?: string;
  notes?: string;
}

/** Partial update shape for editing an existing project. `null` explicitly
 * clears a field; `undefined` leaves it untouched. */
export interface UpdateProjectInput {
  name?: string;
  client_id?: UUID | null;
  property_type?: PropertyType;
  bhk?: BHKConfig | null;
  area_sqft?: number | null;
  budget?: number | null;
  style?: string | null;
  notes?: string | null;
}

/** Lightweight shape for dashboard/list views — avoid fetching full rows
 * (with description, etc.) when only summary data is needed. */
export interface ProjectSummary {
  id: UUID;
  name: string;
  client_name: string | null;
  property_type: PropertyType;
  bhk: BHKConfig | null;
  status: ProjectStatus;
  updated_at: ISODateString;
  thumbnail_url: string | null;
}
