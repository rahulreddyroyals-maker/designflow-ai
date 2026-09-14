import { useEffect, useRef } from "react";
import { Group, Rect, Text, Transformer } from "react-konva";
import type Konva from "konva";
import type { SceneFurniture } from "@/types/canvas";

interface FurnitureShapeProps {
  furniture: SceneFurniture;
  isSelected: boolean;
  draggable: boolean;
  onSelect: () => void;
  onChange: (patch: Partial<Omit<SceneFurniture, "id" | "type">>) => void;
}

const FILL = "rgba(180, 83, 9, 0.18)";
const STROKE = "rgb(180, 83, 9)";

/** Mirrors RoomShape's Group-level Transformer pattern — see its comment
 * for why the Transformer attaches to the Group, not the Rect. */
export function FurnitureShape({
  furniture,
  isSelected,
  draggable,
  onSelect,
  onChange,
}: FurnitureShapeProps) {
  const groupRef = useRef<Konva.Group>(null);
  const trRef = useRef<Konva.Transformer>(null);

  useEffect(() => {
    if (isSelected && trRef.current && groupRef.current) {
      trRef.current.nodes([groupRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected]);

  return (
    <>
      <Group
        ref={groupRef}
        x={furniture.x}
        y={furniture.y}
        rotation={furniture.rotation}
        draggable={draggable}
        onClick={onSelect}
        onTap={onSelect}
        onDragEnd={(e) => onChange({ x: e.target.x(), y: e.target.y() })}
        onTransformEnd={() => {
          const node = groupRef.current;
          if (!node) return;
          const scaleX = node.scaleX();
          const scaleY = node.scaleY();
          node.scaleX(1);
          node.scaleY(1);
          onChange({
            x: node.x(),
            y: node.y(),
            width: Math.max(0.5, Math.round(furniture.width * scaleX * 10) / 10),
            depth: Math.max(0.5, Math.round(furniture.depth * scaleY * 10) / 10),
            rotation: node.rotation(),
          });
        }}
      >
        <Rect
          width={furniture.width}
          height={furniture.depth}
          fill={FILL}
          stroke={STROKE}
          strokeWidth={0.06}
          cornerRadius={0.1}
        />
        <Text
          text={furniture.name}
          width={furniture.width}
          height={furniture.depth}
          align="center"
          verticalAlign="middle"
          fontSize={0.45}
          fill={STROKE}
          listening={false}
        />
      </Group>
      {isSelected && <Transformer ref={trRef} rotateEnabled flipEnabled={false} />}
    </>
  );
}
