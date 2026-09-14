// Claude provider adapter for floor plan analysis. Isolated behind this
// file so the orchestrator (index.ts) doesn't know provider-specific
// request/response shapes — swap in a Gemini adapter later without
// touching orchestration logic (CLAUDE.md §5).

import {
  floorPlanAnalysisResultSchema,
  spacePlanningResponseSchema,
  type FloorPlanAnalysisResult,
  type SpacePlanningResponse,
} from "../schema.ts";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

// Check https://docs.claude.com/en/docs/about-claude/models for the current
// model catalog before deploying — model IDs change over time and this
// default may be stale. Override with the ANTHROPIC_MODEL env var without
// touching code.
const DEFAULT_MODEL = "claude-sonnet-4-5-20250929";

type SupportedMediaType = "application/pdf" | "image/jpeg" | "image/png";

export interface AnalyzeFloorPlanInput {
  base64Data: string;
  mediaType: SupportedMediaType;
  projectContext: {
    property_type: string;
    bhk: string | null;
    area_sqft: number | null;
  };
}

const SYSTEM_PROMPT = `You are a floor plan analysis assistant for professional interior designers.

Analyze the attached floor plan and respond with ONLY a single JSON object — no prose, no
markdown code fences, nothing before or after it — matching exactly this shape:

{
  "rooms": [{ "temp_id": string, "name": string, "room_type": string, "width_ft": number, "length_ft": number, "area_sqft": number, "polygon": [{"x": number, "y": number}, ...at least 3 points], "confidence": number between 0 and 1, "needs_verification": boolean }],
  "walls": [{ "temp_id": string, "points": [{"x": number, "y": number}, ...at least 2 points], "confidence": number between 0 and 1 }],
  "doors": [{ "temp_id": string, "points": [{"x": number, "y": number}, ...at least 2 points], "width_ft": number, "room_ids": [string, ...], "confidence": number between 0 and 1 }],
  "windows": [{ "temp_id": string, "points": [{"x": number, "y": number}, ...at least 2 points], "width_ft": number, "room_ids": [string, ...], "confidence": number between 0 and 1 }],
  "dimensions": [{ "label": string, "value_ft": number, "points": [{"x": number, "y": number}, ...at least 2 points] }],
  "confidence": number between 0 and 1 (overall),
  "warnings": [string, ...]
}

COORDINATE SYSTEM: every "x" and "y" is a PERCENTAGE from 0 to 100 of the image's width and
height respectively — NOT pixels. This lets your result be overlaid on the image at any
display size regardless of its native resolution.

Rules you must follow, without exception:
- Do not invent a dimension you cannot see or clearly infer from a visible scale bar or
  printed measurement. If a measurement is genuinely unclear, give your best visual estimate,
  lower that item's "confidence" accordingly, and add a note to "warnings" explaining the
  uncertainty — never present a guess as a precise, confident number.
- Set "needs_verification": true on any room whose boundaries or dimensions you are not
  highly confident about.
- Never claim structural safety, load-bearing status, or construction feasibility — you are
  only identifying the visible 2D layout.
- If the attached file is not a readable floor plan, return empty arrays for
  rooms/walls/doors/windows/dimensions, an overall "confidence" of 0, and explain why in
  "warnings".
- "room_type" must be one of exactly: living_room, dining_room, kitchen, master_bedroom,
  bedroom, study, bathroom, balcony, utility, foyer, other.
- temp_id values just need to be unique within your response (e.g. "room-1", "wall-3").`;

