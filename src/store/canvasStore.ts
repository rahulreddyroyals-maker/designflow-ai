import { create } from "zustand";
import * as roomService from "@/services/roomService";
import * as floorPlanElementService from "@/services/floorPlanElementService";
import * as projectFurnitureService from "@/services/projectFurnitureService";
import * as furnitureCatalogService from "@/services/furnitureCatalogService";
import {
  cloneScene,
  emptyScene,
  isTempId,
  newTempId,
  type CanvasTool,
  type Scene,
  type SceneDoor,
  type SceneFurniture,
  type SceneObjectType,
  type SceneRoom,
  type SceneSelection,
  type SceneWall,
  type SceneWindow,
} from "@/types/canvas";
import type { FurnitureItem, Point2D, UUID } from "@/types";

const MAX_HISTORY = 50;
const DEFAULT_DOOR_WIDTH_FT = 3;
const DEFAULT_WINDOW_WIDTH_FT = 4;
const GRID_SNAP_FT = 0.5;

function snap(value: number, enabled: boolean): number {
  if (!enabled) return value;
  return Math.round(value / GRID_SNAP_FT) * GRID_SNAP_FT;
}

interface CanvasState {
  projectId: UUID | null;
  scene: Scene;
  /** Snapshot of the scene as last loaded/saved — save() diffs against
   * this to know what's new/changed/deleted. */
  savedScene: Scene;
  catalog: FurnitureItem[];

  isLoading: boolean;
  isSaving: boolean;
  loadError: string | null;
  saveError: string | null;

  tool: CanvasTool;
  selection: SceneSelection | null;
  zoom: number; // pixels per foot
  pan: Point2D;
  showGrid: boolean;
  snapToGrid: boolean;

  /** In-progress wall/door/window/room draw state — the first click of a
   * two-click (or drag) placement. Cleared on completion, Escape, or tool
   * change. */
  drawStart: Point2D | null;
  measureStart: Point2D | null;
  measureEnd: Point2D | null;

  history: Scene[];
  future: Scene[];

  // Lifecycle
  loadProject: (projectId: UUID) => Promise<void>;
  save: () => Promise<void>;
  reset: () => void;

  // Tool / view state
  setTool: (tool: CanvasTool) => void;
  setZoom: (zoom: number) => void;
  setPan: (pan: Point2D) => void;
  toggleGrid: () => void;
  toggleSnap: () => void;
  select: (selection: SceneSelection | null) => void;

  // Drawing
  setDrawStart: (point: Point2D | null) => void;
  addWallSegment: (start: Point2D, end: Point2D) => void;
  addDoor: (center: Point2D) => void;
  addWindow: (center: Point2D) => void;
  addRoom: (rect: { x: number; y: number; width: number; length: number }) => void;
  addFurniture: (item: FurnitureItem, position: Point2D) => void;
  /** Adds a whole AI-proposed layout's furniture in one atomic, single
   * -undo step — used by the "Apply" action in space planning, which must
   * never partially apply or require N undos to revert (CLAUDE.md's
   * "never overwrite the original design automatically" — Apply only
   * ever ADDS to the scene, and is itself instantly revertible). */
  applyFurnitureLayout: (items: SceneFurniture[]) => void;
  setMeasure: (start: Point2D | null, end: Point2D | null) => void;

  // Editing
  updateRoomTransform: (id: string, patch: Partial<Omit<SceneRoom, "id" | "type">>) => void;
  updateFurnitureTransform: (
    id: string,
    patch: Partial<Omit<SceneFurniture, "id" | "type">>
  ) => void;
  updateLineElement: (
    id: string,
    type: "wall" | "door" | "window",
    points: [Point2D, Point2D]
  ) => void;
  deleteSelected: () => void;
  deleteObject: (id: string, type: SceneObjectType) => void;

  // History
  undo: () => void;
  redo: () => void;
}

