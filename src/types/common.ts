/**
 * Shared primitives used across the domain model.
 * Keep this file free of domain-specific types — it should only ever
 * contain generic building blocks.
 */

export type UUID = string;
export type ISODateString = string;

/** Standard async state shape. Every async operation in the app should
 * be representable by one of these four states — see CLAUDE.md §3.9. */
export type AsyncState<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: T }
  | { status: "error"; error: string }
  | { status: "empty" };

export interface Point2D {
  x: number;
  y: number;
}

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

/** Generic wrapper for any table row that carries tenancy + audit columns. */
export interface BaseRecord {
  id: UUID;
  created_at: ISODateString;
}

export interface TenantRecord extends BaseRecord {
  company_id: UUID;
}

/** Currency is stored as an ISO 4217 code (e.g. "INR", "USD"). */
export type CurrencyCode = string;

/** Measurement unit convention. Widths/lengths are stored in feet for the
 * MVP to match how Indian interior designers typically communicate room
 * sizes to clients; convert at the display layer if needed. */
export type LengthUnit = "ft" | "in" | "m" | "cm";
