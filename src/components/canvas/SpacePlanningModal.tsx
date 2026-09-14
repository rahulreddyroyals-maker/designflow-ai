import { useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import * as aiService from "@/services/aiService";
import { useCanvasStore } from "@/store/canvasStore";
import { newTempId } from "@/types/canvas";
import {
  STYLE_SUGGESTIONS,
  type FurnitureCategory,
  type FurnitureItem,
  type SceneFurniture,
  type SceneRoom,
  type SpaceLayoutConcept,
  type SpacePlanningPriority,
} from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CATEGORY_LABELS: Record<FurnitureCategory, string> = {
  living: "Living",
  bedroom: "Bedroom",
  dining: "Dining",
  kitchen: "Kitchen",
  lighting: "Lighting",
  storage: "Storage",
  other: "Other",
};

const PRIORITY_OPTIONS: { value: SpacePlanningPriority; label: string }[] = [
  { value: "balanced", label: "Balanced" },
  { value: "space", label: "Maximize space" },
  { value: "storage", label: "Maximize storage" },
];

interface SpacePlanningModalProps {
  room: SceneRoom;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * AI Task #2 — Space Planning. Strict flow: Generate → Preview → Apply.
 * Nothing here ever touches the existing scene until the designer clicks
 * "Apply" on a specific concept, and Apply only ADDS that concept's
 * furniture (via canvasStore.applyFurnitureLayout, a single atomic/
 * undo-able step) — it never clears or replaces what's already there.
 */
export function SpacePlanningModal({ room, open, onOpenChange }: SpacePlanningModalProps) {
  const catalog = useCanvasStore((s) => s.catalog);
  const applyFurnitureLayout = useCanvasStore((s) => s.applyFurnitureLayout);

  const [selectedNames, setSelectedNames] = useState<Set<string>>(new Set());
  const [style, setStyle] = useState("");
  const [priority, setPriority] = useState<SpacePlanningPriority>("balanced");

  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devFallbackNotice, setDevFallbackNotice] = useState<string | null>(null);
  const [layouts, setLayouts] = useState<SpaceLayoutConcept[] | null>(null);
  const [appliedNames, setAppliedNames] = useState<Set<string>>(new Set());

  const catalogById = useMemo(() => new Map(catalog.map((c) => [c.id, c])), [catalog]);
  const grouped = useMemo(() => {
    const map = new Map<FurnitureCategory, FurnitureItem[]>();
    for (const item of catalog) {
      const list = map.get(item.category) ?? [];
      list.push(item);
      map.set(item.category, list);
    }
    return map;
  }, [catalog]);

  function toggleRequirement(name: string) {
    setSelectedNames((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  async function handleGenerate() {
    setIsGenerating(true);
    setError(null);
    setDevFallbackNotice(null);
    setLayouts(null);
    try {
      const envelope = await aiService.generateSpacePlan({
        room_id: room.id,
        room_geometry: { width: room.width, length: room.length },
        furniture_requirements: Array.from(selectedNames),
        style,
        priority,
      });

      if (envelope.status === "failed") {
        setError(envelope.error ?? "Failed to generate layouts.");
      } else if (envelope.is_dev_fallback) {
        setDevFallbackNotice(
          "No AI provider is configured on the Edge Function (GROQ_API_KEY is unset) " +
            "— no layouts were generated. Configure it to try this for real."
        );
        setLayouts(envelope.output?.layouts ?? []);
      } else {
        setLayouts(envelope.output?.layouts ?? []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate layouts.");
    } finally {
      setIsGenerating(false);
    }
  }

  function handleApply(concept: SpaceLayoutConcept) {
    const items: SceneFurniture[] = concept.items
      .map((placed): SceneFurniture | null => {
        const catalogItem = catalogById.get(placed.furniture_item_id);
        if (!catalogItem) return null; // shouldn't happen — server already filters these
        return {
          id: newTempId(),
          type: "furniture",
          furnitureItemId: catalogItem.id,
          name: catalogItem.name,
          roomId: room.id,
          // Room-local coordinates from the AI -> absolute scene
          // coordinates by offsetting with the room's own position. This
          // doesn't account for room rotation — an accepted MVP
          // simplification since most rooms are placed axis-aligned.
          x: room.x + placed.x,
          y: room.y + placed.y,
          width: catalogItem.width / 30.48,
          depth: catalogItem.depth / 30.48,
          rotation: placed.rotation,
        };
      })
      .filter((item): item is SceneFurniture => item !== null);

    applyFurnitureLayout(items);
    setAppliedNames((prev) => new Set(prev).add(concept.name));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>AI Generate Layout — {room.name}</DialogTitle>
          <DialogDescription>
            Choose what you'd like included, then generate 3 concepts to preview. Applying a
            concept only adds its furniture to your design — nothing existing is changed, and
            Apply can always be undone.
          </DialogDescription>
        </DialogHeader>

        {!layouts && (
          <div className="space-y-4">
            <div className="max-h-48 overflow-y-auto rounded-md border p-3">
              {Array.from(grouped.entries()).map(([category, items]) => (
                <div key={category} className="mb-3 last:mb-0">
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                    {CATEGORY_LABELS[category]}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {items.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => toggleRequirement(item.name)}
                        className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                          selectedNames.has(item.name)
                            ? "border-primary bg-primary text-primary-foreground"
                            : "hover:bg-muted"
                        }`}
                      >
                        {item.name}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Style</Label>
                <Input
                  list="space-planning-style-suggestions"
                  placeholder="e.g. Modern Luxury"
                  value={style}
                  onChange={(e) => setStyle(e.target.value)}
                />
                <datalist id="space-planning-style-suggestions">
                  {STYLE_SUGGESTIONS.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Priority</Label>
                <Select
                  value={priority}
                  onValueChange={(v) => setPriority(v as SpacePlanningPriority)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button onClick={handleGenerate} disabled={isGenerating} className="w-full">
              <Sparkles className="mr-2 h-4 w-4" />
              {isGenerating ? "Generating…" : "Generate 3 Layouts"}
            </Button>
          </div>
        )}

        {layouts && (
          <div className="space-y-4">
            {devFallbackNotice && (
              <p className="text-sm text-amber-700">{devFallbackNotice}</p>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}

            {layouts.length === 0 && !devFallbackNotice && (
              <p className="text-sm text-muted-foreground">
                The AI didn't return any layouts for this room.
              </p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {layouts.map((concept) => (
                <Card key={concept.name}>
                  <CardHeader className="p-3">
                    <CardTitle className="text-sm">{concept.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-0 space-y-2">
                    <LayoutPreview room={room} concept={concept} catalogById={catalogById} />
                    <p className="text-xs text-muted-foreground line-clamp-3">
                      {concept.description}
                    </p>
                    <Button
                      size="sm"
                      className="w-full"
                      disabled={concept.items.length === 0 || appliedNames.has(concept.name)}
                      onClick={() => handleApply(concept)}
                    >
                      {appliedNames.has(concept.name) ? "Applied" : "Apply"}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Button variant="outline" size="sm" onClick={() => setLayouts(null)}>
              Back to options
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Lightweight, non-interactive SVG preview of a proposed layout — not
 * the full Konva canvas, just enough to let the designer compare concepts
 * before applying one. */
function LayoutPreview({
  room,
  concept,
  catalogById,
}: {
  room: SceneRoom;
  concept: SpaceLayoutConcept;
  catalogById: Map<string, FurnitureItem>;
}) {
  return (
    <div
      className="w-full rounded border bg-muted/30"
      style={{ aspectRatio: room.width / room.length }}
    >
      <svg viewBox={`0 0 ${room.width} ${room.length}`} className="h-full w-full">
        {concept.items.map((placed, i) => {
          const item = catalogById.get(placed.furniture_item_id);
          if (!item) return null;
          const w = item.width / 30.48;
          const d = item.depth / 30.48;
          return (
            <rect
              key={i}
              x={placed.x}
              y={placed.y}
              width={w}
              height={d}
              transform={`rotate(${placed.rotation}, ${placed.x + w / 2}, ${placed.y + d / 2})`}
              fill="rgba(180, 83, 9, 0.3)"
              stroke="rgb(180, 83, 9)"
              strokeWidth={0.05}
            />
          );
        })}
      </svg>
    </div>
  );
}
