import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, FileText, Pencil, Trash2 } from "lucide-react";
import * as projectService from "@/services/projectService";
import * as clientService from "@/services/clientService";
import * as floorPlanService from "@/services/floorPlanService";
import {
  PROJECT_STATUSES,
  PROJECT_STATUS_LABELS,
  PROPERTY_TYPE_LABELS,
  STYLE_SUGGESTIONS,
  type AsyncState,
  type Client,
  type FloorPlan,
  type Project,
  type ProjectStatus,
  type PropertyType,
  type UpdateProjectInput,
} from "@/types";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { FloorPlanStatusBadge } from "@/components/floor-plan/FloorPlanStatusBadge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

type PageState = AsyncState<{ project: Project; client: Client | null }>;

const SUB_MODULES = [
  { to: "analyze", label: "Floor Plan Analyzer" },
  { to: "design", label: "Design Workspace" },
  { to: "materials", label: "Materials" },
  { to: "concepts", label: "Design Concepts" },
  { to: "presentation", label: "Client Presentation" },
];

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [state, setState] = useState<PageState>({ status: "idle" });
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<UpdateProjectInput>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [floorPlanState, setFloorPlanState] = useState<AsyncState<FloorPlan | null>>({
    status: "idle",
  });

  useEffect(() => {
    if (!id) return;
    setFloorPlanState({ status: "loading" });
    floorPlanService
      .listFloorPlansForProject(id)
      .then((list) => setFloorPlanState({ status: "success", data: list[0] ?? null }))
      .catch((err) =>
        setFloorPlanState({
          status: "error",
          error: err instanceof Error ? err.message : "Failed to load floor plan.",
        })
      );
  }, [id]);

  function load() {
    if (!id) return;
    setState({ status: "loading" });
    projectService
      .getProject(id)
      .then(async (project) => {
        if (!project) {
          setState({ status: "error", error: "Project not found." });
          return;
        }
        const client = project.client_id
          ? await clientService.getClient(project.client_id)
          : null;
        setState({ status: "success", data: { project, client } });
      })
      .catch((err) =>
        setState({
          status: "error",
          error: err instanceof Error ? err.message : "Failed to load project.",
        })
      );
  }

  useEffect(load, [id]);

  async function handleStatusChange(status: ProjectStatus) {
    if (!id || state.status !== "success") return;
    setIsUpdatingStatus(true);
    try {
      await projectService.updateProjectStatus(id, status);
      setState({
        status: "success",
        data: { ...state.data, project: { ...state.data.project, status } },
      });
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to update status.");
    } finally {
      setIsUpdatingStatus(false);
    }
  }

  function openEditDialog() {
    if (state.status !== "success") return;
    const { project } = state.data;
    setEditForm({
      name: project.name,
      client_id: project.client_id,
      property_type: project.property_type,
      bhk: project.bhk,
      area_sqft: project.area_sqft,
      budget: project.budget,
      style: project.style,
      notes: project.description,
    });
    setSaveError(null);
    setEditOpen(true);
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const updated = await projectService.updateProject(id, editForm);
      setState((prev) =>
        prev.status === "success"
          ? { status: "success", data: { ...prev.data, project: updated } }
          : prev
      );
      setEditOpen(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save changes.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!id) return;
    setIsDeleting(true);
    try {
      await projectService.deleteProject(id);
      navigate("/projects", { replace: true });
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete project.");
      setIsDeleting(false);
    }
  }

  if (state.status === "loading" || state.status === "idle") {
    return (
      <div className="p-8 space-y-4 max-w-4xl">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="p-8">
        <p className="text-sm text-destructive">{state.error}</p>
        <Button variant="outline" size="sm" className="mt-4" asChild>
          <Link to="/projects">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to projects
          </Link>
        </Button>
      </div>
    );
  }

  const { project, client } = state.data;

  return (
    <div className="p-8 max-w-4xl space-y-6">
      <Link
        to="/projects"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        All projects
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{project.name}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {client ? (
              <Link to="/clients" className="hover:underline">
                {client.name}
              </Link>
            ) : (
              "No client assigned"
            )}
            {" · "}
            {PROPERTY_TYPE_LABELS[project.property_type]}
            {project.bhk ? ` · ${project.bhk}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={openEditDialog}>
            <Pencil className="h-4 w-4 mr-2" />
            Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Overview</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-y-4 text-sm">
              <Field label="Area">
                {project.area_sqft ? `${project.area_sqft} sq.ft` : "—"}
              </Field>
              <Field label="Budget">
                {formatCurrency(project.budget, project.currency)}
              </Field>
              <Field label="Preferred style">{project.style || "—"}</Field>
              <Field label="Status">
                <Badge>{PROJECT_STATUS_LABELS[project.status]}</Badge>
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap text-muted-foreground">
                {project.description || "No notes yet."}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Workspace</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {SUB_MODULES.map((mod) => (
                <Link
                  key={mod.to}
                  to={`/projects/${project.id}/${mod.to}`}
                  className="rounded-md border px-3 py-3 text-sm font-medium hover:bg-muted transition-colors"
                >
                  {mod.label}
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Status</CardTitle>
            </CardHeader>
            <CardContent>
              <Select
                value={project.status}
                onValueChange={(v) => handleStatusChange(v as ProjectStatus)}
                disabled={isUpdatingStatus}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROJECT_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {PROJECT_STATUS_LABELS[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Floor Plan</CardTitle>
            </CardHeader>
            <CardContent>
              {floorPlanState.status === "loading" && <Skeleton className="h-16 w-full" />}
              {floorPlanState.status === "error" && (
                <p className="text-sm text-destructive">{floorPlanState.error}</p>
              )}
              {floorPlanState.status === "success" && !floorPlanState.data && (
                <div className="text-center py-2">
                  <FileText className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground mb-3">Not uploaded yet</p>
                  <Button size="sm" variant="outline" asChild>
                    <Link to={`/projects/${project.id}/analyze`}>Upload</Link>
                  </Button>
                </div>
              )}
              {floorPlanState.status === "success" && floorPlanState.data && (
                <div className="space-y-3">
                  <p className="text-sm font-medium truncate">
                    {floorPlanState.data.original_filename}
                  </p>
                  <FloorPlanStatusBadge status={floorPlanState.data.analysis_status} />
                  <Button size="sm" variant="outline" className="w-full" asChild>
                    <Link to={`/projects/${project.id}/analyze`}>View</Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Activity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Field label="Created">{formatDate(project.created_at)}</Field>
              <Field label="Last updated">{formatDateTime(project.updated_at)}</Field>
            </CardContent>
          </Card>
        </div>
      </div>

      {deleteError && <p className="text-sm text-destructive">{deleteError}</p>}


      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit project</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveEdit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="edit-name">Project name</Label>
              <Input
                id="edit-name"
                value={editForm.name ?? ""}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Property type</Label>
                <Select
                  value={editForm.property_type ?? project.property_type}
                  onValueChange={(v) =>
                    setEditForm({ ...editForm, property_type: v as PropertyType })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(PROPERTY_TYPE_LABELS) as PropertyType[]).map((pt) => (
                      <SelectItem key={pt} value={pt}>
                        {PROPERTY_TYPE_LABELS[pt]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-bhk">BHK</Label>
                <Input
                  id="edit-bhk"
                  value={editForm.bhk ?? ""}
                  onChange={(e) => setEditForm({ ...editForm, bhk: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-area">Area (sq.ft)</Label>
                <Input
                  id="edit-area"
                  type="number"
                  value={editForm.area_sqft ?? ""}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      area_sqft: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-budget">Budget</Label>
                <Input
                  id="edit-budget"
                  type="number"
                  value={editForm.budget ?? ""}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      budget: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-style">Preferred style</Label>
              <Input
                id="edit-style"
                list="edit-style-suggestions"
                value={editForm.style ?? ""}
                onChange={(e) => setEditForm({ ...editForm, style: e.target.value })}
              />
              <datalist id="edit-style-suggestions">
                {STYLE_SUGGESTIONS.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-notes">Notes</Label>
              <Textarea
                id="edit-notes"
                rows={4}
                value={editForm.notes ?? ""}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
              />
            </div>

            {saveError && <p className="text-sm text-destructive">{saveError}</p>}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditOpen(false)}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Saving…" : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this project?"
        description={`This permanently deletes "${project.name}" and everything in it — floor plans, rooms, furniture, concepts, and presentations. This can't be undone.`}
        isLoading={isDeleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="font-medium mt-0.5">{children}</div>
    </div>
  );
}
