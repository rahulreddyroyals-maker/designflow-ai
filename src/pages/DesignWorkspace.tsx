import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useCanvasStore } from "@/store/canvasStore";
import { Toolbar } from "@/components/canvas/Toolbar";
import { FurniturePalette } from "@/components/canvas/FurniturePalette";
import { CanvasStage } from "@/components/canvas/CanvasStage";
import { PropertiesPanel } from "@/components/canvas/PropertiesPanel";
import { Skeleton } from "@/components/ui/skeleton";

export default function DesignWorkspacePage() {
  const { id } = useParams<{ id: string }>();
  const loadProject = useCanvasStore((s) => s.loadProject);
  const reset = useCanvasStore((s) => s.reset);
  const isLoading = useCanvasStore((s) => s.isLoading);
  const loadError = useCanvasStore((s) => s.loadError);
  const saveError = useCanvasStore((s) => s.saveError);

  useEffect(() => {
    if (id) loadProject(id);
    return () => reset();
  }, [id, loadProject, reset]);

  if (isLoading) {
    return (
      <div className="space-y-4 p-8">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[32rem] w-full" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="p-8">
        <p className="text-sm text-destructive">{loadError}</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b px-4 py-2">
        <Link
          to={`/projects/${id}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to project
        </Link>
      </div>
      <Toolbar />
      {saveError && (
        <p className="border-b px-4 py-2 text-sm text-destructive">{saveError}</p>
      )}
      <div className="flex flex-1 overflow-hidden">
        <FurniturePalette />
        <CanvasStage />
        <PropertiesPanel />
      </div>
    </div>
  );
}
