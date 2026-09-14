import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FolderKanban, MoreHorizontal, Plus, Search } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { useProjectStore } from "@/store/projectStore";
import * as projectService from "@/services/projectService";
import {
  PROJECT_STATUS_LABELS,
  PROPERTY_TYPE_LABELS,
  type ProjectStatus,
  type ProjectSummary,
} from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

const STATUS_FILTER_OPTIONS: Array<{ value: ProjectStatus | "all"; label: string }> = [
  { value: "all", label: "All statuses" },
  ...(Object.keys(PROJECT_STATUS_LABELS) as ProjectStatus[]).map((status) => ({
    value: status,
    label: PROJECT_STATUS_LABELS[status],
  })),
];

export default function ProjectsPage() {
  const company = useAuthStore((s) => s.company);
  const { summaries, fetchSummaries } = useProjectStore();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | "all">("all");
  const [deleteTarget, setDeleteTarget] = useState<ProjectSummary | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (company?.id) fetchSummaries(company.id);
  }, [company?.id, fetchSummaries]);

  const filtered = useMemo(() => {
    if (summaries.status !== "success") return [];
    const term = search.trim().toLowerCase();
    return summaries.data.filter((project) => {
      const matchesStatus = statusFilter === "all" || project.status === statusFilter;
      const matchesSearch =
        !term ||
        project.name.toLowerCase().includes(term) ||
        project.client_name?.toLowerCase().includes(term);
      return matchesStatus && matchesSearch;
    });
  }, [summaries, search, statusFilter]);

  async function handleDelete() {
    if (!deleteTarget || !company?.id) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await projectService.deleteProject(deleteTarget.id);
      setDeleteTarget(null);
      fetchSummaries(company.id);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete project.");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Projects</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Every design project across your studio.
          </p>
        </div>
        <Button asChild>
          <Link to="/projects/new">
            <Plus className="h-4 w-4 mr-2" />
            New Project
          </Link>
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by project or client…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as ProjectStatus | "all")}
        >
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTER_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {deleteError && <p className="text-sm text-destructive">{deleteError}</p>}

      {summaries.status === "loading" && (
        <Card>
          <CardContent className="p-6 space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </CardContent>
        </Card>
      )}

      {summaries.status === "error" && (
        <p className="text-sm text-destructive">{summaries.error}</p>
      )}

      {summaries.status === "empty" && (
        <Card>
          <CardContent className="p-10 text-center">
            <FolderKanban className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
            <p className="font-medium">No projects yet</p>
            <p className="text-sm text-muted-foreground mt-1 mb-4">
              Start your first project from a floor plan.
            </p>
            <Button asChild>
              <Link to="/projects/new">
                <Plus className="h-4 w-4 mr-2" />
                New Project
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {summaries.status === "success" && (
        <Card>
          <CardContent className="p-0">
            {filtered.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">
                No projects match your search/filter.
              </p>
            ) : (
              <ul className="divide-y">
                {filtered.map((project) => (
                  <li
                    key={project.id}
                    className="flex items-center justify-between px-6 py-4 hover:bg-muted/50"
                  >
                    <Link to={`/projects/${project.id}`} className="flex-1 min-w-0">
                      <p className="font-medium truncate">{project.name}</p>
                      <p className="text-sm text-muted-foreground truncate">
                        {project.client_name ?? "No client"} ·{" "}
                        {PROPERTY_TYPE_LABELS[project.property_type]}
                        {project.bhk ? ` · ${project.bhk}` : ""}
                      </p>
                    </Link>
                    <div className="flex items-center gap-3 shrink-0">
                      <Badge>{PROJECT_STATUS_LABELS[project.status]}</Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link to={`/projects/${project.id}`}>Open</Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            destructive
                            onClick={() => setDeleteTarget(project)}
                          >
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete project?"
        description={`This permanently deletes "${deleteTarget?.name}" and everything in it — floor plans, rooms, furniture, concepts, and presentations. This can't be undone.`}
        isLoading={isDeleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}
