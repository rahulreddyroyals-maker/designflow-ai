import type { BaseRecord, UUID } from "./common";

export type RoomType =
  | "living_room"
  | "dining_room"
  | "kitchen"
  | "master_bedroom"
  | "bedroom"
  | "study"
  | "bathroom"
  | "balcony"
  | "utility"
  | "foyer"
  | "other";

export interface Room extends BaseRecord {
  project_id: UUID;
  name: string;
  room_type: RoomType;
  width: number; // ft
  length: number; // ft
  area: number; // sq.ft — derived, but stored for quick reads
  ceiling_height: number | null; // ft
  position_x: number; // position within the project canvas
  position_y: number;
  rotation: number; // degrees
  confidence_score: number | null; // set when derived from AI analysis
  verified: boolean;
}

/** Form shape for the room-verification panel (Screen 09). */
export interface RoomVerificationInput {
  name: string;
  room_type: RoomType;
  width: number;
  length: number;
  ceiling_height?: number;
}

/** Shape for creating a room, whether hand-added or accepted from an AI
 * detection. `confidence_score`/`verified` are set when the room comes
 * from an accepted AI detection; omit both for a manually-added room. */
export interface NewRoomInput {
  name: string;
  room_type: RoomType;
  width: number;
  length: number;
  ceiling_height?: number;
  confidence_score?: number;
  verified?: boolean;
}

export const ROOM_TYPE_LABELS: Record<RoomType, string> = {
  living_room: "Living Room",
  dining_room: "Dining",
  kitchen: "Kitchen",
  master_bedroom: "Master Bedroom",
  bedroom: "Bedroom",
  study: "Study",
  bathroom: "Bathroom",
  balcony: "Balcony",
  utility: "Utility",
  foyer: "Foyer",
  other: "Other",
};
