# Run & Deploy Guide

This walks through getting DesignFlow AI running, sprint by sprint. Migrations are cumulative —
you apply them all in one `db push`/`migration up`, not one-per-sprint — but this guide checkpoints
what becomes testable at each stage so you can verify as you go instead of debugging everything
at once at the end.

---

## 0. Fix the error you just hit

Your error is a **version mismatch**, not a config problem:

```
PS D:\designflow-ai> supabase init          ← used your GLOBAL CLI (v2.90.0, per the update notice)
PS D:\designflow-ai> npx supabase start     ← used the version pinned in package.json (was ^1.203.0)
```

`supabase init` (global v2.x) wrote a `config.toml` using the v2 schema. `npx supabase start` then
resolved to the old v1.x CLI from `package.json`, which doesn't recognize v2 config fields — hence
every `Unknown config field` warning, ending in the `db.major_version: 17` failure (v1 doesn't
expect that key at all).

**Fix (already applied in this codebase):** `package.json`'s `supabase` devDependency is now
`^2.0.0`. On your machine:

```powershell
cd D:\designflow-ai
npm install
del supabase\config.toml        # delete the mismatched v2-schema file
npx supabase init                # regenerate it with the SAME (now v2) CLI you'll use throughout
```

From here on, **always use `npx supabase ...`**, never a bare `supabase ...` — that's what keeps
`init` and every later command on the same version. If you don't want the global CLI at all,
`npm uninstall -g supabase` removes the ambiguity entirely.

---

## 1. Prerequisites

- **Node.js 20+** and npm
- **Docker Desktop** — only if you want the full local Supabase stack (Track A below). Not needed
  for Track B.
