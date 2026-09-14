// Supabase Edge Function: ai-orchestrator
//
// Single entry point for every AI task in DesignFlow AI (CLAUDE.md §5).
// The frontend never talks to Claude/Gemini directly — it calls this
// function via `supabase.functions.invoke("ai-orchestrator", ...)`
// (see src/services/aiService.ts).
//
// This function forwards the caller's own Authorization header into a
// Supabase client rather than using a service-role key, so every table/
// storage read or write it performs is still subject to the same RLS
// policies as if the designer made the call directly — least privilege,
// no admin escalation (CLAUDE.md §3.2).
//
// Deploy with: npx supabase functions deploy ai-orchestrator
// Required secrets: GROQ_API_KEY (npx supabase secrets set ...)
//
// Provider note: currently using Groq (see providers/groq.ts) to control
// cost pre-revenue. Swapping back to Claude later is a one-line import
// change plus updating the `provider` string constants below — see the
// comment at the top of providers/groq.ts for exactly what to change.
// SUPABASE_URL / SUPABASE_ANON_KEY are auto-injected by the runtime.

import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { encodeBase64 } from "https://deno.land/std@0.192.0/encoding/base64.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { analyzeFloorPlanWithGroq, generateSpaceLayoutsWithGroq } from "./providers/groq.ts";

type AITaskType =
  | "floor_plan_analysis"
  | "space_planning"
  | "design_consultant"
  | "budget_optimizer";

interface OrchestratorRequest {
  task: AITaskType;
  payload: Record<string, unknown>;
}

const SUPPORTED_TASKS: AITaskType[] = [
  "floor_plan_analysis",
  "space_planning",
  "design_consultant",
  "budget_optimizer",
];

serve(async (req) => {
  try {
    const { task, payload } = (await req.json()) as OrchestratorRequest;

    if (!SUPPORTED_TASKS.includes(task)) {
      return jsonResponse({ error: `Unknown task: ${task}` }, 400);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Missing Authorization header." }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    if (task === "floor_plan_analysis") {
      return await handleFloorPlanAnalysis(supabase, payload);
    }
    if (task === "space_planning") {
      return await handleSpacePlanning(supabase, payload);
    }

    // The remaining two AI tasks (design consultant, budget optimizer)
    // aren't implemented yet — see their types in src/types/ai.ts for the
    // intended contract. Rather than fabricate plausible-looking output,
    // return an explicitly-labeled dev fallback until a real provider
    // adapter exists for them (CLAUDE.md §7).
    return jsonResponse({
      generation_id: crypto.randomUUID(),
      provider: Deno.env.get("DEFAULT_AI_PROVIDER") ?? "groq",
      status: "completed",
      output: devFallbackFor(task),
      error: null,
      is_dev_fallback: true,
    });
  } catch (err) {
    return jsonResponse(
      { error: err instanceof Error ? err.message : "Unknown error" },
      500
    );
  }
});

