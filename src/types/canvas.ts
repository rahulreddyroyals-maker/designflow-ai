import type { Point2D, UUID } from "./common";
import type { RoomType } from "./room";

/**
 * The 2D Designer's structured scene model. This is the single source of
 * truth the canvas editor operates on — decoupled from DB row shapes so
 * the editor can hold in-progress, not-yet-saved edits (new objects with
 * temporary ids, moved/resized objects, pending deletes) without every
 * interaction round-tripping to Supabase. Explicit load/save functions in
 * canvasStore translate between this shape and the DB
 * (rooms / floor_plan_elements / project_furniture).
 *
 * Coordinate space: real-world FEET, origin (0,0) at top-left, matching
 * `rooms.width/length/position_x/position_y`. This is a different space
 * from the AI floor-plan-analysis overlay (which uses 0-100 percentages
 * of an uploaded image) — the 2D Designer is a project-native canvas, not
 * an annotation layer on a scanned image. See FloorPlanCoordinateSystem
 * in floorPlan.ts.
 */

export type SceneObjectType = "wall" | "door" | "window" | "room" | "furniture";

/** Every scene object carries `id`. A real DB id once saved; a
 * client-generated `tmp-...` id for anything created on canvas but not
 * yet persisted — canvasStore.save() swaps these for real ids. */
interface SceneObjectBase {
  id: string;
  type: SceneObjectType;
}

export interface SceneWall extends SceneObjectBase {
  type: "wall";
  points: [Point2D, Point2D]; // start, end — feet
  confidenceScore: number | null;
}

export interface SceneDoor extends SceneObjectBase {
  type: "door";
  points: [Point2D, Point2D];
  width: number; // ft
  confidenceScore: number | null;
}

export interface SceneWindow extends SceneObjectBase {
  type: "window";
  points: [Point2D, Point2D];
  width: number; // ft
  confidenceScore: number | null;
}

export interface SceneRoom extends SceneObjectBase {
  type: "room";
  name: string;
  roomType: RoomType;
  x: number; // ft, top-left before rotation
  y: number;
  width: number; // ft
  length: number; // ft
  rotation: number; // degrees
  verified: boolean;
}

export interface SceneFurniture extends SceneObjectBase {
  type: "furniture";
  furnitureItemId: UUID;
  name: string; // denormalized catalog name, for display without a join
  roomId: string | null; // may reference a SceneRoom's id (real or tmp-)
  x: number; // ft, top-left before rotation
  y: number;
  width: number; // ft
  depth: number; // ft
  rotation: number; // degrees
}

export type SceneObject = SceneWall | SceneDoor | SceneWindow | SceneRoom | SceneFurniture;

export interface Scene {
  walls: SceneWall[];
  doors: SceneDoor[];
  windows: SceneWindow[];
  rooms: SceneRoom[];
  furniture: SceneFurniture[];
}

export function emptyScene(): Scene {
  return { walls: [], doors: [], windows: [], rooms: [], furniture: [] };
}

export function cloneScene(scene: Scene): Scene {
  return {
    walls: scene.walls.map((w) => ({ ...w, points: [{ ...w.points[0] }, { ...w.points[1] }] })),
    doors: scene.doors.map((d) => ({ ...d, points: [{ ...d.points[0] }, { ...d.points[1] }] })),
    windows: scene.windows.map((w) => ({
      ...w,
      points: [{ ...w.points[0] }, { ...w.points[1] }],
    })),
    rooms: scene.rooms.map((r) => ({ ...r })),
    furniture: scene.furniture.map((f) => ({ ...f })),
  };
}

export function isTempId(id: string): boolean {
  return id.startsWith("tmp-");
}

export function newTempId(): string {
  return `tmp-${crypto.randomUUID()}`;
}

/** Selection reference — which scene object is currently selected, if any. */
export interface SceneSelection {
  id: string;
  type: SceneObjectType;
}

export type CanvasTool = "select" | "wall" | "door" | "window" | "room" | "measure";
