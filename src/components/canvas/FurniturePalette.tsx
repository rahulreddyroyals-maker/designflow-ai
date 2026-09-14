import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { useCanvasStore } from "@/store/canvasStore";
import type { FurnitureCategory, FurnitureItem } from "@/types";
import { Input } from "@/components/ui/input";

const CATEGORY_LABELS: Record<FurnitureCategory, string> = {
  living: "Living",
  bedroom: "Bedroom",
  dining: "Dining",
  kitchen: "Kitchen",
  lighting: "Lighting",
  storage: "Storage",
  other: "Other",
};

/** Furniture items are draggable (native HTML5 drag-and-drop, handled by
 * CanvasStage's onDrop) and also have a "+" button that adds them at a
 * fixed canvas position — a reliable fallback for anyone who can't (or
 * doesn't want to) drag-and-drop. */
export function FurniturePalette() {
  const catalog = useCanvasStore((s) => s.catalog);
  const addFurniture = useCanvasStore((s) => s.addFurniture);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return term ? catalog.filter((item) => item.name.toLowerCase().includes(term)) : catalog;
  }, [catalog, search]);

  const grouped = useMemo(() => {
    const map = new Map<FurnitureCategory, FurnitureItem[]>();
    for (const item of filtered) {
      const list = map.get(item.category) ?? [];
      list.push(item);
      map.set(item.category, list);
    }
    return map;
  }, [filtered]);

  return (
    <div className="flex w-56 shrink-0 flex-col border-r bg-card">
      <div className="border-b p-3">
        <p className="text-sm font-medium">Furniture</p>
        <p className="mt-0.5 mb-2 text-xs text-muted-foreground">
          Drag onto the canvas, or click +
        </p>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-7 pl-7 text-xs"
            placeholder="Search furniture…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 && (
          <p className="p-3 text-xs text-muted-foreground">
            No furniture matches &ldquo;{search}&rdquo;.
          </p>
        )}
        {Array.from(grouped.entries()).map(([category, items]) => (
          <div key={category} className="border-b p-3 last:border-b-0">
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              {CATEGORY_LABELS[category]}
            </p>
            <div className="space-y-1">
              {items.map((item) => (
                <div
                  key={item.id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("furnitureItemId", item.id)}
                  className="flex cursor-grab items-center justify-between rounded-md border px-2 py-1.5 text-xs hover:bg-muted active:cursor-grabbing"
                >
                  <div className="min-w-0">
                    <p className="truncate">{item.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {item.width}×{item.depth} cm
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => addFurniture(item, { x: 10, y: 10 })}
                    className="shrink-0 text-muted-foreground hover:text-foreground"
                    title="Add to canvas"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
