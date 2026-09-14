# DesignFlow AI

**From Floor Plan to Finished Interior.**

AI-powered interior design operating system for professional designers and design companies.
Upload a floor plan → AI detects rooms/dimensions → designer verifies → AI suggests layouts and
design concepts → 3D visualization → client presentation and approval.

This repo is the MVP scaffold. See:

- **`CLAUDE.md`** — permanent project instructions for Claude Code. Read this first.
- **`docs/PRODUCT_SPEC.md`** — full MVP scope, screen list, and schema reference.

## Stack

React + TypeScript + Vite · Tailwind + shadcn/ui · Zustand · Supabase (Postgres/Auth/Storage/Edge
Functions) · Konva.js (2D) · React Three Fiber (3D) · AI provider abstraction (Claude/Gemini).

## Getting Started

For the full step-by-step (including local vs. cloud Supabase setup, what to verify at each
sprint, and production deploy), see **[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)**. Quickstart:

```bash
npm install
cp .env.example .env.local     # fill in Supabase project URL + anon key
npm run dev
```

### Supabase

```bash
npx supabase start                     # local stack (Postgres, Auth, Storage, Studio)
npx supabase migration up              # apply supabase/migrations/
npx supabase functions serve ai-orchestrator   # serve the AI Edge Function locally
```

The AI orchestrator runs in **dev fallback mode** (clearly-labeled empty responses) until
`GROQ_API_KEY` is set — see `supabase/functions/ai-orchestrator/providers/groq.ts`. Groq is the
active provider (chosen for cost pre-revenue); a Claude adapter also exists
(`providers/claude.ts`) for switching back later — see the comment at the top of `groq.ts`.
Note: Groq's vision API doesn't accept PDFs, only images — PDF floor plan *analysis* isn't
available with Groq (upload/preview still work fine).
Set secrets for a deployed function with:

```bash
npx supabase secrets set GROQ_API_KEY=gsk_...
```

## Project Structure

```
src/
  types/        Domain TypeScript types — one file per entity, mirrors the DB schema
  services/     All Supabase/API access. Components never call supabase.from() directly.
  store/        Zustand stores, one per domain slice
  components/   ui/ (shadcn primitives), then feature folders (canvas, floor-plan, ai, ...)
  pages/        Route-level screens
  routes/       React Router config
  lib/          Supabase client, cn() utility

supabase/
  migrations/   SQL schema + RLS, one file per change, never edited after shipping
  functions/    Edge Functions (ai-orchestrator, more later)

docs/           Product spec reference
.claude/commands/  Project-specific Claude Code slash commands
```

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Typecheck + production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run format` | Prettier |

## Status

This is a fresh scaffold: config, types, schema/RLS, routing, and one fully-implemented
service/store pair (`projectService` / `projectStore`) as a reference pattern. Most pages are
placeholders — see `docs/PRODUCT_SPEC.md` for what each should become, and `CLAUDE.md` for the
rules to follow while building them out.
