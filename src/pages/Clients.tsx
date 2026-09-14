import { useEffect, useMemo, useState } from "react";
import { MoreHorizontal, Plus, Search, Users } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import * as clientService from "@/services/clientService";
import type { AsyncState, Client, ClientInput } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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

const EMPTY_FORM: ClientInput = { name: "", email: "", phone: "", address: "", notes: "" };

export default function ClientsPage() {
  const company = useAuthStore((s) => s.company);
  const [clients, setClients] = useState<AsyncState<Client[]>>({ status: "idle" });
  const [search, setSearch] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [form, setForm] = useState<ClientInput>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  function loadClients() {
    if (!company?.id) return;
    setClients({ status: "loading" });
    clientService
      .listClients(company.id)
      .then((data) =>
        setClients(data.length === 0 ? { status: "empty" } : { status: "success", data })
      )
      .catch((err) =>
        setClients({
          status: "error",
          error: err instanceof Error ? err.message : "Failed to load clients.",
        })
      );
  }

  useEffect(loadClients, [company?.id]);

  const filtered = useMemo(() => {
    if (clients.status !== "success") return [];
    const term = search.trim().toLowerCase();
    if (!term) return clients.data;
    return clients.data.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        c.email?.toLowerCase().includes(term) ||
        c.phone?.toLowerCase().includes(term)
    );
  }, [clients, search]);

  function openCreateDialog() {
    setEditingClient(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setDialogOpen(true);
  }

  function openEditDialog(client: Client) {
    setEditingClient(client);
    setForm({
      name: client.name,
      email: client.email ?? "",
      phone: client.phone ?? "",
      address: client.address ?? "",
      notes: client.notes ?? "",
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
      if (editingClient) {
        await clientService.updateClient(editingClient.id, form);
      } else {
        await clientService.createClient(company.id, form);
      }
      setDialogOpen(false);
      loadClients();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save client.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await clientService.deleteClient(deleteTarget.id);
      setDeleteTarget(null);
      loadClients();
    } catch (err) {
      // Surface inline rather than losing the error silently.
      setClients((prev) =>
        prev.status === "success"
          ? prev
          : {
              status: "error",
              error: err instanceof Error ? err.message : "Failed to delete client.",
            }
      );
      setDeleteTarget(null);
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Clients</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Everyone you design for, in one place.
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          New Client
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search clients…"
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {clients.status === "loading" && (
        <Card>
          <CardContent className="p-6 space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </CardContent>
        </Card>
      )}

      {clients.status === "error" && (
        <p className="text-sm text-destructive">{clients.error}</p>
      )}

      {clients.status === "empty" && (
        <Card>
          <CardContent className="p-10 text-center">
            <Users className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
            <p className="font-medium">No clients yet</p>
            <p className="text-sm text-muted-foreground mt-1 mb-4">
              Add a client so you can attach them to a project.
            </p>
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              New Client
            </Button>
          </CardContent>
        </Card>
      )}

      {clients.status === "success" && (
        <Card>
          <CardContent className="p-0">
            {filtered.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">
                No clients match &ldquo;{search}&rdquo;.
              </p>
            ) : (
              <ul className="divide-y">
                {filtered.map((client) => (
                  <li
                    key={client.id}
                    className="flex items-center justify-between px-6 py-4"
                  >
                    <div>
                      <p className="font-medium">{client.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {[client.email, client.phone].filter(Boolean).join(" · ") || "—"}
                      </p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEditDialog(client)}>
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          destructive
                          onClick={() => setDeleteTarget(client)}
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
            <DialogTitle>{editingClient ? "Edit client" : "New client"}</DialogTitle>
            <DialogDescription>
              {editingClient
                ? "Update this client's details."
                : "Add a client you can attach to projects."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="client-name">Name</Label>
              <Input
                id="client-name"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="client-email">Email</Label>
                <Input
                  id="client-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="client-phone">Phone</Label>
                <Input
                  id="client-phone"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="client-address">Address</Label>
              <Input
                id="client-address"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="client-notes">Notes</Label>
              <Textarea
                id="client-notes"
                rows={3}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
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
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Saving…" : editingClient ? "Save changes" : "Create client"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete client?"
        description={`This removes ${deleteTarget?.name ?? "this client"} from your client list. Any projects linked to them will become unassigned, not deleted.`}
        isLoading={isDeleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}
