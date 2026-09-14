import { supabase } from "@/lib/supabase";
import type { NewRoomInput, Room, UUID } from "@/types";

/** All Supabase access for `rooms` lives here. A room created with
 * `confidence_score`/`verified` set comes from an accepted AI detection
 * (see RoomVerificationList) — the AI pipeline itself never inserts here
 * directly (CLAUDE.md §4/§6). */

export async function listRoomsForProject(projectId: UUID): Promise<Room[]> {
  const { data, error } = await supabase
    .from("rooms")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function createRoom(projectId: UUID, input: NewRoomInput): Promise<Room> {
  const { data, error } = await supabase
    .from("rooms")
    .insert({
      project_id: projectId,
      name: input.name,
      room_type: input.room_type,
      width: input.width,
      length: input.length,
      area: input.width * input.length,
      ceiling_height: input.ceiling_height ?? null,
      confidence_score: input.confidence_score ?? null,
      verified: input.verified ?? false,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function updateRoom(
  roomId: UUID,
  input: Partial<NewRoomInput>
): Promise<Room> {
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.room_type !== undefined) patch.room_type = input.room_type;
  if (input.width !== undefined) patch.width = input.width;
  if (input.length !== undefined) patch.length = input.length;
  if (input.width !== undefined && input.length !== undefined) {
    patch.area = input.width * input.length;
  }
  if (input.ceiling_height !== undefined) patch.ceiling_height = input.ceiling_height;
  if (input.verified !== undefined) patch.verified = input.verified;

  const { data, error } = await supabase
    .from("rooms")
    .update(patch)
    .eq("id", roomId)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function deleteRoom(roomId: UUID): Promise<void> {
  const { error } = await supabase.from("rooms").delete().eq("id", roomId);
  if (error) throw error;
}

export interface RoomGeometry {
  position_x: number;
  position_y: number;
  width: number;
  length: number;
  rotation: number;
}

/** Updates a room's canvas geometry (position/size/rotation) — used by
 * the 2D Designer when a room is dragged, resized, or rotated. Kept
 * separate from updateRoom (which handles the verification/edit-dialog
 * field set) since the two UIs edit different, non-overlapping concerns. */
export async function updateRoomGeometry(
  roomId: UUID,
  geometry: RoomGeometry
): Promise<void> {
  const { error } = await supabase
    .from("rooms")
    .update({
      position_x: geometry.position_x,
      position_y: geometry.position_y,
      width: geometry.width,
      length: geometry.length,
      area: geometry.width * geometry.length,
      rotation: geometry.rotation,
    })
    .eq("id", roomId);

  if (error) throw error;
}
