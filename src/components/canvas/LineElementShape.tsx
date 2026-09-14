import { useState } from "react";
import { Circle, Group, Line } from "react-konva";
import type Konva from "konva";
import type { Point2D } from "@/types";

interface LineElementShapeProps {
  points: [Point2D, Point2D];
  type: "wall" | "door" | "window";
  isSelected: boolean;
  draggable: boolean;
  onSelect: () => void;
  onChange: (points: [Point2D, Point2D]) => void;
}

const STYLE: Record<string, { stroke: string; strokeWidth: number }> = {
  wall: { stroke: "rgb(30, 41, 59)", strokeWidth: 0.35 },
  door: { stroke: "rgb(217, 119, 6)", strokeWidth: 0.5 },
  window: { stroke: "rgb(5, 150, 105)", strokeWidth: 0.5 },
};

/**
 * Walls/doors/windows are 2-point lines, not rectangles, so they don't
 * fit Konva's Transformer well — instead: drag the whole line to
 * translate both endpoints together, or (when selected) drag either
 * endpoint handle independently to reshape it. A local `preview` state
 * gives smooth visual feedback during a drag without committing to the
 * store (and pushing undo history) on every pixel of movement — only the
 * final position on drag-end is committed.
 */
export function LineElementShape({
  points,
  type,
  isSelected,
  draggable,
  onSelect,
  onChange,
}: LineElementShapeProps) {
  const [preview, setPreview] = useState<[Point2D, Point2D] | null>(null);
  const style = STYLE[type];
  const display = preview ?? points;
  const flat = [display[0].x, display[0].y, display[1].x, display[1].y];

  function handleLineDragMove(e: Konva.KonvaEventObject<DragEvent>) {
    const dx = e.target.x();
    const dy = e.target.y();
    setPreview([
      { x: points[0].x + dx, y: points[0].y + dy },
      { x: points[1].x + dx, y: points[1].y + dy },
    ]);
  }

  function handleLineDragEnd(e: Konva.KonvaEventObject<DragEvent>) {
    const dx = e.target.x();
    const dy = e.target.y();
    e.target.position({ x: 0, y: 0 });
    setPreview(null);
    onChange([
      { x: points[0].x + dx, y: points[0].y + dy },
      { x: points[1].x + dx, y: points[1].y + dy },
    ]);
  }

  return (
    <Group>
      <Line
        points={flat}
        stroke={style.stroke}
        strokeWidth={style.strokeWidth}
        lineCap="round"
        hitStrokeWidth={Math.max(style.strokeWidth, 0.6)}
        draggable={draggable}
        onClick={onSelect}
        onTap={onSelect}
        onDragMove={handleLineDragMove}
        onDragEnd={handleLineDragEnd}
      />
      {isSelected && (
        <>
          <Circle
            x={display[0].x}
            y={display[0].y}
            radius={0.25}
            fill="white"
            stroke={style.stroke}
            strokeWidth={0.08}
            draggable
            onDragMove={(e) => setPreview([{ x: e.target.x(), y: e.target.y() }, display[1]])}
            onDragEnd={(e) => {
              const next: [Point2D, Point2D] = [
                { x: e.target.x(), y: e.target.y() },
                points[1],
              ];
              setPreview(null);
              onChange(next);
            }}
          />
          <Circle
            x={display[1].x}
            y={display[1].y}
            radius={0.25}
            fill="white"
            stroke={style.stroke}
            strokeWidth={0.08}
            draggable
            onDragMove={(e) => setPreview([display[0], { x: e.target.x(), y: e.target.y() }])}
            onDragEnd={(e) => {
              const next: [Point2D, Point2D] = [
                points[0],
                { x: e.target.x(), y: e.target.y() },
              ];
              setPreview(null);
              onChange(next);
            }}
          />
        </>
      )}
    </Group>
  );
}
