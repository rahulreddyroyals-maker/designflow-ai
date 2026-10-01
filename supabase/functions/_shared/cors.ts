// Shared CORS headers for every Edge Function the frontend calls directly
// from the browser via `supabase.functions.invoke(...)`.
//
// Why this exists: a browser cross-origin request (Vercel's domain calling
// *.supabase.co) always sends a preflight OPTIONS request first. Supabase's
// Edge Function runtime does NOT add CORS headers for you — every function
// must handle OPTIONS itself and echo these headers back on every response,
// or the browser blocks the real request before it's ever sent. supabase-js
// reports that as a generic "Failed to send a request to the Edge Function"
// with no further detail, which is exactly what made this hard to tell apart
// from an auth/rate-limit regression.
//
// `presentation-share` already did this correctly (it's public-facing, so
// it was tested from a real browser early). `ai-orchestrator` was missing
// it entirely — every call to it from the deployed app was failing at the
// preflight stage, not inside the function itself.
export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