- A **Supabase account** (free tier is fine) — [supabase.com](https://supabase.com)
- A **Groq API key** — [console.groq.com](https://console.groq.com) (needed from Sprint 4 onward;
  everything before that works without it)

### Choose a track

| | Track A — Local stack | Track B — Cloud project only |
|---|---|---|
| Requires Docker | Yes | No |
| Requires | `supabase start` running | A free Supabase project |
| Best for | Full offline dev, resetting DB freely | Fastest to get going, matches production |

Given the friction you just hit, **Track B is the more forgiving path on Windows** — skip Docker
entirely and develop directly against a real (free-tier) Supabase project. Both tracks are covered
below; pick one.

---

## 2. One-time project setup

```powershell
cd D:\designflow-ai
npm install
copy .env.example .env.local
```

### Track A — local stack

```powershell
npx supabase init      # if you haven't already (see §0)
npx supabase start
```

This prints a local API URL, anon key, and service role key — Docker must be running first. Put
the `API URL` and `anon key` into `.env.local`:

```
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<anon key from supabase start output>
```

### Track B — cloud project

1. Create a project at [supabase.com/dashboard](https://supabase.com/dashboard).
2. In the dashboard: **Project Settings → API** — copy the **Project URL** and **anon public**
   key into `.env.local`:
   ```
   VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=<anon key>
   ```
3. Link the CLI to this project so `db push` and `functions deploy` target it:
   ```powershell
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   ```

### Apply every migration (both tracks, from Sprint 1 through the Groq switch)

```powershell
npx supabase db push
```

(Track A alternative: `npx supabase migration up` applies the same files to the local stack.)

This runs `0001_init.sql` through `0007_allow_groq_provider.sql` in order — schema, RLS, auth
triggers, storage security, furniture catalog seed, scene support, and the Groq provider
constraint, all at once. You do not need to run them one at a time.

### Disable email confirmation (so Sprint 1's registration flow works immediately)

Dashboard (or local Studio at `http://127.0.0.1:54323` for Track A): **Authentication → Providers
→ Email → uncheck "Confirm email"**. Without this, `Register` shows a "check your email" state
instead of taking you straight to the dashboard — not broken, just a config choice you can flip
back on later.

### Start the frontend

```powershell
npm run dev
```

Open the printed localhost URL.

---

## Sprint 1 — Foundation

**Nothing extra needed beyond §2.** Verify:

1. Visit `/register`, create an account + company name → should land on `/dashboard`.
2. Sidebar, topbar (your company name + email), sign out all work.
3. Dashboard shows an empty state (0 projects).

If registration doesn't land on the dashboard, check the email-confirmation setting above.

---

## Sprint 2 — Projects & Clients

**No new migration or secrets.** Verify:

1. `/clients` → create a client.
2. `/projects/new` → walk the 4-step wizard, create a project (with or without a floor plan file
   in step 4 — step 4's upload is real storage, not a placeholder).
3. `/projects` → search/filter by status, delete a project.
4. Open a project → edit fields, change status, delete.

---

## Sprint 3 — Floor Plan Upload

**No new secrets**, but this sprint's migrations (`0003`, `0004`) already applied via `db push`
create the private `floor-plans` storage bucket and its RLS policies. Verify:

1. Open a project → **Floor Plan Analyzer** tab.
2. Upload a JPG/PNG/PDF → preview renders (image inline, PDF via browser viewer).
3. Delete it, upload again, check "previous uploads" history.

If upload fails with a storage/RLS error, confirm migration `0003` actually applied — check
**Storage → Buckets** in the dashboard for a `floor-plans` bucket marked **private**.

---

## Sprint 4 — AI Floor Plan Analyzer

**This is the first sprint that needs a real secret and an Edge Function deploy.**

```powershell
npx supabase secrets set GROQ_API_KEY=gsk_your_key_here
npx supabase functions deploy ai-orchestrator
```

(Track A: instead of deploying, you can run it locally: `npx supabase functions serve
ai-orchestrator --env-file supabase/functions/.env`, with `GROQ_API_KEY=...` in that `.env` file.
Local serving doesn't need `secrets set`.)

Verify:

1. Upload a **JPG or PNG** floor plan (not PDF — see the note below).
2. Click **Analyze with AI** → should show detected rooms/walls/doors/windows overlaid on the
   image, with confidence scores.
3. Edit a detected room's name/type/dimensions, click **Accept** → it becomes a real room.
4. Click **Accept structure** to save the detected walls/doors/windows.

**If you don't set `GROQ_API_KEY`:** analysis still runs end-to-end but returns zero detections,
clearly labeled "DEV FALLBACK" in the UI — this confirms the pipeline works without spending API
credits, but isn't a real analysis.

**PDF limitation:** Groq's vision API doesn't accept PDFs (see the provider swap note below) — the
Analyze button is disabled for PDF uploads with an explanation. Use JPG/PNG for AI analysis.

---

## Sprint 5 — 2D Designer

**No new secrets.** Migrations `0005` (scene coordinate system) and `0006` (furniture catalog
seed — 28 starter items) already applied. Verify:

1. Open a project → **Design Workspace**.
2. Any AI-verified rooms from Sprint 4 should already be on the canvas.
3. Furniture palette (left) has items grouped by category — drag one onto the canvas, or click its
   **+**.
4. Try each toolbar tool: wall (click-click, chains continue until Escape), door, window, room
   (click-drag), measure (click-click for a distance readout).
5. Select an object → resize/rotate via the on-canvas handles, or type exact values in the right
   panel. Delete key removes the selection. Undo/redo work.
6. Click **Save** → reload the page → the design persists.

If the catalog panel is empty, migration `0006` didn't apply — re-run `npx supabase db push`.

---

## Sprint 6 — Furniture + AI Space Planning

**Same secret as Sprint 4 (`GROQ_API_KEY`), but you must redeploy the function** — this sprint's
code lives in the same `ai-orchestrator` function, so a new deploy is required for the
`space_planning` task to exist server-side:

```powershell
npx supabase functions deploy ai-orchestrator
```

Verify:

1. In the Design Workspace, select a **saved** room (not a freshly-drawn one still pending Save —
   the button explains this if disabled).
2. Click **AI Generate Layout** → pick a few furniture chips, a style, a priority → **Generate 3
   Layouts**.
3. Each of the 3 concepts shows a small preview. Click **Apply** on one → its furniture appears on
   the canvas as normal, editable objects.
4. Confirm **Apply never touched anything already on the canvas** — and that Undo removes exactly
   the applied layout in one step.

---

## Provider swap (Groq, already applied)

Covered by Sprint 4/6's `GROQ_API_KEY` secret and migration `0007` (already included in `db
push`). Nothing additional to run. If you ever switch back to Claude: set `ANTHROPIC_API_KEY`
instead, edit the two import lines in
`supabase/functions/ai-orchestrator/index.ts` per the comment at the top of `providers/groq.ts`,
and redeploy.

---

## 3. Production deployment

### Database + Edge Function (Supabase)

If you developed on Track B, your cloud project already has everything — skip to secrets/deploy
below. If you developed on Track A (local only), create a cloud project now and run:

```powershell
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push
npx supabase secrets set GROQ_API_KEY=gsk_your_key_here
npx supabase functions deploy ai-orchestrator
```

Also disable email confirmation on the cloud project (§2) unless you want real email verification
in production, in which case configure a custom SMTP provider under **Authentication → Email
Templates / SMTP Settings** — Supabase's default email sending is rate-limited and not meant for
production traffic.

### Frontend (Vercel)

```powershell
npm run build   # sanity-check the production build locally first
```

Then in Vercel: **New Project → import this repo**. Framework preset: **Vite**. Set environment
variables:

```
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
```

Deploy. Vercel auto-detects `npm run build` / `dist` for a Vite project.

### Storage bucket check

Confirm in the dashboard (**Storage**) that `floor-plans` shows as **private**. Migration `0003`
sets this, but it's worth a visual check before going live — a public floor-plans bucket would
leak client data.

---

## 4. Troubleshooting

| Symptom | Likely cause |
|---|---|
| `Unknown config field` warnings | CLI version mismatch — see §0 |
| Registration doesn't reach `/dashboard` | Email confirmation still enabled — see §2 |
| Floor plan upload fails | Migration `0003` not applied, or bucket policy missing |
| Furniture palette empty | Migration `0006` not applied |
| "AI Generate Layout" button disabled | Room hasn't been saved yet — click Save first |
| Analyze button disabled | File is a PDF — Groq only supports images (JPG/PNG) for now |
| Analysis runs but finds nothing, says "DEV FALLBACK" | `GROQ_API_KEY` isn't set as a secret |
| Space planning works but analysis doesn't (or vice versa) | You deployed the function before adding that sprint's code — redeploy `ai-orchestrator` |
