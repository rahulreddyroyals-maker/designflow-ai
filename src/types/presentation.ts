import type { BaseRecord, ISODateString, UUID } from "./common";

export type PresentationStatus = "draft" | "shared" | "in_review" | "approved";

export interface ClientPresentation extends BaseRecord {
  project_id: UUID;
  title: string;
  /** Opaque token used in the public `/share/:token` route. Never expose
   * internal project/company ids in that URL. */
  share_token: string;
  status: PresentationStatus;
  updated_at: ISODateString;
}

export interface PresentationItem extends BaseRecord {
  presentation_id: UUID;
  room_id: UUID;
  render_id: UUID | null;
  order_index: number;
  description: string | null;
}

export type CommentAuthorType = "designer" | "client";

export interface Comment extends BaseRecord {
  presentation_item_id: UUID;
  author_name: string;
  author_type: CommentAuthorType;
  content: string;
}

export type ApprovalStatus = "pending" | "approved" | "changes_requested";

export interface Approval extends BaseRecord {
  presentation_item_id: UUID;
  status: ApprovalStatus;
  approved_by: string | null; // client display name (no client auth in MVP)
  approved_at: ISODateString | null;
  notes: string | null;
}
