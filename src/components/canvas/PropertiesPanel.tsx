import { useState } from "react";
import { Sparkles, Trash2 } from "lucide-react";
import { useCanvasStore } from "@/store/canvasStore";
import { ROOM_TYPE_LABELS, type Point2D, type RoomType } from "@/types";
import { isTempId } from "@/types/canvas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SpacePlanningModal } from "./SpacePlanningModal";

function distance(a: Point2D, b: Point2D): number {
  return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
}

/** Editable fields for whatever's currently selected on the canvas.
 * Doubles as an accessible alternative to dragging/resizing by hand —
 * every geometry field here is a plain numeric input. */
export function PropertiesPanel() {
  const selection = useCanvasStore((s) => s.selection);
  const scene = useCanvasStore((s) => s.scene);
  const updateRoomTransform = useCanvasStore((s) => s.updateRoomTransform);
  const updateFurnitureTransform = useCanvasStore((s) => s.updateFurnitureTransform);
  const deleteSelected = useCanvasStore((s) => s.deleteSelected);
  const [spacePlanningOpen, setSpacePlanningOpen] = useState(false);

  if (!selection) {
    return (
      <div className="w-64 shrink-0 border-l bg-card p-4">
        <p className="text-sm text-muted-foreground">
          Select an object on the canvas to edit its properties.
        </p>
      </div>
    );
  }

  if (selection.type === "room") {
    const room = scene.rooms.find((r) => r.id === selection.id);
    if (!room) return null;
    return (
      <div className="w-64 shrink-0 space-y-4 border-l bg-card p-4">
        <PanelHeader title="Room" onDelete={deleteSelected} />
        <div className="space-y-1.5">
          <Label className="text-xs">Name</Label>
          <Input
            className="h-8"
            value={room.name}
            onChange={(e) => updateRoomTransform(room.id, { name: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Type</Label>
          <Select
            value={room.roomType}
            onValueChange={(v) => updateRoomTransform(room.id, { roomType: v as RoomType })}
          >
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(ROOM_TYPE_LABELS) as RoomType[]).map((rt) => (
                <SelectItem key={rt} value={rt}>
                  {ROOM_TYPE_LABELS[rt]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Width (ft)</Label>
            <Input
              className="h-8"
              type="number"
              value={room.width}
              onChange={(e) =>
                updateRoomTransform(room.id, { width: Number(e.target.value) })
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Length (ft)</Label>
            <Input
              className="h-8"
              type="number"
              value={room.length}
              onChange={(e) =>
                updateRoomTransform(room.id, { length: Number(e.target.value) })
              }
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Rotation (°)</Label>
          <Input
            className="h-8"
            type="number"
            value={room.rotation}
            onChange={(e) =>
              updateRoomTransform(room.id, { rotation: Number(e.target.value) })
            }
          />
        </div>
        {!room.verified && (
          <p className="text-xs text-amber-700">Not yet verified from AI analysis.</p>
        )}

        <div className="border-t pt-3">
          {isTempId(room.id) ? (
            <p className="text-xs text-muted-foreground">
              Save the design first to generate an AI layout for this room.
            </p>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={() => setSpacePlanningOpen(true)}
            >
              <Sparkles className="mr-2 h-4 w-4" />
              AI Generate Layout
            </Button>
          )}
        </div>

        {!isTempId(room.id) && (
          <SpacePlanningModal
            room={room}
            open={spacePlanningOpen}
            onOpenChange={setSpacePlanningOpen}
          />
        )}
      </div>
    );
  }

  if (selection.type === "furniture") {
    const item = scene.furniture.find((f) => f.id === selection.id);
    if (!item) return null;
    return (
      <div className="w-64 shrink-0 space-y-4 border-l bg-card p-4">
        <PanelHeader title={item.name} onDelete={deleteSelected} />
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Width (ft)</Label>
            <Input
              className="h-8"
              type="number"
              step={0.1}
              value={item.width.toFixed(1)}
              onChange={(e) =>
                updateFurnitureTransform(item.id, { width: Number(e.target.value) })
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Depth (ft)</Label>
            <Input
              className="h-8"
              type="number"
              step={0.1}
              value={item.depth.toFixed(1)}
              onChange={(e) =>
                updateFurnitureTransform(item.id, { depth: Number(e.target.value) })
              }
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Rotation (°)</Label>
          <Input
            className="h-8"
            type="number"
            value={item.rotation}
            onChange={(e) =>
              updateFurnitureTransform(item.id, { rotation: Number(e.target.value) })
            }
          />
        </div>
      </div>
    );
  }

  // wall / door / window
  const list =
    selection.type === "wall"
      ? scene.walls
      : selection.type === "door"
        ? scene.doors
        : scene.windows;
  const element = list.find((el) => el.id === selection.id);
  if (!element) return null;
  const length = distance(element.points[0], element.points[1]);

  return (
    <div className="w-64 shrink-0 space-y-4 border-l bg-card p-4">
      <PanelHeader
        title={selection.type[0].toUpperCase() + selection.type.slice(1)}
        onDelete={deleteSelected}
      />
      <div className="text-sm text-muted-foreground">Length: {length.toFixed(1)} ft</div>
      {element.confidenceScore !== null && (
        <div className="text-xs text-muted-foreground">
          Detected with {Math.round(element.confidenceScore * 100)}% confidence
        </div>
      )}
    </div>
  );
}

function PanelHeader({ title, onDelete }: { title: string; onDelete: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <p className="text-sm font-medium">{title}</p>
      <Button size="icon" variant="ghost" className="text-destructive" onClick={onDelete}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
