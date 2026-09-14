import {
  MousePointer2,
  Minus,
  DoorOpen,
  Frame,
  Square,
  Ruler,
  Grid3x3,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Save,
} from "lucide-react";
import { useCanvasStore } from "@/store/canvasStore";
import { Button } from "@/components/ui/button";
import type { CanvasTool } from "@/types";

const TOOLS: { id: CanvasTool; label: string; icon: typeof MousePointer2 }[] = [
  { id: "select", label: "Select", icon: MousePointer2 },
  { id: "wall", label: "Wall", icon: Minus },
  { id: "door", label: "Door", icon: DoorOpen },
  { id: "window", label: "Window", icon: Frame },
  { id: "room", label: "Room", icon: Square },
  { id: "measure", label: "Measure", icon: Ruler },
];

export function Toolbar() {
  const tool = useCanvasStore((s) => s.tool);
  const setTool = useCanvasStore((s) => s.setTool);
  const zoom = useCanvasStore((s) => s.zoom);
  const setZoom = useCanvasStore((s) => s.setZoom);
  const showGrid = useCanvasStore((s) => s.showGrid);
  const toggleGrid = useCanvasStore((s) => s.toggleGrid);
  const snapToGrid = useCanvasStore((s) => s.snapToGrid);
  const toggleSnap = useCanvasStore((s) => s.toggleSnap);
  const history = useCanvasStore((s) => s.history);
  const future = useCanvasStore((s) => s.future);
  const undo = useCanvasStore((s) => s.undo);
  const redo = useCanvasStore((s) => s.redo);
  const isSaving = useCanvasStore((s) => s.isSaving);
  const save = useCanvasStore((s) => s.save);

  return (
    <div className="flex flex-wrap items-center gap-1 border-b bg-card px-3 py-2">
      <div className="flex items-center gap-1 pr-2 mr-2 border-r">
        {TOOLS.map(({ id, label, icon: Icon }) => (
          <Button
            key={id}
            size="icon"
            variant={tool === id ? "default" : "ghost"}
            onClick={() => setTool(id)}
            title={label}
          >
            <Icon className="h-4 w-4" />
          </Button>
        ))}
      </div>

      <div className="flex items-center gap-1 pr-2 mr-2 border-r">
        <Button
          size="icon"
          variant="ghost"
          onClick={undo}
          disabled={history.length === 0}
          title="Undo"
        >
          <Undo2 className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={redo}
          disabled={future.length === 0}
          title="Redo"
        >
          <Redo2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex items-center gap-1 pr-2 mr-2 border-r">
        <Button size="icon" variant="ghost" onClick={() => setZoom(zoom / 1.2)} title="Zoom out">
          <ZoomOut className="h-4 w-4" />
        </Button>
        <span className="w-16 text-center text-xs text-muted-foreground">
          {Math.round(zoom)} px/ft
        </span>
        <Button size="icon" variant="ghost" onClick={() => setZoom(zoom * 1.2)} title="Zoom in">
          <ZoomIn className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex items-center gap-1 pr-2 mr-2 border-r">
        <Button
          size="icon"
          variant={showGrid ? "default" : "ghost"}
          onClick={toggleGrid}
          title="Toggle grid"
        >
          <Grid3x3 className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant={snapToGrid ? "default" : "ghost"}
          onClick={toggleSnap}
          className="text-xs"
        >
          Snap
        </Button>
      </div>

      <div className="ml-auto">
        <Button size="sm" onClick={save} disabled={isSaving}>
          <Save className="h-4 w-4 mr-2" />
          {isSaving ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}