export async function analyzeFloorPlanWithClaude(
  input: AnalyzeFloorPlanInput
): Promise<FloorPlanAnalysisResult> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured for this Edge Function.");
  }

  const model = Deno.env.get("ANTHROPIC_MODEL") || DEFAULT_MODEL;

  const fileContentBlock =
    input.mediaType === "application/pdf"
      ? {
          type: "document",
          source: { type: "base64", media_type: input.mediaType, data: input.base64Data },
        }
      : {
          type: "image",
          source: { type: "base64", media_type: input.mediaType, data: input.base64Data },
        };

  const contextLine =
    `Project context: property type "${input.projectContext.property_type}", ` +
    `${input.projectContext.bhk ?? "BHK not specified"}, ` +
    `${
      input.projectContext.area_sqft
        ? `${input.projectContext.area_sqft} sq.ft total (use as a sanity check, not a hard constraint)`
        : "total area not specified"
    }.`;

  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            fileContentBlock,
            {
              type: "text",
              text: `${contextLine}\n\nAnalyze the attached floor plan and respond with the JSON object described in your instructions — nothing else.`,
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Claude API returned ${response.status}: ${errorBody}`);
  }

  const data = await response.json();
  return parseJsonResponse(data, floorPlanAnalysisResultSchema);
}

// ---------------------------------------------------------------------------
// AI Task #2 — Space Planning
// ---------------------------------------------------------------------------

export interface CatalogItemForPrompt {
  id: string;
  name: string;
  category: string;
  width_ft: number;
  depth_ft: number;
}

export interface GenerateSpaceLayoutsInput {
  roomWidthFt: number;
  roomLengthFt: number;
  requirements: string[];
  style: string;
  priority: "space" | "storage" | "balanced";
  /** The real, available furniture the AI may choose from — it must
   * select items by exact id from this list, never invent new ones. */
  catalog: CatalogItemForPrompt[];
}

const SPACE_PLANNING_SYSTEM_PROMPT = `You are a space planning assistant for professional interior designers.

You will be given a room's dimensions (in feet), a list of furniture the designer wants
included, a style, a priority, and a CATALOG of the only furniture items you are allowed to
use. Respond with ONLY a single JSON object — no prose, no markdown fences — matching exactly:

{
  "layouts": [
    {
      "name": string,
      "description": string,
      "items": [{ "furniture_item_id": string, "x": number, "y": number, "rotation": number }]
    }
  ]
}

Propose exactly 3 layout concepts named "Space Optimized", "Storage Optimized", and "Premium",
each a genuinely different arrangement (not minor variations of one idea).

COORDINATE SYSTEM: "x" and "y" are in FEET, relative to the room's top-left corner (0,0). The
room spans from (0,0) to (room width, room length) — every item must fit entirely within those
bounds given its catalog width/depth (accounting for "rotation": a 90/270 degree rotation swaps
which catalog dimension faces which axis). "rotation" is in degrees (0, 90, 180, or 270).

Rules you must follow, without exception:
- "furniture_item_id" MUST exactly match an "id" from the provided catalog. Never invent an id,
  a name, or dimensions — you are choosing placements for real items, not designing new ones.
- Do not place items that overlap each other or extend outside the room's bounds.
- If the room is too small to fit everything the designer asked for, include fewer items rather
  than overlapping or oversizing anything, and mention the tradeoff in that layout's
  "description".
- Prefer catalog items whose names relate to what the designer asked for in "requirements", but
  you may add a few sensible complementary items from the catalog if it improves the layout.`;

export async function generateSpaceLayoutsWithClaude(
  input: GenerateSpaceLayoutsInput
): Promise<SpacePlanningResponse> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured for this Edge Function.");
  }
  const model = Deno.env.get("ANTHROPIC_MODEL") || DEFAULT_MODEL;

  const catalogText = input.catalog
    .map(
      (c) =>
        `- id: "${c.id}", name: "${c.name}", category: ${c.category}, width_ft: ${c.width_ft.toFixed(1)}, depth_ft: ${c.depth_ft.toFixed(1)}`
    )
    .join("\n");

  const userText = `Room: ${input.roomWidthFt} ft wide × ${input.roomLengthFt} ft long.
Style: ${input.style || "unspecified — use your judgment"}.
Priority: ${input.priority}.
Requested furniture: ${input.requirements.length > 0 ? input.requirements.join(", ") : "unspecified — use your judgment"}.

Available catalog (choose only from these, by exact id):
${catalogText}

Generate the 3 layout concepts described in your instructions.`;

  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system: SPACE_PLANNING_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userText }],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Claude API returned ${response.status}: ${errorBody}`);
  }

  const data = await response.json();
  return parseJsonResponse(data, spacePlanningResponseSchema);
}

// ---------------------------------------------------------------------------
// Shared response parsing
// ---------------------------------------------------------------------------

function parseJsonResponse<T>(
  data: { content?: { type: string; text?: string }[] },
  schema: { safeParse: (value: unknown) => { success: boolean; data?: T; error?: { message: string } } }
): T {
  const textBlock = (data.content ?? []).find((block) => block.type === "text");
  if (!textBlock?.text) {
    throw new Error("Claude's response contained no text content to parse.");
  }

  // Strip accidental markdown fences even though the prompt asks for none —
  // models sometimes add them anyway.
  const cleaned = textBlock.text.trim().replace(/^```(?:json)?\s*|```$/g, "");

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error("Claude's response was not valid JSON.");
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`AI response failed schema validation: ${result.error?.message}`);
  }

  return result.data as T;
}
