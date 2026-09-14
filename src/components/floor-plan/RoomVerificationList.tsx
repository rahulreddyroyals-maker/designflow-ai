import { useState } from "react";
import { Check } from "lucide-react";
import * as roomService from "@/services/roomService";
import { ROOM_TYPE_LABELS, type DetectedRoom, type RoomType, type UUID } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface RoomVerificationListProps {
  projectId: UUID;
  rooms: DetectedRoom[];
  onAccepted?: () => void;
}

interface EditState {
  name: string;
  room_type: RoomType;
  width: number;
  length: number;
}

function normalizeRoomType(value: string): RoomType {
  return value in ROOM_TYPE_LABELS ? (value as RoomType) : "other";
}

/**
 * Lets the designer review each AI-detected room, correct anything before
 * committing to it, and explicitly accept it into the real `rooms` table.
 * Nothing here is persisted until "Accept" is clicked — this is the human
 * verification step CLAUDE.md §4 requires before a detection becomes data
 * the rest of the app treats as real.
 */
export function RoomVerificationList({
  projectId,
  rooms,
  onAccepted,
}: RoomVerificationListProps) {
  const [accepted, setAccepted] = useState<Set<string>>(new Set());
  const [edits, setEdits] = useState<Record<string, EditState>>(() =>
    Object.fromEntries(
      rooms.map((r) => [
        r.temp_id,
        {
          name: r.name,
          room_type: normalizeRoomType(r.room_type),
          width: r.width_ft,
          length: r.length_ft,
        },
      ])
    )
  );
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function updateEdit(tempId: string, patch: Partial<EditState>) {
    setEdits((prev) => ({ ...prev, [tempId]: { ...prev[tempId], ...patch } }));
  }

  async function handleAccept(room: DetectedRoom) {
    setSavingId(room.temp_id);
    setError(null);
    try {
      const edit = edits[room.temp_id];
      await roomService.createRoom(projectId, {
        name: edit.name,
        room_type: edit.room_type,
        width: edit.width,
        length: edit.length,
        confidence_score: room.confidence,
        verified: true,
      });
      setAccepted((prev) => new Set(prev).add(room.temp_id));
      onAccepted?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save room.");
    } finally {
      setSavingId(null);
    }
  }

  if (rooms.length === 0) {
    return <p className="text-sm text-muted-foreground">No rooms were detected.</p>;
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-destructive">{error}</p>}

      {rooms.map((room) => {
        const edit = edits[room.temp_id];
        const isAccepted = accepted.has(room.temp_id);
        const isSaving = savingId === room.temp_id;
        const confidencePct = Math.round(room.confidence * 100);

        return (
          <Card key={room.temp_id}>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Input
                    className="h-8 max-w-[180px]"
                    value={edit.name}
                    disabled={isAccepted}
                    onChange={(e) => updateEdit(room.temp_id, { name: e.target.value })}
                  />
                  <Badge variant={room.needs_verification ? "warning" : "success"}>
                    {confidencePct}% confidence
                  </Badge>
                </div>

                {isAccepted ? (
                  <Badge variant="success">
                    <Check className="h-3 w-3 mr-1 inline" />
                    Accepted
                  </Badge>
                ) : (
                  <Button size="sm" onClick={() => handleAccept(room)} disabled={isSaving}>
                    {isSaving ? "Saving…" : "Accept"}
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <Select
                  value={edit.room_type}
                  onValueChange={(v) => updateEdit(room.temp_id, { room_type: v as RoomType })}
                  disabled={isAccepted}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(ROOM_TYPE_LABELS) as RoomType[]).map((rt) => (
                      <SelectItem key={rt} value={rt}>
                        {ROOM_TYPE_LABELS[rt]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  className="h-8"
                  aria-label="Width (ft)"
                  value={edit.width}
                  disabled={isAccepted}
                  onChange={(e) =>
                    updateEdit(room.temp_id, { width: Number(e.target.value) })
                  }
                />
                <Input
                  type="number"
                  className="h-8"
                  aria-label="Length (ft)"
                  value={edit.length}
                  disabled={isAccepted}
                  onChange={(e) =>
                    updateEdit(room.temp_id, { length: Number(e.target.value) })
                  }
                />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
