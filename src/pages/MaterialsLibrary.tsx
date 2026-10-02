import { useEffect, useMemo, useState } from "react";
import { MoreHorizontal, Palette, Plus, Search } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import * as materialService from "@/services/materialService";
import {
  MATERIAL_CATEGORIES,
  MATERIAL_CATEGORY_LABELS,
  type AsyncState,
  type Material,
  type MaterialCategory,
  type MaterialInput,
} from "@/types";
import { formatCurrency } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

const EMPTY_FORM: MaterialInput = {
  name: "",
  category: "flooring",
  brand: "",
  product_code: "",
  color: "",
  finish: "",
  price_per_unit: null,
  unit: "",
};

export default function MaterialsLibraryPage() {
  const company = useAuthStore((s) => s.company);
  const [materials, setMaterials] = useState<AsyncState<Material[]>>({ status: "idle" });
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<MaterialCategory | "all">("all");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [form, setForm] = useState<MaterialInput>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Material | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function loadMaterials() {
    if (!company?.id) return;
    setMaterials({ status: "loading" });
    materialService
      .listMaterialsForCompany(company.id)
      .then((data) =>
        setMaterials(data.length === 0 ? { status: "empty" } : { status: "success", data })
      )
      .catch((err) =>
        setMaterials({
          status: "error",
          error: err instanceof Error ? err.message : "Failed to load materials.",
        })
      );
  }

  useEffect(loadMaterials, [company?.id]);

  const filtered = useMemo(() => {
    if (materials.status !== "success") return [];
    const term = search.trim().toLowerCase();
    return materials.data.filter((m) => {
      if (categoryFilter !== "all" && m.category !== categoryFilter) return false;
      if (!term) return true;
      return (
        m.name.toLowerCase().includes(term) ||
        m.brand?.toLowerCase().includes(term) ||
        m.product_code?.toLowerCase().includes(term) ||
        m.color?.toLowerCase().includes(term)
      );
    });
  }, [materials, search, categoryFilter]);

  function openCreateDialog() {
    setEditingMaterial(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setDialogOpen(true);
  }

  function openEditDialog(material: Material) {
    setEditingMaterial(material);
    setForm({
      name: material.name,
      category: material.category,
      brand: material.brand ?? "",
      product_code: material.product_code ?? "",
      color: material.color ?? "",
      finish: material.finish ?? "",
      price_per_unit: material.price_per_unit,
      unit: material.unit ?? "",
    });
    setFormError(null);
    setDialogOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!company?.id) return;
    setIsSaving(true);
    setFormError(null);
    try {
      if (editingMaterial) {
        await materialService.updateMaterial(editingMaterial.id, form);
      } else {
        await materialService.createMaterial(company.id, form);
      }
      setDialogOpen(false);
      loadMaterials();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save material.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await materialService.deleteMaterial(deleteTarget.id);
      setDeleteTarget(null);
      loadMaterials();
    } catch (err) {
      // A material still attached to a project board can't be deleted
      // (project_materials.material_id has no cascade) — surface that
      // real constraint error rather than pretending the delete worked.
      setDeleteError(
        err instanceof Error
          ? err.message
          : "Failed to delete material. It may still be in use on a project."
      );
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Materials</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Your company-wide materials catalog. Add materials here, then attach them to any
            project's board.
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          New Material
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search materials…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select
          value={categoryFilter}
          onValueChange={(v) => setCategoryFilter(v as MaterialCategory | "all")}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {MATERIAL_CATEGORIES.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {MATERIAL_CATEGORY_LABELS[cat]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {deleteError && <p className="text-sm text-destructive">{deleteError}</p>}

      {materials.status === "loading" && (
        <Card>
          <CardContent className="p-6 space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </CardContent>
        </Card>
      )}

      {materials.status === "error" && (
        <p className="text-sm text-destructive">{materials.error}</p>
      )}

      {materials.status === "empty" && (
        <Card>
          <CardContent className="p-10 text-center">
            <Palette className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
            <p className="font-medium">No materials yet</p>
            <p className="text-sm text-muted-foreground mt-1 mb-4">
              Add flooring, paint, laminates, fabrics and more — once they're here, attach them to
              any project's materials board.
            </p>
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              New Material
            </Button>
          </CardContent>
        </Card>
      )}

      {materials.status === "success" && (
        <Card>
          <CardContent className="p-0">
            {filtered.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">
                No materials match your filters.
              </p>
            ) : (
              <ul className="divide-y">
                {filtered.map((material) => (
                  <li
                    key={material.id}
                    className="flex items-center justify-between px-6 py-4"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{material.name}</p>
                        <Badge variant="outline">
                          {MATERIAL_CATEGORY_LABELS[material.category]}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {[material.brand, material.color, material.finish]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                        {material.price_per_unit != null && (
                          <>
                            {" · "}
                            {formatCurrency(material.price_per_unit, "INR")}
                            {material.unit ? ` / ${material.unit}` : ""}
                          </>
                        )}
                      </p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEditDialog(material)}>
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          destructive
                          onClick={() => setDeleteTarget(material)}
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingMaterial ? "Edit material" : "New material"}</DialogTitle>
            <DialogDescription>
              {editingMaterial
                ? "Update this material's details."
                : "Add a material to your company's catalog."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="material-name">Name</Label>
                <Input
                  id="material-name"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select
                  value={form.category}
                  onValueChange={(v) => setForm({ ...form, category: v as MaterialCategory })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MATERIAL_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {MATERIAL_CATEGORY_LABELS[cat]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="material-brand">Brand</Label>
                <Input
                  id="material-brand"
                  value={form.brand ?? ""}
                  onChange={(e) => setForm({ ...form, brand: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="material-code">Product code</Label>
                <Input
                  id="material-code"
                  value={form.product_code ?? ""}
                  onChange={(e) => setForm({ ...form, product_code: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="material-color">Color</Label>
                <Input
                  id="material-color"
                  value={form.color ?? ""}
                  onChange={(e) => setForm({ ...form, color: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="material-finish">Finish</Label>
                <Input
                  id="material-finish"
                  value={form.finish ?? ""}
                  onChange={(e) => setForm({ ...form, finish: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="material-price">Price per unit</Label>
                <Input
                  id="material-price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.price_per_unit ?? ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      price_per_unit: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="material-unit">Unit</Label>
                <Input
                  id="material-unit"
                  placeholder="sq.ft, running ft, piece…"
                  value={form.unit ?? ""}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                />
              </div>
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
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Saving…" : editingMaterial ? "Save changes" : "Create material"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete material?"
        description={`This removes ${deleteTarget?.name ?? "this material"} from your catalog. If it's attached to a project's board, remove it from there first.`}
        isLoading={isDeleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}
