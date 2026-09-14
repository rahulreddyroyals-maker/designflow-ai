import { useState } from "react";
import { Check, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ALLOWED_MIME_TYPES = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];

interface FloorPlanDropzoneProps {
  file: File | null;
  onSelect: (file: File) => void;
  onClear: () => void;
  error?: string | null;
  helperText?: string;
  inputId?: string;
}

/** Drag-and-drop / click-to-browse picker for a single floor plan file.
 * Shared between the New Project wizard and the Floor Plan Analyzer page —
 * both need identical validation and the same look. Does not upload
 * anything itself; the caller decides when/how to persist the file. */
export function FloorPlanDropzone({
  file,
  onSelect,
  onClear,
  error,
  helperText = "PDF, JPG, or PNG",
  inputId = "floor-plan-input",
}: FloorPlanDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);

  function handleFile(candidate: File | null) {
    if (!candidate) return;
    if (!ALLOWED_MIME_TYPES.includes(candidate.type)) return;
    onSelect(candidate);
  }

  return (
    <div className="space-y-2">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          handleFile(e.dataTransfer.files[0] ?? null);
        }}
        className={cn(
          "rounded-lg border-2 border-dashed p-10 text-center transition-colors",
          isDragging ? "border-primary bg-muted/50" : "border-input"
        )}
      >
        {file ? (
          <div className="flex items-center justify-center gap-3">
            <Check className="h-5 w-5 text-emerald-600" />
            <span className="text-sm font-medium">{file.name}</span>
            <button
              type="button"
              onClick={onClear}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <>
            <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm font-medium mb-1">
              Drop your floor plan here, or click to browse
            </p>
            <p className="text-xs text-muted-foreground mb-4">{helperText}</p>
            <input
              id={inputId}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            />
            <Button asChild variant="outline" size="sm">
              <label htmlFor={inputId} className="cursor-pointer">
                Choose file
              </label>
            </Button>
          </>
        )}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
