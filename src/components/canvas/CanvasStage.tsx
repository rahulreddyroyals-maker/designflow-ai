import { useEffect, useRef, useState } from "react";
import { Stage, Layer, Rect, Circle } from "react-konva";
import type Konva from "konva";
import { useCanvasStore } from "@/store/canvasStore";
import { Grid } from "./Grid";
import { RoomShape } from "./RoomShape";
import { FurnitureShape } from "./FurnitureShape";
import { LineElementShape } from "./LineElementShape";
import { MeasurementOverlay } from "./MeasurementOverlay";
import type { Point2D } from "@/types";

const MIN_ZOOM = 6;
const MAX_ZOOM = 80;

function getScenePointer(stage: Konva.Stage): Point2D | null {
  const pos = stage.getRelativePointerPosition();
  return pos ? { x: pos.x, y: pos.y } : null;
}

/**
 * The Konva canvas itself. All shape coordinates are authored directly in
 * scene feet — the Stage's own scaleX/scaleY (zoom, px-per-ft) and x/y
 * (pan) handle the visual pixel conversion, so no manual unit conversion
 * is needed in the shape components. Pointer positions are converted back
 * to scene feet via Konva's getRelativePointerPosition(), which already
 * accounts for the Stage's current scale/position.
 */
export function CanvasStage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const roomStartRef = useRef<Point2D | null>(null);

  const scene = useCanvasStore((s) => s.scene);
  const catalog = useCanvasStore((s) => s.catalog);
  const tool = useCanvasStore((s) => s.tool);
  const zoom = useCanvasStore((s) => s.zoom);
  const pan = useCanvasStore((s) => s.pan);
  const showGrid = useCanvasStore((s) => s.showGrid);
  const selection = useCanvasStore((s) => s.selection);
  const drawStart = useCanvasStore((s) => s.drawStart);
  const measureStart = useCanvasStore((s) => s.measureStart);
  const measureEnd = useCanvasStore((s) => s.measureEnd);

  const setZoom = useCanvasStore((s) => s.setZoom);
  const setPan = useCanvasStore((s) => s.setPan);
  const select = useCanvasStore((s) => s.select);
  const setDrawStart = useCanvasStore((s) => s.setDrawStart);
  const addWallSegment = useCanvasStore((s) => s.addWallSegment);
  const addDoor = useCanvasStore((s) => s.addDoor);
  const addWindow = useCanvasStore((s) => s.addWindow);
  const addRoom = useCanvasStore((s) => s.addRoom);
  const addFurniture = useCanvasStore((s) => s.addFurniture);
  const setMeasure = useCanvasStore((s) => s.setMeasure);
  const updateRoomTransform = useCanvasStore((s) => s.updateRoomTransform);
  const updateFurnitureTransform = useCanvasStore((s) => s.updateFurnitureTransform);
  const updateLineElement = useCanvasStore((s) => s.updateLineElement);

  const [roomPreview, setRoomPreview] = useState<{
    x: number;
    y: number;
    width: number;
    length: number;
  } | null>(null);
  const [size, setSize] = useState({ width: 800, height: 600 });

  useEffect(() => {
    function updateSize() {
      if (containerRef.current) {
        setSize({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    }
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  // Escape cancels any in-progress draw/measure; Delete/Backspace removes
  // the current selection (unless the person is typing in a text field).
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setDrawStart(null);
        setMeasure(null, null);
        roomStartRef.current = null;
        setRoomPreview(null);
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selection) {
        const active = document.activeElement;
        const isTyping =
          active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement;
        if (!isTyping) {
          e.preventDefault();
          useCanvasStore.getState().deleteSelected();
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selection, setDrawStart, setMeasure]);

  function handleWheel(e: Konva.KonvaEventObject<WheelEvent>) {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const oldScale = zoom;
    const mousePointTo = {
      x: (pointer.x - pan.x) / oldScale,
      y: (pointer.y - pan.y) / oldScale,
    };
    const direction = e.evt.deltaY > 0 ? -1 : 1;
    const scaleBy = 1.08;
    const newScale = Math.min(
      MAX_ZOOM,
      Math.max(MIN_ZOOM, direction > 0 ? oldScale * scaleBy : oldScale / scaleBy)
    );

    setZoom(newScale);
    setPan({
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    });
  }

  function handleStageClick(e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) {
    const stage = stageRef.current;
    if (!stage) return;
    const point = getScenePointer(stage);
    if (!point) return;
    const clickedOnEmpty = e.target === stage;

    if (tool === "select") {
      if (clickedOnEmpty) select(null);
      return;
    }
    if (tool === "wall") {
      if (drawStart) {
        addWallSegment(drawStart, point);
        setDrawStart(point);
      } else {
        setDrawStart(point);
      }
      return;
    }
    if (tool === "door") {
      addDoor(point);
      return;
    }
    if (tool === "window") {
      addWindow(point);
      return;
    }
    if (tool === "measure") {
      if (measureStart && !measureEnd) {
        setMeasure(measureStart, point);
      } else {
        setMeasure(point, null);
      }
      return;
    }
  }

  function handleStageMouseDown() {
    if (tool !== "room") return;
    const stage = stageRef.current;
    if (!stage) return;
    const point = getScenePointer(stage);
    if (!point) return;
    roomStartRef.current = point;
    setRoomPreview({ x: point.x, y: point.y, width: 0, length: 0 });
  }

  function handleStageMouseMove() {
    if (tool !== "room" || !roomStartRef.current) return;
    const stage = stageRef.current;
    if (!stage) return;
    const point = getScenePointer(stage);
    if (!point) return;
    const anchor = roomStartRef.current;
    setRoomPreview({
      x: Math.min(anchor.x, point.x),
      y: Math.min(anchor.y, point.y),
      width: Math.abs(point.x - anchor.x),
      length: Math.abs(point.y - anchor.y),
    });
  }

  function handleStageMouseUp() {
    if (tool !== "room" || !roomStartRef.current || !roomPreview) return;
    if (roomPreview.width > 0.5 && roomPreview.length > 0.5) {
      addRoom(roomPreview);
    }
    roomStartRef.current = null;
    setRoomPreview(null);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const itemId = e.dataTransfer.getData("furnitureItemId");
    const item = catalog.find((c) => c.id === itemId);
    if (!item || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    addFurniture(item, {
      x: (screenX - pan.x) / zoom,
      y: (screenY - pan.y) / zoom,
    });
  }

  return (
    <div
      ref={containerRef}
      className="relative flex-1 overflow-hidden bg-white"
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      <Stage
        ref={stageRef}
        width={size.width}
        height={size.height}
        scaleX={zoom}
        scaleY={zoom}
        x={pan.x}
        y={pan.y}
        draggable={tool === "select"}
        onDragEnd={(e) => {
          if (e.target === stageRef.current) {
            setPan({ x: e.target.x(), y: e.target.y() });
          }
        }}
        onWheel={handleWheel}
        onClick={handleStageClick}
        onTap={handleStageClick}
        onMouseDown={handleStageMouseDown}
        onMouseMove={handleStageMouseMove}
        onMouseUp={handleStageMouseUp}
      >
        <Layer>
          {showGrid && <Grid />}

          {scene.walls.map((wall) => (
            <LineElementShape
              key={wall.id}
              points={wall.points}
              type="wall"
              isSelected={selection?.id === wall.id}
              draggable={tool === "select"}
              onSelect={() => select({ id: wall.id, type: "wall" })}
              onChange={(points) => updateLineElement(wall.id, "wall", points)}
            />
          ))}
          {scene.doors.map((door) => (
            <LineElementShape
              key={door.id}
              points={door.points}
              type="door"
              isSelected={selection?.id === door.id}
              draggable={tool === "select"}
              onSelect={() => select({ id: door.id, type: "door" })}
              onChange={(points) => updateLineElement(door.id, "door", points)}
            />
          ))}
          {scene.windows.map((win) => (
            <LineElementShape
              key={win.id}
              points={win.points}
              type="window"
              isSelected={selection?.id === win.id}
              draggable={tool === "select"}
              onSelect={() => select({ id: win.id, type: "window" })}
              onChange={(points) => updateLineElement(win.id, "window", points)}
            />
          ))}

          {scene.rooms.map((room) => (
            <RoomShape
              key={room.id}
              room={room}
              isSelected={selection?.id === room.id}
              draggable={tool === "select"}
              onSelect={() => select({ id: room.id, type: "room" })}
              onChange={(patch) => updateRoomTransform(room.id, patch)}
            />
          ))}

          {scene.furniture.map((item) => (
            <FurnitureShape
              key={item.id}
              furniture={item}
              isSelected={selection?.id === item.id}
              draggable={tool === "select"}
              onSelect={() => select({ id: item.id, type: "furniture" })}
              onChange={(patch) => updateFurnitureTransform(item.id, patch)}
            />
          ))}

          {roomPreview && (
            <Rect
              x={roomPreview.x}
              y={roomPreview.y}
              width={roomPreview.width}
              height={roomPreview.length}
              stroke="rgb(79, 70, 229)"
              strokeWidth={0.08}
              dash={[0.3, 0.2]}
              listening={false}
            />
          )}

          {drawStart && tool === "wall" && (
            <Circle
              x={drawStart.x}
              y={drawStart.y}
              radius={0.15}
              fill="rgb(30, 41, 59)"
              listening={false}
            />
          )}

          <MeasurementOverlay />
        </Layer>
      </Stage>
    </div>
  );
}
