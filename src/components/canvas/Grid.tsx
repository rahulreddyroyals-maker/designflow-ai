import { Line } from "react-konva";

const GRID_EXTENT_FT = 100;
const MAJOR_EVERY = 5;

/** Renders as raw Konva nodes (not its own <Layer> — Konva Layers can't
 * nest), meant to be placed inside CanvasStage's single Layer, first, so
 * everything else draws on top of it. Coordinates are in scene feet; the
 * Stage's own scale (zoom) handles pixel conversion. */
export function Grid() {
  const lines = [];
  for (let i = 0; i <= GRID_EXTENT_FT; i++) {
    const isMajor = i % MAJOR_EVERY === 0;
    lines.push(
      <Line
        key={`v-${i}`}
        points={[i, 0, i, GRID_EXTENT_FT]}
        stroke={isMajor ? "#cbd5e1" : "#e2e8f0"}
        strokeWidth={isMajor ? 0.03 : 0.015}
        listening={false}
      />
    );
    lines.push(
      <Line
        key={`h-${i}`}
        points={[0, i, GRID_EXTENT_FT, i]}
        stroke={isMajor ? "#cbd5e1" : "#e2e8f0"}
        strokeWidth={isMajor ? 0.03 : 0.015}
        listening={false}
      />
    );
  }
  return <>{lines}</>;
}
