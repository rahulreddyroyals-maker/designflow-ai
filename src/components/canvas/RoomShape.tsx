import { useEffect, useRef } from "react";
import { Group, Rect, Text, Transformer } from "react-konva";
import type Konva from "konva";
import { ROOM_TYPE_LABELS, type SceneRoom } from "@/types";

interface RoomShapeProps {
  room: SceneRoom;
  isSelected: boolean;
  draggable: boolean;
  onSelect: () => void;
  onChange: (patch: Partial<Omit<SceneRoom, "id" | "type">>) => void;
}

const FILL = "rgba(99, 102, 241, 0.12)";
const STROKE = "rgb(79, 70, 229)";
const STROKE_UNVERIFIED = "rgb(217, 119, 6)";

/**
 * The Group carries the room's single transform (position/rotation); the
 * Transformer is attached to the Group itself, not the child Rect — this
 * is the correct react-konva pattern for a rect-with-label that needs
 * combined drag+resize+rotate, since Transformer applies scale/rotation
 * directly to whatever node it's attached to.
 */
export function RoomShape({ room, isSelected, draggable, onSelect, onChange }: RoomShapeProps) {
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
        x={room.x}
        y={room.y}
        rotation={room.rotation}
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
            width: Math.max(1, Math.round(room.width * scaleX * 2) / 2),
            length: Math.max(1, Math.round(room.length * scaleY * 2) / 2),
            rotation: node.rotation(),
          });
        }}
      >
        <Rect
          width={room.width}
          height={room.length}
          fill={FILL}
          stroke={room.verified ? STROKE : STROKE_UNVERIFIED}
          strokeWidth={0.08}
        />
        <Text
          text={`${room.name}\n${ROOM_TYPE_LABELS[room.roomType]}`}
          width={room.width}
          height={room.length}
          align="center"
          verticalAlign="middle"
          fontSize={0.6}
          fill={STROKE}
          listening={false}
        />
      </Group>
      {isSelected && <Transformer ref={trRef} rotateEnabled flipEnabled={false} />}
    </>
  );
}
