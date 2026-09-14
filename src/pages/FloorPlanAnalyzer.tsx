import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Sparkles, Trash2 } from "lucide-react";
import * as floorPlanService from "@/services/floorPlanService";
import * as floorPlanElementService from "@/services/floorPlanElementService";
import * as projectService from "@/services/projectService";
import * as aiService from "@/services/aiService";
import type { AsyncState, FloorPlan, Project } from "@/types";
import { formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FloorPlanDropzone } from "@/components/floor-plan/FloorPlanDropzone";
import { FloorPlanPreview } from "@/components/floor-plan/FloorPlanPreview";
import { Badge } from "@/components/ui/badge";
import { FloorPlanStatusBadge } from "@/components/floor-plan/FloorPlanStatusBadge";
import { FloorPlanAnalysisOverlay } from "@/components/floor-plan/FloorPlanAnalysisOverlay";
import { RoomVerificationList } from "@/components/floor-plan/RoomVerificationList";

type PageState = AsyncState<{ project: Project; floorPlans: FloorPlan[] }>;

export default function FloorPlanAnalyzerPage() {
  const { id } = useParams<{ id: string }>();
  const [state, setState] = useState<PageState>({ status: "idle" });

  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<FloorPlan | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [analyzeNotice, setAnalyzeNotice] = useState<string | null>(null);

  const [structureAccepted, setStructureAccepted] = useState(false);
  const [isAcceptingStructure, setIsAcceptingStructure] = useState(false);

  // Derived unconditionally (before any early return) so hooks/handlers
  // below can depend on it without breaking the Rules of Hooks.
  const current =
    state.status === "success" ? (state.data.floorPlans[0] ?? null) : null;
  const projectRef = state.status === "success" ? state.data.project : null;

  function load() {
    if (!id) return;
    setState({ status: "loading" });
    Promise.all([projectService.getProject(id), floorPlanService.listFloorPlansForProject(id)])
      .then(([project, floorPlans]) => {
        if (!project) {
          setState({ status: "error", error: "Project not found." });
          return;
        }
        setState({ status: "success", data: { project, floorPlans } });
      })
      .catch((err) =>
        setState({
          status: "error",
          error: err instanceof Error ? err.message : "Failed to load floor plans.",
        })
      );
  }

  useEffect(load, [id]);

  // Whether this floor plan's detected structure (walls/doors/windows) has
  // already been accepted into `floor_plan_elements`, so the bulk-accept
  // button reflects reality across page reloads rather than resetting.
  useEffect(() => {
    if (!current) {
      setStructureAccepted(false);
      return;
    }
    floorPlanElementService
      .listElementsForFloorPlan(current.id)
      .then((elements) => setStructureAccepted(elements.length > 0))
      .catch(() => {
        // Non-fatal — worst case the button is re-shown and accepting
        // again just adds duplicate rows, which the designer can clean up.
      });
  }, [current?.id]);

  async function handleUpload() {
    if (!id || !uploadFile) return;
    setIsUploading(true);
    setUploadError(null);
    try {
      await floorPlanService.uploadFloorPlan(id, uploadFile);
      setUploadFile(null);
      load();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Failed to upload floor plan.");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await floorPlanService.deleteFloorPlan(deleteTarget);
      setDeleteTarget(null);
      load();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Failed to delete floor plan.");
      setDeleteTarget(null);
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleAnalyze() {
    if (!current || state.status !== "success") return;
    setIsAnalyzing(true);
    setAnalyzeError(null);
    setAnalyzeNotice(null);
    try {
      const envelope = await aiService.analyzeFloorPlan({
        floor_plan_id: current.id,
        storage_path: current.storage_path,
        file_type: current.file_type,
        project_context: {
          property_type: state.data.project.property_type,
          bhk: state.data.project.bhk,
          area_sqft: state.data.project.area_sqft,
        },
      });

      if (envelope.status === "failed") {
        setAnalyzeError(envelope.error ?? "Analysis failed.");
      } else if (envelope.is_dev_fallback) {
        setAnalyzeNotice(
          "No AI provider is configured on the Edge Function (GROQ_API_KEY is unset), " +
            "so this ran in dev fallback mode — it returned zero detections rather than a real analysis."
        );
      }
      load();
    } catch (err) {
      setAnalyzeError(err instanceof Error ? err.message : "Failed to run analysis.");
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function handleAcceptStructure() {
    if (!current?.analysis_result || !projectRef) return;
    setIsAcceptingStructure(true);
    setAnalyzeError(null);
    try {
      const { walls, doors, windows } = current.analysis_result;
      await floorPlanElementService.bulkCreateElements(projectRef.id, current.id, [
        ...walls.map((w) => ({
          element_type: "wall" as const,
          points: w.points,
          confidence_score: w.confidence,
        })),
        ...doors.map((d) => ({
          element_type: "door" as const,
          points: d.points,
          width: d.width_ft,
          confidence_score: d.confidence,
        })),
        ...windows.map((w) => ({
          element_type: "window" as const,
          points: w.points,
          width: w.width_ft,
          confidence_score: w.confidence,
        })),
      ]);
      setStructureAccepted(true);
    } catch (err) {
      setAnalyzeError(err instanceof Error ? err.message : "Failed to save structure.");
    } finally {
      setIsAcceptingStructure(false);
    }
  }

  if (state.status === "loading" || state.status === "idle") {
    return (
      <div className="p-8 space-y-4 max-w-4xl">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="p-8">
        <p className="text-sm text-destructive">{state.error}</p>
      </div>
    );
  }

  const { project, floorPlans } = state.data;
  const history = floorPlans.slice(1);
  const analysis = current?.analysis_result ?? null;
  const structureCount = analysis
    ? analysis.walls.length + analysis.doors.length + analysis.windows.length
    : 0;

  return (
    <div className="p-8 max-w-4xl space-y-6">
      <Link
        to={`/projects/${project.id}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {project.name}
      </Link>

      <div>
        <h1 className="text-2xl font-semibold">Floor Plan</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Upload the architect's floor plan, run AI analysis, then review and accept what it
          finds. Nothing the AI detects becomes part of your project until you accept it.
        </p>
      </div>

      {current ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">{current.original_filename}</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Uploaded {formatDateTime(current.created_at)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <FloorPlanStatusBadge status={current.analysis_status} />
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive hover:text-destructive"
                onClick={() => setDeleteTarget(current)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {analysis && current.file_type !== "pdf" ? (
              <FloorPlanAnalysisOverlay floorPlan={current} analysis={analysis} />
            ) : (
              <FloorPlanPreview floorPlan={current} />
            )}

            {analysis && current.file_type === "pdf" && (
              <p className="text-xs text-muted-foreground">
                Visual overlay isn't available for PDFs yet — review the detected rooms below
                and see raw counts for walls/doors/windows.
              </p>
            )}

            {current.file_type === "pdf" && (
              <p className="text-xs text-amber-700">
                AI analysis isn't available for PDF floor plans with the current AI provider
                (Groq) — its vision model only accepts images. Re-upload this floor plan as a
                JPG or PNG to analyze it.
              </p>
            )}

            <div className="flex items-center gap-3">
              <Button
                onClick={handleAnalyze}
                disabled={isAnalyzing || current.file_type === "pdf"}
              >
                <Sparkles className="h-4 w-4 mr-2" />
                {isAnalyzing
                  ? "Analyzing…"
                  : analysis
                    ? "Re-analyze"
                    : "Analyze with AI"}
              </Button>
              {analysis && (
                <span className="text-xs text-muted-foreground">
                  Overall confidence: {Math.round(analysis.confidence * 100)}%
                </span>
              )}
            </div>

            {analyzeError && <p className="text-sm text-destructive">{analyzeError}</p>}
            {analyzeNotice && <p className="text-sm text-amber-700">{analyzeNotice}</p>}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground">
            No floor plan uploaded yet for this project.
          </CardContent>
        </Card>
      )}

      {analysis && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Rooms detected</CardTitle>
            </CardHeader>
            <CardContent>
              <RoomVerificationList
                projectId={project.id}
                rooms={analysis.rooms}
                onAccepted={load}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Structure detected</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  {analysis.walls.length} walls · {analysis.doors.length} doors ·{" "}
                  {analysis.windows.length} windows
                </p>
              </div>
              {structureCount > 0 &&
                (structureAccepted ? (
                  <Badge variant="success">Accepted</Badge>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleAcceptStructure}
                    disabled={isAcceptingStructure}
                  >
                    {isAcceptingStructure ? "Saving…" : "Accept structure"}
                  </Button>
                ))}
            </CardHeader>
            {analysis.dimensions.length > 0 && (
              <CardContent className="pt-0">
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  Detected dimensions
                </p>
                <ul className="text-sm space-y-1">
                  {analysis.dimensions.map((dim, i) => (
                    <li key={i} className="text-muted-foreground">
                      {dim.label}: <span className="text-foreground">{dim.value_ft} ft</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            )}
          </Card>

          {analysis.warnings.length > 0 && (
            <Card className="border-amber-300">
              <CardHeader>
                <CardTitle className="text-base">Notes from the analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="text-sm space-y-1 text-muted-foreground list-disc pl-4">
                  {analysis.warnings.map((warning, i) => (
                    <li key={i}>{warning}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {current ? "Replace with a new upload" : "Upload a floor plan"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <FloorPlanDropzone
            file={uploadFile}
            onSelect={setUploadFile}
            onClear={() => setUploadFile(null)}
            error={uploadError}
          />
          <Button onClick={handleUpload} disabled={!uploadFile || isUploading}>
            {isUploading ? "Uploading…" : "Upload"}
          </Button>
        </CardContent>
      </Card>

      {history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Previous uploads</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y">
              {history.map((fp) => (
                <li key={fp.id} className="flex items-center justify-between px-6 py-4">
                  <div>
                    <p className="font-medium text-sm">{fp.original_filename}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(fp.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <FloorPlanStatusBadge status={fp.analysis_status} />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(fp)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete this floor plan?"
        description={`This permanently removes "${deleteTarget?.original_filename}" from storage. This can't be undone.`}
        isLoading={isDeleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}