function pushHistory(get: () => CanvasState, set: (partial: Partial<CanvasState>) => void) {
  const { scene, history } = get();
  const trimmed = history.length >= MAX_HISTORY ? history.slice(1) : history;
  set({ history: [...trimmed, cloneScene(scene)], future: [] });
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
  projectId: null,
  scene: emptyScene(),
  savedScene: emptyScene(),
  catalog: [],

  isLoading: false,
  isSaving: false,
  loadError: null,
  saveError: null,

  tool: "select",
  selection: null,
  zoom: 24, // 24px per foot — a reasonable default for a typical room
  pan: { x: 0, y: 0 },
  showGrid: true,
  snapToGrid: true,

  drawStart: null,
  measureStart: null,
  measureEnd: null,

  history: [],
  future: [],

  loadProject: async (projectId) => {
    set({ isLoading: true, loadError: null, projectId });
    try {
      const [rooms, elements, placements, catalog] = await Promise.all([
        roomService.listRoomsForProject(projectId),
        floorPlanElementService.listSceneElementsForProject(projectId),
        projectFurnitureService.listForProject(projectId),
        furnitureCatalogService.listCatalog(),
      ]);

      const catalogById = new Map(catalog.map((item) => [item.id, item]));

      const scene: Scene = {
        rooms: rooms.map(
          (r): SceneRoom => ({
            id: r.id,
            type: "room",
            name: r.name,
            roomType: r.room_type,
            x: r.position_x,
            y: r.position_y,
            width: r.width,
            length: r.length,
            rotation: r.rotation,
            verified: r.verified,
          })
        ),
        walls: elements
          .filter((e) => e.element_type === "wall")
          .map(
            (e): SceneWall => ({
              id: e.id,
              type: "wall",
              points: [e.points[0], e.points[1]] as [Point2D, Point2D],
              confidenceScore: e.confidence_score,
            })
          ),
        doors: elements
          .filter((e) => e.element_type === "door")
          .map(
            (e): SceneDoor => ({
              id: e.id,
              type: "door",
              points: [e.points[0], e.points[1]] as [Point2D, Point2D],
              width: e.width ?? DEFAULT_DOOR_WIDTH_FT,
              confidenceScore: e.confidence_score,
            })
          ),
        windows: elements
          .filter((e) => e.element_type === "window")
          .map(
            (e): SceneWindow => ({
              id: e.id,
              type: "window",
              points: [e.points[0], e.points[1]] as [Point2D, Point2D],
              width: e.width ?? DEFAULT_WINDOW_WIDTH_FT,
              confidenceScore: e.confidence_score,
            })
          ),
        furniture: placements.map(
          (p): SceneFurniture => ({
            id: p.id,
            type: "furniture",
            furnitureItemId: p.furniture_item_id,
            name: catalogById.get(p.furniture_item_id)?.name ?? "Furniture",
            roomId: p.room_id,
            x: p.x,
            y: p.y,
            width: (p.custom_width ?? catalogById.get(p.furniture_item_id)?.width ?? 100) / 30.48,
            depth: (p.custom_depth ?? catalogById.get(p.furniture_item_id)?.depth ?? 100) / 30.48,
            rotation: p.rotation,
          })
        ),
      };

      set({
        scene,
        savedScene: cloneScene(scene),
        catalog,
        isLoading: false,
        history: [],
        future: [],
        selection: null,
      });
    } catch (err) {
      set({
        isLoading: false,
        loadError: err instanceof Error ? err.message : "Failed to load the design canvas.",
      });
    }
  },

  save: async () => {
    const { projectId, scene, savedScene } = get();
    if (!projectId) return;
    set({ isSaving: true, saveError: null });

    try {
      // Rooms
      const savedRoomIds = new Set(savedScene.rooms.map((r) => r.id));
      const currentRoomIds = new Set(scene.rooms.map((r) => r.id));
      const idRemap = new Map<string, string>();

      for (const room of scene.rooms) {
        if (isTempId(room.id)) {
          const created = await roomService.createRoom(projectId, {
            name: room.name,
            room_type: room.roomType,
            width: room.width,
            length: room.length,
            verified: room.verified,
          });
          await roomService.updateRoomGeometry(created.id, {
            position_x: room.x,
            position_y: room.y,
            width: room.width,
            length: room.length,
            rotation: room.rotation,
          });
          idRemap.set(room.id, created.id);
        } else {
          await roomService.updateRoomGeometry(room.id, {
            position_x: room.x,
            position_y: room.y,
            width: room.width,
            length: room.length,
            rotation: room.rotation,
          });
        }
      }
      for (const savedRoom of savedScene.rooms) {
        if (!currentRoomIds.has(savedRoom.id) && savedRoomIds.has(savedRoom.id)) {
          await roomService.deleteRoom(savedRoom.id);
        }
      }

      // Walls / doors / windows (scene_feet elements)
      const lineCategories: Array<{
        current: (SceneWall | SceneDoor | SceneWindow)[];
        saved: (SceneWall | SceneDoor | SceneWindow)[];
        elementType: "wall" | "door" | "window";
      }> = [
        { current: scene.walls, saved: savedScene.walls, elementType: "wall" },
        { current: scene.doors, saved: savedScene.doors, elementType: "door" },
        { current: scene.windows, saved: savedScene.windows, elementType: "window" },
      ];

      for (const { current, saved, elementType } of lineCategories) {
        const currentIds = new Set(current.map((el) => el.id));
        const savedIds = new Set(saved.map((el) => el.id));

        for (const el of current) {
          const width = "width" in el ? el.width : undefined;
          if (isTempId(el.id)) {
            await floorPlanElementService.createSceneElement(projectId, {
              element_type: elementType,
              points: el.points,
              width,
            });
          } else {
            await floorPlanElementService.updateSceneElement(el.id, {
              points: el.points,
              width,
            });
          }
        }
        for (const savedEl of saved) {
          if (!currentIds.has(savedEl.id) && savedIds.has(savedEl.id)) {
            await floorPlanElementService.deleteElement(savedEl.id);
          }
        }
      }

      // Furniture
      const savedFurnitureIds = new Set(savedScene.furniture.map((f) => f.id));
      const currentFurnitureIds = new Set(scene.furniture.map((f) => f.id));

      for (const item of scene.furniture) {
        const resolvedRoomId =
          item.roomId && idRemap.has(item.roomId) ? idRemap.get(item.roomId)! : item.roomId;

        if (isTempId(item.id)) {
          await projectFurnitureService.createPlacement(projectId, {
            furniture_item_id: item.furnitureItemId,
            room_id: resolvedRoomId,
            x: item.x,
            y: item.y,
            rotation: item.rotation,
            custom_width: item.width * 30.48,
            custom_depth: item.depth * 30.48,
          });
        } else {
          await projectFurnitureService.updatePlacement(item.id, {
            x: item.x,
            y: item.y,
            rotation: item.rotation,
            custom_width: item.width * 30.48,
            custom_depth: item.depth * 30.48,
            room_id: resolvedRoomId,
          });
        }
      }
      for (const savedItem of savedScene.furniture) {
        if (!currentFurnitureIds.has(savedItem.id) && savedFurnitureIds.has(savedItem.id)) {
          await projectFurnitureService.deletePlacement(savedItem.id);
        }
      }

      // Reload from DB to pick up real ids for everything that was tmp-.
      await get().loadProject(projectId);
      set({ isSaving: false });
    } catch (err) {
      set({
        isSaving: false,
        saveError: err instanceof Error ? err.message : "Failed to save changes.",
      });
    }
  },

  reset: () =>
    set({
      projectId: null,
      scene: emptyScene(),
      savedScene: emptyScene(),
      history: [],
      future: [],
      selection: null,
      drawStart: null,
      measureStart: null,
      measureEnd: null,
    }),

  setTool: (tool) => set({ tool, drawStart: null, selection: null }),
  setZoom: (zoom) => set({ zoom: Math.min(80, Math.max(6, zoom)) }),
  setPan: (pan) => set({ pan }),
  toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
  toggleSnap: () => set((s) => ({ snapToGrid: !s.snapToGrid })),
  select: (selection) => set({ selection }),

  setDrawStart: (point) => set({ drawStart: point }),

  addWallSegment: (start, end) => {
    pushHistory(get, set);
    const { snapToGrid } = get();
    const wall: SceneWall = {
      id: newTempId(),
      type: "wall",
      points: [
        { x: snap(start.x, snapToGrid), y: snap(start.y, snapToGrid) },
        { x: snap(end.x, snapToGrid), y: snap(end.y, snapToGrid) },
      ],
      confidenceScore: null,
    };
    set((s) => ({ scene: { ...s.scene, walls: [...s.scene.walls, wall] } }));
  },

  addDoor: (center) => {
    pushHistory(get, set);
    const half = DEFAULT_DOOR_WIDTH_FT / 2;
    const door: SceneDoor = {
      id: newTempId(),
      type: "door",
      points: [
        { x: center.x - half, y: center.y },
        { x: center.x + half, y: center.y },
      ],
      width: DEFAULT_DOOR_WIDTH_FT,
      confidenceScore: null,
    };
    set((s) => ({ scene: { ...s.scene, doors: [...s.scene.doors, door] } }));
  },

  addWindow: (center) => {
    pushHistory(get, set);
    const half = DEFAULT_WINDOW_WIDTH_FT / 2;
    const win: SceneWindow = {
      id: newTempId(),
      type: "window",
      points: [
        { x: center.x - half, y: center.y },
        { x: center.x + half, y: center.y },
      ],
      width: DEFAULT_WINDOW_WIDTH_FT,
      confidenceScore: null,
    };
    set((s) => ({ scene: { ...s.scene, windows: [...s.scene.windows, win] } }));
  },

  addRoom: (rect) => {
    pushHistory(get, set);
    const { snapToGrid } = get();
    const room: SceneRoom = {
      id: newTempId(),
      type: "room",
      name: "New Room",
      roomType: "other",
      x: snap(rect.x, snapToGrid),
      y: snap(rect.y, snapToGrid),
      width: Math.max(1, Math.round(Math.abs(rect.width) * 2) / 2),
      length: Math.max(1, Math.round(Math.abs(rect.length) * 2) / 2),
      rotation: 0,
      verified: false,
    };
    set((s) => ({
      scene: { ...s.scene, rooms: [...s.scene.rooms, room] },
      selection: { id: room.id, type: "room" },
      tool: "select",
    }));
  },

  addFurniture: (item, position) => {
    pushHistory(get, set);
    const { snapToGrid } = get();
    const furniture: SceneFurniture = {
      id: newTempId(),
      type: "furniture",
      furnitureItemId: item.id,
      name: item.name,
      roomId: null,
      x: snap(position.x, snapToGrid),
      y: snap(position.y, snapToGrid),
      width: item.width / 30.48, // cm -> ft
      depth: item.depth / 30.48,
      rotation: 0,
    };
    set((s) => ({
      scene: { ...s.scene, furniture: [...s.scene.furniture, furniture] },
      selection: { id: furniture.id, type: "furniture" },
    }));
  },

  applyFurnitureLayout: (items) => {
    pushHistory(get, set);
    set((s) => ({
      scene: { ...s.scene, furniture: [...s.scene.furniture, ...items] },
      selection: null,
    }));
  },

  setMeasure: (start, end) => set({ measureStart: start, measureEnd: end }),

  updateRoomTransform: (id, patch) => {
    pushHistory(get, set);
    set((s) => ({
      scene: {
        ...s.scene,
        rooms: s.scene.rooms.map((r) => (r.id === id ? { ...r, ...patch } : r)),
      },
    }));
  },

  updateFurnitureTransform: (id, patch) => {
    pushHistory(get, set);
    set((s) => ({
      scene: {
        ...s.scene,
        furniture: s.scene.furniture.map((f) => (f.id === id ? { ...f, ...patch } : f)),
      },
    }));
  },

  updateLineElement: (id, type, points) => {
    pushHistory(get, set);
    set((s) => {
      if (type === "wall") {
        return {
          scene: {
            ...s.scene,
            walls: s.scene.walls.map((w) => (w.id === id ? { ...w, points } : w)),
          },
        };
      }
      if (type === "door") {
        return {
          scene: {
            ...s.scene,
            doors: s.scene.doors.map((d) => (d.id === id ? { ...d, points } : d)),
          },
        };
      }
      return {
        scene: {
          ...s.scene,
          windows: s.scene.windows.map((w) => (w.id === id ? { ...w, points } : w)),
        },
      };
    });
  },

  deleteSelected: () => {
    const { selection } = get();
    if (!selection) return;
    get().deleteObject(selection.id, selection.type);
  },

  deleteObject: (id, type) => {
    pushHistory(get, set);
    set((s) => {
      const scene = { ...s.scene };
      if (type === "wall") scene.walls = scene.walls.filter((w) => w.id !== id);
      if (type === "door") scene.doors = scene.doors.filter((d) => d.id !== id);
      if (type === "window") scene.windows = scene.windows.filter((w) => w.id !== id);
      if (type === "room") scene.rooms = scene.rooms.filter((r) => r.id !== id);
      if (type === "furniture") scene.furniture = scene.furniture.filter((f) => f.id !== id);
      return {
        scene,
        selection: s.selection?.id === id ? null : s.selection,
      };
    });
  },

  undo: () => {
    const { history, scene, future } = get();
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    set({
      scene: previous,
      history: history.slice(0, -1),
      future: [cloneScene(scene), ...future].slice(0, MAX_HISTORY),
      selection: null,
    });
  },

  redo: () => {
    const { future, scene, history } = get();
    if (future.length === 0) return;
    const next = future[0];
    set({
      scene: next,
      future: future.slice(1),
      history: [...history, cloneScene(scene)].slice(-MAX_HISTORY),
      selection: null,
    });
  },
}));
