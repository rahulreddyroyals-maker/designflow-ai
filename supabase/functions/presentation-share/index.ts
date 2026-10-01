// Supabase Edge Function: presentation-share
//
// Public, UNAUTHENTICATED entry point for the client-facing `/share/:token`
// route (src/pages/ShareView.tsx via src/services/shareService.ts). This is
// the ONE deliberate exception in this codebase to "always forward the
// caller's JWT, never use the service role key" (compare ai-orchestrator,
// which forwards the caller's Authorization header). A client viewing a
// share link has no Supabase session at all — there is no JWT to forward —
// so this function uses SUPABASE_SERVICE_ROLE_KEY (auto-injected by the
// Supabase runtime, never a caller-supplied secret) and enforces access
// control itself, in code, rather than via RLS.
//
// Deploy with: npx supabase functions deploy presentation-share
// No additional secrets required beyond the auto-injected SUPABASE_URL /
// SUPABASE_SERVICE_ROLE_KEY.
//
// SECURITY MODEL — four non-negotiable rules for anyone touching this file:
//
//   1. Every request validates `share_token` FIRST, before anything else,
//      via resolveSharedPresentation(). A presentation with status
//      "draft" is treated identically to a share_token that doesn't
//      exist at all — both resolve to `null` and both produce a plain
//      404-style error to the caller. Never let a caller distinguish
//      "wrong token" from "right token, but not shared yet".
//
//   2. Every WRITE (handleComment, handleApprove) re-verifies that the
//      presentation_item_id it was given actually belongs to the
//      presentation that share_token resolved to
//      (verifyItemBelongsToPresentation). The request body is untrusted
//      client input — a share_token only proves the caller may see ONE
//      presentation, never that any id they mention belongs to it.
//
//   3. This function never accepts a table name, column name, or SQL
//      fragment from the client. Every query below is hand-written
//      against a fixed table/column; the client only ever supplies data
//      values (share_token, presentation_item_id, comment text, etc).
//
//   4. Responses return only what a client should see: presentation +
//      room + concept + render + comments + approvals for THIS
//      presentation. Never the company/project's other data, never
//      other presentations, never internal ids beyond what the UI needs
//      to submit a comment/approval back.
//
// If you're tempted to relax RLS on client_presentations/presentation_items
// instead of going through this function — don't. See migration 0001's
// closing comment: those tables' RLS is is_company_member()-scoped and
// deliberately does NOT cover client access. This function is the access
// control for clients, in one auditable place, instead of scattered across
// policies that would have to account for "no auth.uid()".

import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { checkRateLimit } from "../_shared/rateLimit.ts";
import { logServerError } from "../_shared/errorLog.ts";
import { CORS_HEADERS } from "../_shared/cors.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const RENDERS_BUCKET = "renders";
const SIGNED_URL_TTL_SECONDS = 60 * 60;

// Sprint 10 — this endpoint is unauthenticated by design (see the header
// comment above), which makes it the one place in this app a stranger
// with just a share link could hammer with comment/approval spam. Rate
// limit by share_token, not by IP (Deno Deploy doesn't reliably expose a
// real client IP, and a token is the actual scarce resource here anyway).
const WRITE_ACTIONS_PER_MINUTE_LIMIT = 10;

type RequestAction = "get" | "comment" | "approve";

