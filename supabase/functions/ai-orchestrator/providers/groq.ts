// Groq provider adapter (Groq's chat completions API is OpenAI-compatible).
//
// Swapped in for Claude to control cost before there's paying revenue —
// see CLAUDE.md's AI Architecture section. This is exactly what the
// provider-abstraction pattern (CLAUDE.md §5) is for: orchestration logic
// in index.ts doesn't change, only which provider module it imports from.
//
// TO SWITCH BACK TO CLAUDE LATER: in index.ts, change the import from
// "./providers/groq.ts" to "./providers/claude.ts", swap
// analyzeFloorPlanWithGroq/generateSpaceLayoutsWithGroq for their Claude
// equivalents, and change the `provider` string constants in both
// handlers from "groq" back to "claude". Nothing else needs to change.
//
// KNOWN LIMITATION: unlike Anthropic's API, Groq's (OpenAI-compatible)
// chat completions endpoint accepts image inputs but NOT raw PDF
// documents. PDF floor plans will fail with a clear, caught error here
// until a PDF -> image conversion step is added — see
// analyzeFloorPlanWithGroq below. The frontend (FloorPlanAnalyzer) also
// warns about this upfront so it isn't a surprise.

import {
  floorPlanAnalysisResultSchema,
  spacePlanningResponseSchema,
  type FloorPlanAnalysisResult,
  type SpacePlanningResponse,
} from "../schema.ts";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

// Groq's hosted model catalog changes over time — check
// https://console.groq.com/docs/models before deploying. A vision-capable
// model is required for floor plan images; space planning is text-only
// and can use a cheaper/faster model. Both overridable via env vars.
const DEFAULT_VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";
const DEFAULT_TEXT_MODEL = "llama-3.3-70b-versatile";

type SupportedImageType = "image/jpeg" | "image/png";

export interface AnalyzeFloorPlanInput {
  base64Data: string;
  mediaType: "application/pdf" | SupportedImageType;
  projectContext: {
    property_type: string;
    bhk: string | null;
    area_sqft: number | null;
  };
}

// Identical guardrails to the Claude adapter's prompt — the rules
// (CLAUDE.md §4: no invented dimensions, no structural-safety claims,
// flag uncertainty instead of guessing) don't change with the provider.
const FLOOR_PLAN_SYSTEM_PROMPT = `You are a floor plan analysis assistant for professional interior designers.

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

export async function analyzeFloorPlanWithGroq(
  input: AnalyzeFloorPlanInput
): Promise<FloorPlanAnalysisResult> {
  if (input.mediaType === "application/pdf") {
    throw new Error(
      "PDF floor plans aren't supported with the current AI provider (Groq) — its vision API " +
        "only accepts images. Please re-upload the floor plan as a JPG or PNG."
    );
  }

  const apiKey = Deno.env.get("GROQ_API_KEY");
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not configured for this Edge Function.");
  }
  const model = Deno.env.get("GROQ_VISION_MODEL") || DEFAULT_VISION_MODEL;

  const contextLine =
    `Project context: property type "${input.projectContext.property_type}", ` +
    `${input.projectContext.bhk ?? "BHK not specified"}, ` +
    `${
      input.projectContext.area_sqft
        ? `${input.projectContext.area_sqft} sq.ft total (use as a sanity check, not a hard constraint)`
        : "total area not specified"
    }.`;

  const response = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: FLOOR_PLAN_SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `${contextLine}\n\nAnalyze the attached floor plan and respond with the JSON object described in your instructions — nothing else.`,
            },
            {
              type: "image_url",
              image_url: { url: `data:${input.mediaType};base64,${input.base64Data}` },
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Groq API returned ${response.status}: ${errorBody}`);
  }

  const data = await response.json();
  return parseOpenAIStyleJsonResponse(data, floorPlanAnalysisResultSchema);
}

// ---------------------------------------------------------------------------
// AI Task #2 — Space Planning (text-only, no vision needed)
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

export async function generateSpaceLayoutsWithGroq(
  input: GenerateSpaceLayoutsInput
): Promise<SpacePlanningResponse> {
  const apiKey = Deno.env.get("GROQ_API_KEY");
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not configured for this Edge Function.");
  }
  const model = Deno.env.get("GROQ_TEXT_MODEL") || DEFAULT_TEXT_MODEL;

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

  const response = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SPACE_PLANNING_SYSTEM_PROMPT },
        { role: "user", content: userText },
      ],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Groq API returned ${response.status}: ${errorBody}`);
  }

  const data = await response.json();
  return parseOpenAIStyleJsonResponse(data, spacePlanningResponseSchema);
}

// ---------------------------------------------------------------------------
// Shared response parsing (OpenAI-compatible shape: choices[0].message.content)
// ---------------------------------------------------------------------------

function parseOpenAIStyleJsonResponse<T>(
  data: { choices?: { message?: { content?: string } }[] },
  schema: { safeParse: (value: unknown) => { success: boolean; data?: T; error?: { message: string } } }
): T {
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Groq's response contained no content to parse.");
  }

  // Strip accidental markdown fences even with response_format: json_object
  // requested — defense in depth, some models add them anyway.
  const cleaned = content.trim().replace(/^```(?:json)?\s*|```$/g, "");

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error("Groq's response was not valid JSON.");
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`AI response failed schema validation: ${result.error?.message}`);
  }

  return result.data as T;
}
