import { Group, Line, Text } from "react-konva";
import { useCanvasStore } from "@/store/canvasStore";

/** Ephemeral measurement display — click two points on canvas (measure
 * tool) to see the distance between them in feet. Not a persisted scene
 * object; it just reads the store's measureStart/measureEnd. */
export function MeasurementOverlay() {
  const start = useCanvasStore((s) => s.measureStart);
  const end = useCanvasStore((s) => s.measureEnd);

  if (!start || !end) return null;

  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const distanceFt = Math.sqrt(dx * dx + dy * dy);
  const midX = (start.x + end.x) / 2;
  const midY = (start.y + end.y) / 2;

  return (
    <Group listening={false}>
      <Line
        points={[start.x, start.y, end.x, end.y]}
        stroke="rgb(219, 39, 119)"
        strokeWidth={0.15}
        dash={[0.4, 0.3]}
      />
      <Text
        x={midX}
        y={midY - 1}
        text={`${distanceFt.toFixed(1)} ft`}
        fontSize={0.7}
        fill="rgb(219, 39, 119)"
        fontStyle="bold"
      />
    </Group>
  );
}