interface RequestBody {
  action: RequestAction;
  share_token?: string;
  presentation_item_id?: string;
  author_name?: string;
  content?: string;
  status?: string;
  notes?: string;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

interface ResolvedPresentation {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: string;
  updated_at: string;
  created_at: string;
}

/** THE access-control chokepoint (rule 1 above). Returns null for both a
 * nonexistent token and a real-but-not-yet-shared presentation — callers
 * must treat both identically. */
async function resolveSharedPresentation(
  shareToken: string
): Promise<ResolvedPresentation | null> {
  const { data, error } = await supabase
    .from("client_presentations")
    .select("id, project_id, title, description, status, updated_at, created_at")
    .eq("share_token", shareToken)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  if (data.status === "draft") return null;

  return data as ResolvedPresentation;
}

/** Rule 2 above — required before every write. */
async function verifyItemBelongsToPresentation(
  presentationItemId: string,
  presentationId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("presentation_items")
    .select("id")
    .eq("id", presentationItemId)
    .eq("presentation_id", presentationId)
    .maybeSingle();

  if (error) throw error;
  return !!data;
}

async function handleGet(shareToken: string): Promise<Response> {
  const presentation = await resolveSharedPresentation(shareToken);
  if (!presentation) return json({ error: "not_found" }, 404);

  const [{ data: project, error: projectError }, { data: items, error: itemsError }] =
    await Promise.all([
      supabase
        .from("projects")
        .select("name, company_id")
        .eq("id", presentation.project_id)
        .single(),
      supabase
        .from("presentation_items")
        .select("*")
        .eq("presentation_id", presentation.id)
        .order("order_index", { ascending: true }),
    ]);

  if (projectError) throw projectError;
  if (itemsError) throw itemsError;

  const { data: company, error: companyError } = await supabase
    .from("companies")
    .select("name")
    .eq("id", project.company_id)
    .single();
  if (companyError) throw companyError;

  const roomIds = [...new Set((items ?? []).map((i) => i.room_id))];
  const itemIds = (items ?? []).map((i) => i.id);
  const renderIds = [...new Set((items ?? []).map((i) => i.render_id).filter((v) => v))] as string[];

  const [
    { data: rooms, error: roomsError },
    { data: concepts, error: conceptsError },
    { data: renders, error: rendersError },
    { data: comments, error: commentsError },
    { data: approvals, error: approvalsError },
  ] = await Promise.all([
    roomIds.length
      ? supabase.from("rooms").select("*").in("id", roomIds)
      : Promise.resolve({ data: [], error: null }),
    roomIds.length
      ? supabase.from("design_concepts").select("*").in("room_id", roomIds)
      : Promise.resolve({ data: [], error: null }),
    renderIds.length
      ? supabase.from("renders").select("*").in("id", renderIds)
      : Promise.resolve({ data: [], error: null }),
    itemIds.length
      ? supabase
          .from("comments")
          .select("*")
          .in("presentation_item_id", itemIds)
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    itemIds.length
      ? supabase
          .from("approvals")
          .select("*")
          .in("presentation_item_id", itemIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (roomsError) throw roomsError;
  if (conceptsError) throw conceptsError;
  if (rendersError) throw rendersError;
  if (commentsError) throw commentsError;
  if (approvalsError) throw approvalsError;

  const roomsById = new Map((rooms ?? []).map((r) => [r.id, r]));
  const conceptsByRoomId = new Map((concepts ?? []).map((c) => [c.room_id, c]));
  const rendersById = new Map((renders ?? []).map((r) => [r.id, r]));

  // Sign every render image path up front — the `renders` bucket is
  // private (see 0009_renders_storage.sql), so a plain storage path is
  // useless to the client without one.
  const signedUrlByRenderId = new Map<string, string>();
  await Promise.all(
    [...rendersById.values()].map(async (render) => {
      if (!render.image_url) return;
      const { data: signed, error: signError } = await supabase.storage
        .from(RENDERS_BUCKET)
        .createSignedUrl(render.image_url, SIGNED_URL_TTL_SECONDS);
      if (signError) return; // a broken/missing image just renders blank client-side
      signedUrlByRenderId.set(render.id, signed.signedUrl);
    })
  );

  const commentsByItemId = new Map<string, unknown[]>();
  for (const c of comments ?? []) {
    const list = commentsByItemId.get(c.presentation_item_id) ?? [];
    list.push(c);
    commentsByItemId.set(c.presentation_item_id, list);
  }

  const approvalsByItemId = new Map<string, unknown[]>();
  for (const a of approvals ?? []) {
    const list = approvalsByItemId.get(a.presentation_item_id) ?? [];
    list.push(a);
    approvalsByItemId.set(a.presentation_item_id, list);
  }

  const responseItems = (items ?? []).map((item) => {
    const room = roomsById.get(item.room_id) ?? null;
    const concept = conceptsByRoomId.get(item.room_id) ?? null;
    const render = item.render_id ? rendersById.get(item.render_id) ?? null : null;

    return {
      id: item.id,
      order_index: item.order_index,
      description: item.description,
      room: room
        ? { id: room.id, name: room.name, room_type: room.room_type }
        : null,
      imageUrl: render ? signedUrlByRenderId.get(render.id) ?? null : null,
      concept: concept
        ? {
            id: concept.id,
            style: concept.style,
            design_brief: concept.design_brief,
            color_palette: concept.color_palette ?? [],
            consultation_result: concept.consultation_result ?? null,
          }
        : null,
      comments: (commentsByItemId.get(item.id) ?? []).map((c: any) => ({
        id: c.id,
        author_name: c.author_name,
        author_type: c.author_type,
        content: c.content,
        created_at: c.created_at,
      })),
      approval: (approvalsByItemId.get(item.id) ?? [])[0]
        ? {
            status: (approvalsByItemId.get(item.id) as any[])[0].status,
            approved_by: (approvalsByItemId.get(item.id) as any[])[0].approved_by,
            approved_at: (approvalsByItemId.get(item.id) as any[])[0].approved_at,
            notes: (approvalsByItemId.get(item.id) as any[])[0].notes,
          }
        : null,
    };
  });

  return json({
    presentation: {
      id: presentation.id,
      title: presentation.title,
      description: presentation.description,
      status: presentation.status,
      updated_at: presentation.updated_at,
    },
    projectName: project.name as string,
    companyName: company.name as string,
    items: responseItems,
  });
}

async function handleComment(body: RequestBody): Promise<Response> {
  const { share_token, presentation_item_id, author_name, content } = body;
  if (!share_token || !presentation_item_id || !author_name?.trim() || !content?.trim()) {
    return json({ error: "missing_fields" }, 400);
  }

  const rateLimit = await checkRateLimit("presentation_comment", share_token, WRITE_ACTIONS_PER_MINUTE_LIMIT, 60);
  if (!rateLimit.allowed) {
    return json({ error: "rate_limited" }, 429);
  }

  const presentation = await resolveSharedPresentation(share_token);
  if (!presentation) return json({ error: "not_found" }, 404);

  const belongs = await verifyItemBelongsToPresentation(presentation_item_id, presentation.id);
  if (!belongs) return json({ error: "not_found" }, 404);

  const { data, error } = await supabase
    .from("comments")
    .insert({
      presentation_item_id,
      author_name: author_name.trim().slice(0, 100),
      author_type: "client",
      content: content.trim().slice(0, 2000),
    })
    .select("id, author_name, author_type, content, created_at")
    .single();

  if (error) throw error;
  return json({ comment: data });
}

async function handleApprove(body: RequestBody): Promise<Response> {
  const { share_token, presentation_item_id, status, author_name, notes } = body;
  if (
    !share_token ||
    !presentation_item_id ||
    !author_name?.trim() ||
    (status !== "approved" && status !== "changes_requested")
  ) {
    return json({ error: "missing_or_invalid_fields" }, 400);
  }

  const rateLimit = await checkRateLimit("presentation_approve", share_token, WRITE_ACTIONS_PER_MINUTE_LIMIT, 60);
  if (!rateLimit.allowed) {
    return json({ error: "rate_limited" }, 429);
  }

  const presentation = await resolveSharedPresentation(share_token);
  if (!presentation) return json({ error: "not_found" }, 404);

  const belongs = await verifyItemBelongsToPresentation(presentation_item_id, presentation.id);
  if (!belongs) return json({ error: "not_found" }, 404);

  const { data, error } = await supabase
    .from("approvals")
    .insert({
      presentation_item_id,
      status,
      approved_by: author_name.trim().slice(0, 100),
      approved_at: status === "approved" ? new Date().toISOString() : null,
      notes: notes?.trim().slice(0, 2000) ?? null,
    })
    .select("id, status, approved_by, approved_at, notes, created_at")
    .single();

  if (error) throw error;
  return json({ approval: data });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return json({}, 200);

  try {
    const body = (await req.json()) as RequestBody;

    switch (body.action) {
      case "get":
        if (!body.share_token) return json({ error: "missing_share_token" }, 400);
        return await handleGet(body.share_token);
      case "comment":
        return await handleComment(body);
      case "approve":
        return await handleApprove(body);
      default:
        return json({ error: `Unknown action: ${body.action}` }, 400);
    }
  } catch (err) {
    console.error("presentation-share error:", err);
    await logServerError("presentation-share", err);
    return json({ error: "internal_error" }, 500);
  }
});
