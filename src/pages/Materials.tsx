import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { MoreHorizontal, Palette, Plus } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import * as materialService from "@/services/materialService";
import * as roomService from "@/services/roomService";
import {
  MATERIAL_CATEGORY_LABELS,
  type AsyncState,
  type Material,
  type ProjectMaterialWithDetails,
  type Room,
  type UUID,
} from "@/types";
import { formatCurrency } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

const UNASSIGNED_ROOM = "__unassigned__";

export default function ProjectMaterialsPage() {
  const { id: projectId } = useParams<{ id: UUID }>();
  const company = useAuthStore((s) => s.company);

  const [board, setBoard] = useState<AsyncState<ProjectMaterialWithDetails[]>>({
    status: "idle",
  });
  const [library, setLibrary] = useState<AsyncState<Material[]>>({ status: "idle" });
  const [rooms, setRooms] = useState<Room[]>([]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>("");
  const [selectedRoomId, setSelectedRoomId] = useState<string>(UNASSIGNED_ROOM);
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [removeTarget, setRemoveTarget] = useState<ProjectMaterialWithDetails | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  function loadBoard() {
    if (!projectId) return;
    setBoard({ status: "loading" });
    materialService
      .listProjectMaterials(projectId)
      .then((data) =>
        setBoard(data.length === 0 ? { status: "empty" } : { status: "success", data })
      )
      .catch((err) =>
        setBoard({
          status: "error",
          error: err instanceof Error ? err.message : "Failed to load the materials board.",
        })
      );
  }

  useEffect(loadBoard, [projectId]);

  useEffect(() => {
    if (!company?.id) return;
    setLibrary({ status: "loading" });
    materialService
      .listMaterialsForCompany(company.id)
      .then((data) =>
        setLibrary(data.length === 0 ? { status: "empty" } : { status: "success", data })
      )
      .catch((err) =>
        setLibrary({
          status: "error",
          error: err instanceof Error ? err.message : "Failed to load your materials catalog.",
        })
      );
  }, [company?.id]);

  useEffect(() => {
    if (!projectId) return;
    roomService.listRoomsForProject(projectId).then(setRooms).catch(() => setRooms([]));
  }, [projectId]);

  function openAddDialog() {
    setSelectedMaterialId("");
    setSelectedRoomId(UNASSIGNED_ROOM);
    setNotes("");
    setFormError(null);
    setDialogOpen(true);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!projectId || !selectedMaterialId) return;
    setIsSaving(true);
    setFormError(null);
    try {
      await materialService.addMaterialToProject(
        projectId,
        selectedMaterialId,
        selectedRoomId === UNASSIGNED_ROOM ? null : selectedRoomId,
        notes
      );
      setDialogOpen(false);
      loadBoard();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to add material.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRemove() {
    if (!removeTarget) return;
    setIsRemoving(true);
    try {
      await materialService.removeMaterialFromProject(removeTarget.id);
      setRemoveTarget(null);
      loadBoard();
    } catch (err) {
      setBoard((prev) =>
        prev.status === "success"
          ? prev
          : {
              status: "error",
              error: err instanceof Error ? err.message : "Failed to remove material.",
            }
      );
      setRemoveTarget(null);
    } finally {
      setIsRemoving(false);
    }
  }

  // Group the board by room so a designer can see "what's picked for the
  // Living Room" at a glance, with unassigned picks (whole-project choices
  // like a wall paint used throughout) in their own section.
  const grouped: Record<string, ProjectMaterialWithDetails[]> =
    board.status === "success"
      ? board.data.reduce<Record<string, ProjectMaterialWithDetails[]>>((acc, pm) => {
          const key = pm.room_name ?? "Unassigned";
          (acc[key] ??= []).push(pm);
          return acc;
        }, {})
      : {};

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Materials</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Materials picked for this project, optionally assigned to a room.
          </p>
        </div>
        <Button onClick={openAddDialog} disabled={library.status !== "success"}>
          <Plus className="h-4 w-4 mr-2" />
          Add Material
        </Button>
      </div>

      {library.status === "empty" && (
        <p className="text-sm text-muted-foreground">
          Your company's materials catalog is empty —{" "}
          <Link to="/materials" className="underline">
            add some materials
          </Link>{" "}
          before you can attach any to this project.
        </p>
      )}

      {board.status === "loading" && (
        <Card>
          <CardContent className="p-6 space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </CardContent>
        </Card>
      )}

      {board.status === "error" && <p className="text-sm text-destructive">{board.error}</p>}

      {board.status === "empty" && (
        <Card>
          <CardContent className="p-10 text-center">
            <Palette className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
            <p className="font-medium">No materials picked yet</p>
            <p className="text-sm text-muted-foreground mt-1 mb-4">
              Add materials from your catalog and optionally assign them to a room.
            </p>
            <Button onClick={openAddDialog} disabled={library.status !== "success"}>
              <Plus className="h-4 w-4 mr-2" />
              Add Material
            </Button>
          </CardContent>
        </Card>
      )}

      {board.status === "success" && (
        <div className="space-y-6">
          {Object.entries(grouped).map(([roomName, items]) => (
            <Card key={roomName}>
              <CardContent className="p-0">
                <p className="px-6 py-3 text-sm font-medium border-b bg-muted/40">{roomName}</p>
                <ul className="divide-y">
                  {items.map((pm) => (
                    <li key={pm.id} className="flex items-center justify-between px-6 py-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{pm.material.name}</p>
                          <Badge variant="outline">
                            {MATERIAL_CATEGORY_LABELS[pm.material.category]}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {[pm.material.brand, pm.material.color, pm.material.finish]
                            .filter(Boolean)
                            .join(" · ") || "—"}
                          {pm.material.price_per_unit != null && (
                            <>
                              {" · "}
                              {formatCurrency(pm.material.price_per_unit, "INR")}
                              {pm.material.unit ? ` / ${pm.material.unit}` : ""}
                            </>
                          )}
                        </p>
                        {pm.notes && (
                          <p className="text-sm text-muted-foreground mt-1 italic">{pm.notes}</p>
                        )}
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem destructive onClick={() => setRemoveTarget(pm)}>
                            Remove
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add material</DialogTitle>
            <DialogDescription>
              Pick a material from your catalog and optionally assign it to a room.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Material</Label>
              <Select value={selectedMaterialId} onValueChange={setSelectedMaterialId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a material…" />
                </SelectTrigger>
                <SelectContent>
                  {library.status === "success" &&
                    library.data.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name} — {MATERIAL_CATEGORY_LABELS[m.category]}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Room (optional)</Label>
              <Select value={selectedRoomId} onValueChange={setSelectedRoomId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNASSIGNED_ROOM}>Whole project (unassigned)</SelectItem>
                  {rooms.map((room) => (
                    <SelectItem key={room.id} value={room.id}>
                      {room.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pm-notes">Notes</Label>
              <Textarea
                id="pm-notes"
                rows={3}
                placeholder="e.g. accent wall only, confirm stock before ordering…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            {formError && <p className="text-sm text-destructive">{formError}</p>}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving || !selectedMaterialId}>
                {isSaving ? "Adding…" : "Add material"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!removeTarget}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
        title="Remove material from this project?"
        description={`This removes ${removeTarget?.material.name ?? "this material"} from this project's board. It stays in your company catalog.`}
        isLoading={isRemoving}
        onConfirm={handleRemove}
      />
    </div>
  );
}
