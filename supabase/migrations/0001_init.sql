-- DesignFlow AI — initial schema
-- Mirrors src/types/*.ts. If you change one, change the other in the same PR.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Tenancy & identity
-- ---------------------------------------------------------------------------

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text not null,
  avatar_url text,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now()
);

create table companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text,
  email text,
  phone text,
  address text,
  country text,
  currency text not null default 'INR',
  created_at timestamptz not null default now()
);

-- user_id references `profiles`, not `auth.users`, directly. Both
-- reference auth.users, but PostgREST can only embed a related table
-- through a direct foreign key — routing through profiles is what lets
-- `company_members` embed profile data (see companyService.listTeamMembers).
-- Safe ordering-wise: the handle_new_user trigger guarantees a profiles row
-- exists before any company_members row referencing that user can be created.
create table company_members (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'designer', 'viewer')),
  created_at timestamptz not null default now(),
  unique (company_id, user_id)
);

create table clients (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  address text,
  notes text,
  created_at timestamptz not null default now()
);

create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  plan text not null check (plan in ('free', 'studio', 'business', 'enterprise')),
  status text not null check (status in ('active', 'trialing', 'past_due', 'canceled')),
  current_period_end timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Projects
-- ---------------------------------------------------------------------------

create table projects (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  client_id uuid references clients(id) on delete set null,
  name text not null,
  property_type text not null default 'apartment',
  bhk text,
  area_sqft numeric,
  budget numeric,
  currency text not null default 'INR',
  style text,
  status text not null default 'draft' check (
    status in ('draft', 'analysis', 'designing', 'review', 'approved', 'completed', 'archived')
  ),
  description text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on projects (company_id);
create index on projects (client_id);

-- ---------------------------------------------------------------------------
-- Floor plans & rooms
-- ---------------------------------------------------------------------------

create table floor_plans (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  file_url text not null,
  file_type text not null check (file_type in ('pdf', 'jpg', 'jpeg', 'png')),
  original_filename text not null,
  width numeric,
  height numeric,
  scale numeric,
  analysis_status text not null default 'pending' check (
    analysis_status in ('pending', 'processing', 'completed', 'failed', 'needs_review')
  ),
  analysis_result jsonb,
  created_at timestamptz not null default now()
);

create index on floor_plans (project_id);

create table rooms (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  room_type text not null default 'other',
  width numeric not null,
  length numeric not null,
  area numeric not null,
  ceiling_height numeric,
  position_x numeric not null default 0,
  position_y numeric not null default 0,
  rotation numeric not null default 0,
  confidence_score numeric,
  verified boolean not null default false,
  created_at timestamptz not null default now()
);

create index on rooms (project_id);

create table floor_plan_elements (
  id uuid primary key default gen_random_uuid(),
  floor_plan_id uuid not null references floor_plans(id) on delete cascade,
  room_id uuid references rooms(id) on delete set null,
  element_type text not null check (element_type in ('wall', 'door', 'window', 'column')),
  points jsonb not null,
  width numeric,
  height numeric,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index on floor_plan_elements (floor_plan_id);

-- ---------------------------------------------------------------------------
-- Furniture & materials
-- ---------------------------------------------------------------------------

create table furniture_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null check (
    category in ('living', 'bedroom', 'dining', 'kitchen', 'lighting', 'storage', 'other')
  ),
  subcategory text,
  width numeric not null,
  depth numeric not null,
  height numeric not null,
  thumbnail_url text,
  model_url text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create table project_furniture (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  room_id uuid not null references rooms(id) on delete cascade,
  furniture_item_id uuid not null references furniture_items(id),
  x numeric not null default 0,
  y numeric not null default 0,
  z numeric not null default 0,
  rotation numeric not null default 0,
  scale numeric not null default 1,
  custom_width numeric,
  custom_depth numeric,
  custom_height numeric,
  material_id uuid,
  created_at timestamptz not null default now()
);

create index on project_furniture (project_id);
create index on project_furniture (room_id);

create table materials (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  category text not null check (
    category in ('flooring', 'wall_paint', 'laminate', 'wood', 'fabric', 'glass', 'metal', 'lighting')
  ),
  brand text,
  product_code text,
  color text,
  finish text,
  texture_url text,
  price_per_unit numeric,
  unit text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

alter table project_furniture
  add constraint project_furniture_material_id_fkey
  foreign key (material_id) references materials(id) on delete set null;

create table project_materials (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  room_id uuid references rooms(id) on delete set null,
  material_id uuid not null references materials(id),
  notes text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Design concepts & renders
-- ---------------------------------------------------------------------------

create table design_concepts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  room_id uuid not null references rooms(id) on delete cascade,
  name text not null,
  style text not null,
  description text,
  color_palette jsonb not null default '[]',
  design_prompt text,
  image_url text,
  status text not null default 'draft' check (
    status in ('draft', 'generated', 'selected', 'rejected')
  ),
  created_at timestamptz not null default now()
);

create table renders (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  room_id uuid not null references rooms(id) on delete cascade,
  design_concept_id uuid references design_concepts(id) on delete set null,
  camera_view text not null default 'custom',
  image_url text,
  status text not null default 'queued' check (
    status in ('queued', 'processing', 'completed', 'failed')
  ),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Client presentations
-- ---------------------------------------------------------------------------

create table client_presentations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  title text not null,
  share_token text not null unique default encode(gen_random_bytes(16), 'hex'),
  status text not null default 'draft' check (
    status in ('draft', 'shared', 'in_review', 'approved')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table presentation_items (
  id uuid primary key default gen_random_uuid(),
  presentation_id uuid not null references client_presentations(id) on delete cascade,
  room_id uuid not null references rooms(id) on delete cascade,
  render_id uuid references renders(id) on delete set null,
  order_index int not null default 0,
  description text,
  created_at timestamptz not null default now()
);

create table comments (
  id uuid primary key default gen_random_uuid(),
  presentation_item_id uuid not null references presentation_items(id) on delete cascade,
  author_name text not null,
  author_type text not null check (author_type in ('designer', 'client')),
  content text not null,
  created_at timestamptz not null default now()
);

create table approvals (
  id uuid primary key default gen_random_uuid(),
  presentation_item_id uuid not null references presentation_items(id) on delete cascade,
  status text not null default 'pending' check (
    status in ('pending', 'approved', 'changes_requested')
  ),
  approved_by text,
  approved_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- AI generations (audit log — CLAUDE.md §3.12 / §4)
-- ---------------------------------------------------------------------------

create table ai_generations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  task_type text not null check (
    task_type in ('floor_plan_analysis', 'space_planning', 'design_consultant', 'budget_optimizer')
  ),
  provider text not null check (provider in ('claude', 'gemini')),
  input jsonb not null,
  output jsonb,
  status text not null default 'queued' check (
    status in ('queued', 'processing', 'completed', 'failed')
  ),
  error text,
  created_at timestamptz not null default now()
);

create index on ai_generations (project_id);

-- ---------------------------------------------------------------------------
-- Row Level Security — every tenant-owned table (CLAUDE.md §3.2)
-- ---------------------------------------------------------------------------

create or replace function is_company_member(target_company_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from company_members
    where company_id = target_company_id
      and user_id = auth.uid()
  );
$$;

alter table companies enable row level security;
alter table company_members enable row level security;
alter table clients enable row level security;
alter table subscriptions enable row level security;
alter table projects enable row level security;
alter table floor_plans enable row level security;
alter table rooms enable row level security;
alter table floor_plan_elements enable row level security;
alter table project_furniture enable row level security;
alter table materials enable row level security;
alter table project_materials enable row level security;
alter table design_concepts enable row level security;
alter table renders enable row level security;
alter table client_presentations enable row level security;
alter table presentation_items enable row level security;
alter table comments enable row level security;
alter table approvals enable row level security;
alter table ai_generations enable row level security;
alter table profiles enable row level security;

-- profiles: a user can read/update only their own row
create policy "profiles: self read" on profiles for select using (id = auth.uid());
create policy "profiles: self update" on profiles for update using (id = auth.uid());

-- companies: members only
create policy "companies: member read" on companies for select using (is_company_member(id));
create policy "companies: member update" on companies for update using (is_company_member(id));

create policy "company_members: member read" on company_members for select
  using (is_company_member(company_id));

-- clients / projects / materials: scoped by company_id directly
create policy "clients: member all" on clients for all using (is_company_member(company_id));
create policy "subscriptions: member read" on subscriptions for select using (is_company_member(company_id));
create policy "projects: member all" on projects for all using (is_company_member(company_id));
create policy "materials: member all" on materials for all using (is_company_member(company_id));

-- everything else: scoped via the parent project's company
create policy "floor_plans: via project" on floor_plans for all using (
  exists (select 1 from projects p where p.id = project_id and is_company_member(p.company_id))
);
create policy "rooms: via project" on rooms for all using (
  exists (select 1 from projects p where p.id = project_id and is_company_member(p.company_id))
);
create policy "floor_plan_elements: via floor_plan" on floor_plan_elements for all using (
  exists (
    select 1 from floor_plans fp
    join projects p on p.id = fp.project_id
    where fp.id = floor_plan_id and is_company_member(p.company_id)
  )
);
create policy "project_furniture: via project" on project_furniture for all using (
  exists (select 1 from projects p where p.id = project_id and is_company_member(p.company_id))
);
create policy "project_materials: via project" on project_materials for all using (
  exists (select 1 from projects p where p.id = project_id and is_company_member(p.company_id))
);
create policy "design_concepts: via project" on design_concepts for all using (
  exists (select 1 from projects p where p.id = project_id and is_company_member(p.company_id))
);
create policy "renders: via project" on renders for all using (
  exists (select 1 from projects p where p.id = project_id and is_company_member(p.company_id))
);
create policy "client_presentations: via project" on client_presentations for all using (
  exists (select 1 from projects p where p.id = project_id and is_company_member(p.company_id))
);
create policy "presentation_items: via presentation" on presentation_items for all using (
  exists (
    select 1 from client_presentations cp
    join projects p on p.id = cp.project_id
    where cp.id = presentation_id and is_company_member(p.company_id)
  )
);
create policy "comments: via presentation_item" on comments for all using (
  exists (
    select 1 from presentation_items pi
    join client_presentations cp on cp.id = pi.presentation_id
    join projects p on p.id = cp.project_id
    where pi.id = presentation_item_id and is_company_member(p.company_id)
  )
);
create policy "approvals: via presentation_item" on approvals for all using (
  exists (
    select 1 from presentation_items pi
    join client_presentations cp on cp.id = pi.presentation_id
    join projects p on p.id = cp.project_id
    where pi.id = presentation_item_id and is_company_member(p.company_id)
  )
);
create policy "ai_generations: via project" on ai_generations for all using (
  exists (select 1 from projects p where p.id = project_id and is_company_member(p.company_id))
);

-- furniture_items is a shared global catalog for the MVP — readable by any
-- authenticated user, writable only via service role (seeded, not user-created).
alter table furniture_items enable row level security;
create policy "furniture_items: authenticated read" on furniture_items
  for select using (auth.role() = 'authenticated');

-- NOTE: client access to `client_presentations` / `presentation_items` via
-- the public /share/:token route is intentionally NOT handled by RLS above
-- (clients have no auth.uid()). Serve that route through a dedicated Edge
-- Function that looks up by share_token with the service role key, rather
-- than relaxing RLS on these tables.
