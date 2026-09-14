import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check } from "lucide-react";
import { FloorPlanDropzone } from "@/components/floor-plan/FloorPlanDropzone";
import { useAuthStore } from "@/store/authStore";
import * as projectService from "@/services/projectService";
import * as clientService from "@/services/clientService";
import * as floorPlanService from "@/services/floorPlanService";
import {
  PROPERTY_TYPE_LABELS,
  STYLE_SUGGESTIONS,
  type Client,
  type ClientInput,
  type PropertyType,
} from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const STEPS = ["Project Info", "Client", "Design Preferences", "Floor Plan"] as const;
type ClientMode = "existing" | "new" | "none";

export default function NewProjectPage() {
  const navigate = useNavigate();
  const company = useAuthStore((s) => s.company);
  const profile = useAuthStore((s) => s.profile);

  const [step, setStep] = useState(0);

  // Step 1 — project info
  const [name, setName] = useState("");
  const [propertyType, setPropertyType] = useState<PropertyType>("apartment");
  const [bhk, setBhk] = useState("");
  const [areaSqft, setAreaSqft] = useState("");
  const [budget, setBudget] = useState("");

  // Step 2 — client
  const [clientMode, setClientMode] = useState<ClientMode>("existing");
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [newClient, setNewClient] = useState<ClientInput>({ name: "", email: "", phone: "" });

  // Step 3 — design preferences
  const [style, setStyle] = useState("");
  const [notes, setNotes] = useState("");

  // Step 4 — floor plan
  const [floorPlanFile, setFloorPlanFile] = useState<File | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [uploadWarning, setUploadWarning] = useState<string | null>(null);

  useEffect(() => {
    if (!company?.id) return;
    clientService.listClients(company.id).then(setClients).catch(() => {
      // Non-fatal — the wizard still works with "No client yet" or
      // "New client"; just won't offer an existing-client list.
    });
  }, [company?.id]);

  const stepValid = (() => {
    if (step === 0) return name.trim().length > 0;
    if (step === 1) {
      if (clientMode === "existing") return selectedClientId.length > 0;
      if (clientMode === "new") return newClient.name.trim().length > 0;
      return true; // "none"
    }
    return true; // steps 3 and 4 have no required fields
  })();

  async function handleCreate() {
    if (!company?.id || !profile?.id) return;
    setIsSubmitting(true);
    setSubmitError(null);
    setUploadWarning(null);

    try {
      let clientId: string | undefined;
      if (clientMode === "existing") {
        clientId = selectedClientId;
      } else if (clientMode === "new" && newClient.name.trim()) {
        const created = await clientService.createClient(company.id, newClient);
        clientId = created.id;
      }

      const project = await projectService.createProject(company.id, profile.id, {
        name: name.trim(),
        client_id: clientId,
        property_type: propertyType,
        bhk: bhk.trim() || undefined,
        area_sqft: areaSqft ? Number(areaSqft) : undefined,
        budget: budget ? Number(budget) : undefined,
        currency: company.currency,
        style: style.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      if (floorPlanFile) {
        try {
          await floorPlanService.uploadFloorPlan(project.id, floorPlanFile);
        } catch (uploadErr) {
          // Don't block project creation on a storage hiccup — the
          // designer can retry the upload from the project page.
          setUploadWarning(
            uploadErr instanceof Error
              ? `Project created, but the floor plan upload failed: ${uploadErr.message}`
              : "Project created, but the floor plan upload failed."
          );
        }
      }

      navigate(`/projects/${project.id}`, { replace: true });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to create project.");
      setIsSubmitting(false);
    }
  }

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">New Project</h1>
        <p className="text-muted-foreground text-sm mt-1">
          A few details to get started — you can refine everything later.
        </p>
      </div>

      <Stepper current={step} />

      <Card>
        <CardContent className="p-6 space-y-5">
          {step === 0 && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="name">Project name</Label>
                <Input
                  id="name"
                  placeholder="e.g. Green Valley 3BHK"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Property type</Label>
                  <Select
                    value={propertyType}
                    onValueChange={(v) => setPropertyType(v as PropertyType)}
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
                  <Label htmlFor="bhk">BHK</Label>
                  <Input
                    id="bhk"
                    placeholder="e.g. 3BHK"
                    value={bhk}
                    onChange={(e) => setBhk(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="area">Area (sq.ft)</Label>
                  <Input
                    id="area"
                    type="number"
                    min={0}
                    value={areaSqft}
                    onChange={(e) => setAreaSqft(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="budget">Budget ({company?.currency ?? "INR"})</Label>
                  <Input
                    id="budget"
                    type="number"
                    min={0}
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                  />
                </div>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <div className="flex gap-2">
                {(["existing", "new", "none"] as ClientMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setClientMode(mode)}
                    className={cn(
                      "flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                      clientMode === mode
                        ? "border-primary bg-primary text-primary-foreground"
                        : "hover:bg-muted"
                    )}
                  >
                    {mode === "existing"
                      ? "Existing client"
                      : mode === "new"
                        ? "New client"
                        : "No client yet"}
                  </button>
                ))}
              </div>

              {clientMode === "existing" && (
                <div className="space-y-1.5">
                  <Label>Client</Label>
                  <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a client" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.length === 0 ? (
                        <div className="px-2 py-1.5 text-sm text-muted-foreground">
                          No clients yet — try &ldquo;New client&rdquo; instead.
                        </div>
                      ) : (
                        clients.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {clientMode === "new" && (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="client-name">Client name</Label>
                    <Input
                      id="client-name"
                      value={newClient.name}
                      onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
                      autoFocus
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="client-email">Email</Label>
                      <Input
                        id="client-email"
                        type="email"
                        value={newClient.email}
                        onChange={(e) =>
                          setNewClient({ ...newClient, email: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="client-phone">Phone</Label>
                      <Input
                        id="client-phone"
                        value={newClient.phone}
                        onChange={(e) =>
                          setNewClient({ ...newClient, phone: e.target.value })
                        }
                      />
                    </div>
                  </div>
                </>
              )}

              {clientMode === "none" && (
                <p className="text-sm text-muted-foreground">
                  You can attach a client to this project later from the project page.
                </p>
              )}
            </>
          )}

          {step === 2 && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="style">Preferred style</Label>
                <Input
                  id="style"
                  list="style-suggestions"
                  placeholder="e.g. Modern Luxury"
                  value={style}
                  onChange={(e) => setStyle(e.target.value)}
                />
                <datalist id="style-suggestions">
                  {STYLE_SUGGESTIONS.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="notes">Notes / special requirements</Label>
                <Textarea
                  id="notes"
                  rows={4}
                  placeholder="Anything the design team should know — color preferences, must-haves, constraints…"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <p className="text-sm text-muted-foreground">
                Upload the architect's floor plan now, or skip and add it later from the
                project page. AI analysis of the plan isn't available yet — this just
                stores the file with the project.
              </p>
              <FloorPlanDropzone
                file={floorPlanFile}
                onSelect={setFloorPlanFile}
                onClear={() => setFloorPlanFile(null)}
              />
            </>
          )}

          {submitError && <p className="text-sm text-destructive">{submitError}</p>}
          {uploadWarning && <p className="text-sm text-amber-700">{uploadWarning}</p>}
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0 || isSubmitting}
        >
          Back
        </Button>

        {step < STEPS.length - 1 ? (
          <Button onClick={() => setStep((s) => s + 1)} disabled={!stepValid}>
            Next
          </Button>
        ) : (
          <Button onClick={handleCreate} disabled={isSubmitting}>
            {isSubmitting ? "Creating…" : "Create Project"}
          </Button>
        )}
      </div>
    </div>
  );
}

function Stepper({ current }: { current: number }) {
  return (
    <div className="flex items-center">
      {STEPS.map((label, i) => (
        <div key={label} className="flex items-center flex-1 last:flex-none">
          <div className="flex flex-col items-center gap-1.5">
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium",
                i < current
                  ? "bg-primary text-primary-foreground"
                  : i === current
                    ? "border-2 border-primary text-primary"
                    : "border text-muted-foreground"
              )}
            >
              {i < current ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            <span
              className={cn(
                "text-xs whitespace-nowrap",
                i === current ? "font-medium" : "text-muted-foreground"
              )}
            >
              {label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div
              className={cn("h-px flex-1 mx-2 mb-5", i < current ? "bg-primary" : "bg-border")}
            />
          )}
        </div>
      ))}
    </div>
  );
}