async function handleFloorPlanAnalysis(
  supabase: SupabaseClient,
  payload: Record<string, unknown>
) {
  const floorPlanId = payload.floor_plan_id as string | undefined;
  const storagePath = payload.storage_path as string | undefined;
  const fileType = payload.file_type as string | undefined;
  const projectContext = (payload.project_context as
    | { property_type: string; bhk: string | null; area_sqft: number | null }
    | undefined) ?? { property_type: "apartment", bhk: null, area_sqft: null };

  if (!floorPlanId || !storagePath || !fileType) {
    return jsonResponse(
      { error: "Missing floor_plan_id, storage_path, or file_type." },
      400
    );
  }

  // RLS on `floor_plans` (via the project's company) already scopes this to
  // callers who actually have access — if the row comes back null, either
  // it doesn't exist or this caller isn't a member of its company.
  const { data: floorPlanRow, error: fpError } = await supabase
    .from("floor_plans")
    .select("project_id")
    .eq("id", floorPlanId)
    .maybeSingle();

  if (fpError || !floorPlanRow) {
    return jsonResponse({ error: "Floor plan not found or not accessible." }, 404);
  }
  const projectId = floorPlanRow.project_id as string;
  const provider = "groq";

  // Log the attempt before doing any work, so a crash mid-analysis still
  // leaves an audit trail (CLAUDE.md §3.12) rather than silently vanishing.
  const { data: generation, error: genError } = await supabase
    .from("ai_generations")
    .insert({
      project_id: projectId,
      task_type: "floor_plan_analysis",
      provider,
      input: payload,
      status: "processing",
    })
    .select("*")
    .single();

  if (genError || !generation) {
    return jsonResponse(
      { error: `Failed to log AI generation: ${genError?.message}` },
      500
    );
  }

  await supabase
    .from("floor_plans")
    .update({ analysis_status: "processing" })
    .eq("id", floorPlanId);

  try {
    const hasProviderKey = Boolean(Deno.env.get("GROQ_API_KEY"));
    let result;
    let isDevFallback = false;

    if (!hasProviderKey) {
      result = devFallbackFor("floor_plan_analysis");
      isDevFallback = true;
    } else {
      const { data: fileBlob, error: downloadError } = await supabase.storage
        .from("floor-plans")
        .download(storagePath);

      if (downloadError || !fileBlob) {
        throw new Error(`Failed to download floor plan: ${downloadError?.message}`);
      }

      const arrayBuffer = await fileBlob.arrayBuffer();
      const base64Data = encodeBase64(new Uint8Array(arrayBuffer));
      const mediaType =
        fileType === "pdf"
          ? "application/pdf"
          : fileType === "png"
            ? "image/png"
            : "image/jpeg";

      result = await analyzeFloorPlanWithGroq({
        base64Data,
        mediaType,
        projectContext,
      });
    }

    // Persist the raw (still-unverified) result. A designer accepting a
    // detected room/wall/door/window — not this write — is what creates a
    // real `rooms` / `floor_plan_elements` row (see roomService.ts,
    // floorPlanElementService.ts). "needs_review" reflects that: this
    // status means "AI has an opinion," not "this is confirmed."
    await supabase
      .from("floor_plans")
      .update({ analysis_status: "needs_review", analysis_result: result })
      .eq("id", floorPlanId);

    await supabase
      .from("ai_generations")
      .update({ status: "completed", output: result })
      .eq("id", generation.id);

    return jsonResponse({
      generation_id: generation.id,
      provider,
      status: "completed",
      output: result,
      error: null,
      is_dev_fallback: isDevFallback,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Floor plan analysis failed.";

    await supabase
      .from("floor_plans")
      .update({ analysis_status: "failed" })
      .eq("id", floorPlanId);

    await supabase
      .from("ai_generations")
      .update({ status: "failed", error: message })
      .eq("id", generation.id);

    return jsonResponse({
      generation_id: generation.id,
      provider,
      status: "failed",
      output: null,
      error: message,
      is_dev_fallback: false,
    });
  }
}

async function handleSpacePlanning(
  supabase: SupabaseClient,
  payload: Record<string, unknown>
) {
  const roomId = payload.room_id as string | undefined;
  const roomGeometry = payload.room_geometry as { width: number; length: number } | undefined;
  const requirements = (payload.furniture_requirements as string[] | undefined) ?? [];
  const style = (payload.style as string | undefined) ?? "";
  const priority = (payload.priority as "space" | "storage" | "balanced" | undefined) ?? "balanced";

  if (!roomId || !roomGeometry) {
    return jsonResponse({ error: "Missing room_id or room_geometry." }, 400);
  }

  // RLS scopes this to callers who actually have access to the room's
  // project — same pattern as handleFloorPlanAnalysis.
  const { data: roomRow, error: roomError } = await supabase
    .from("rooms")
    .select("project_id")
    .eq("id", roomId)
    .maybeSingle();

  if (roomError || !roomRow) {
    return jsonResponse({ error: "Room not found or not accessible." }, 404);
  }
  const projectId = roomRow.project_id as string;
  const provider = "groq";

  const { data: generation, error: genError } = await supabase
    .from("ai_generations")
    .insert({
      project_id: projectId,
      task_type: "space_planning",
      provider,
      input: payload,
      status: "processing",
    })
    .select("*")
    .single();

  if (genError || !generation) {
    return jsonResponse(
      { error: `Failed to log AI generation: ${genError?.message}` },
      500
    );
  }

  try {
    const hasProviderKey = Boolean(Deno.env.get("GROQ_API_KEY"));
    let result;
    let isDevFallback = false;

    if (!hasProviderKey) {
      result = { layouts: [] };
      isDevFallback = true;
    } else {
      const { data: catalogRows, error: catalogError } = await supabase
        .from("furniture_items")
        .select("id, name, category, width, depth");
      if (catalogError) throw new Error(`Failed to load furniture catalog: ${catalogError.message}`);

      const catalog = (catalogRows ?? []).map((row: { id: string; name: string; category: string; width: number; depth: number }) => ({
        id: row.id,
        name: row.name,
        category: row.category,
        width_ft: row.width / 30.48,
        depth_ft: row.depth / 30.48,
      }));

      const aiResult = await generateSpaceLayoutsWithGroq({
        roomWidthFt: roomGeometry.width,
        roomLengthFt: roomGeometry.length,
        requirements,
        style,
        priority,
        catalog,
      });

      // Defense in depth beyond schema validation: drop any placement
      // referencing a furniture_item_id that isn't a real catalog row,
      // rather than trusting the model's string matched what we sent it.
      const validIds = new Set(catalog.map((c) => c.id));
      result = {
        layouts: aiResult.layouts.map((layout) => ({
          ...layout,
          items: layout.items.filter((item) => validIds.has(item.furniture_item_id)),
        })),
      };
    }

    await supabase
      .from("ai_generations")
      .update({ status: "completed", output: result })
      .eq("id", generation.id);

    return jsonResponse({
      generation_id: generation.id,
      provider,
      status: "completed",
      output: result,
      error: null,
      is_dev_fallback: isDevFallback,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Space planning failed.";

    await supabase
      .from("ai_generations")
      .update({ status: "failed", error: message })
      .eq("id", generation.id);

    return jsonResponse({
      generation_id: generation.id,
      provider,
      status: "failed",
      output: null,
      error: message,
      is_dev_fallback: false,
    });
  }
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Minimal, clearly-fake, schema-valid stand-ins for local development
 * only — never used when a real provider key is configured. Confidence 0
 * and an explicit warning make it unmistakable this isn't a real result. */
function devFallbackFor(task: AITaskType) {
  switch (task) {
    case "floor_plan_analysis":
      return {
        rooms: [],
        walls: [],
        doors: [],
        windows: [],
        dimensions: [],
        confidence: 0,
        warnings: ["DEV FALLBACK: no AI provider configured (set GROQ_API_KEY)."],
      };
    case "space_planning":
      return { layouts: [] };
    case "design_consultant":
      return {
        design_direction: "DEV FALLBACK: no AI provider configured.",
        color_palette: [],
        materials: [],
        lighting: [],
        furniture_recommendations: [],
        potential_issues: [],
      };
    case "budget_optimizer":
      return {
        target_reduction: 0,
        achieved_estimate: 0,
        suggestions: [],
        disclaimer: "DEV FALLBACK: no AI provider configured.",
      };
  }
}
