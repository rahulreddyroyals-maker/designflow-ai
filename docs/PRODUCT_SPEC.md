# DesignFlow AI — Product Spec Reference

> Source of truth for MVP scope, screen list, and database schema. Kept here so Claude Code and
> contributors can reference it without re-explaining context. If this file and the code disagree,
> raise it — don't silently pick one.

## Vision

An interior designer receives an apartment floor plan and needs to convert it into a professional
interior design proposal quickly.

**Old workflow:** Architect's PDF/DWG → study plan → measure rooms → AutoCAD → furniture placement
→ SketchUp → 3D modelling → rendering → Photoshop/PDF → client presentation → changes → repeat.

**DesignFlow workflow:** Upload floor plan → AI understands plan → designer verifies rooms/dimensions
→ AI suggests layouts → designer edits 2D layout → AI creates design concept → 3D visualization →
client presentation.

## MVP Modules

- **Auth** — login, register, forgot password, Google login, company profile
- **Dashboard** — projects, recent projects, status, quick actions, usage stats
- **Project Management** — create project, client info, property info, budget, status, team
- **Floor Plan Analyzer** — PDF/JPG/PNG upload, preview, AI room detection, dimension extraction,
  doors/windows detection, confidence scores, manual correction
- **2D Interior Planner** — canvas, walls, doors, windows, furniture, dimensions, rotation,
  move/resize, snap-to-grid, measurement tool, layers, undo/redo
- **AI Space Planner** — generates Space Optimized / Storage Optimized / Premium / Family Oriented
  layout concepts
- **AI Design Concepts** — living, dining, kitchen, master bedroom, bedroom, study
- **Material Board** — flooring, wall paint, laminates, wood, fabric, glass, metal, lighting
- **Client Presentation** — design views, materials, room descriptions, budget, approval
- **Export** — PDF presentation, 2D layout image, project summary

## Deliberately Out of MVP

Full DWG editing, advanced architectural CAD, construction-grade structural drawings, full BIM,
automatic manufacturing drawings, advanced photorealistic ray tracing, AR, VR, vendor marketplace,
mobile designer app.

## Frontend Routes

```
/
/login
/register
/dashboard
/projects
/projects/new
/projects/:id
/projects/:id/analyze
/projects/:id/design
/projects/:id/rooms/:roomId
/projects/:id/materials
/projects/:id/concepts
/projects/:id/presentation
/clients
/settings
/share/:token        (later — client presentation access)
```

## Zustand Stores

`authStore`, `projectStore`, `floorPlanStore`, `designStore`, `canvasStore`, `materialStore`,
`presentationStore` — each owns its own slice, no single giant store.

## Database Tables (Supabase / Postgres)

`profiles`, `companies`, `company_members`, `clients`, `projects`, `rooms`, `floor_plans`,
`floor_plan_elements`, `furniture_items`, `project_furniture`, `design_concepts`, `materials`,
`project_materials`, `renders`, `client_presentations`, `presentation_items`, `comments`,
`approvals`, `ai_generations`, `subscriptions`.

Hierarchy:

```
company
  ├── members
  ├── clients
  └── projects
        ├── floor_plans
        ├── rooms
        │     └── furniture (project_furniture)
        ├── design_concepts
        ├── materials (project_materials)
        ├── renders
        └── client_presentations
              ├── comments
              └── approvals
```

## AI Tasks

1. **Floor Plan Understanding** — input: floor plan image/PDF + project info. Output: rooms, doors,
   windows, dimensions, confidence.
2. **Space Planning** — input: room geometry, furniture requirements, design preferences. Output:
   structured layout concepts (coordinates, not prose).
3. **Design Consultant** — input: room, dimensions, existing furniture, style, budget, materials.
   Output: design direction, palette, materials, lighting, furniture recommendations, flagged
   issues.
4. **Budget Optimizer** — input: target cost reduction. Output: proposed material/furniture/lighting
   substitutions that preserve overall style.

## AI Guardrails

AI must not invent dimensions, silently move structural walls, assume measurements, modify
doors/windows without approval, claim construction feasibility, claim structural safety, or
fabricate product prices. All AI suggestions require designer verification before execution.

## Security

Every business record carries `company_id`. RLS ensures Company A cannot access Company B's data.
Designers can access projects belonging to their company. Clients can only access presentations
explicitly shared with them (via share token).

## Full Screen List (for reference)

Landing page, login/register, dashboard, new-project wizard (3 steps: project info → requirements →
upload), floor plan analyzer (side-by-side original + AI analysis), room verification panel, main
design workspace (sidebar + 2D canvas + properties panel), furniture library (Living / Bedroom /
Dining / Kitchen categories), AI layout generator modal (3 generated concepts), AI design concept
screen, room 3D view, material board, client presentation view, client approval view.
