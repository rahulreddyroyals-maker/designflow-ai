-- Floor plan storage security. Previously `uploadFloorPlan` stored a
-- *public* storage URL — anyone with the link (no auth required) could
-- view a company's floor plans. This migration:
--   1. Ensures the `floor-plans` bucket exists and is private.
--   2. Adds storage RLS scoped to the company that owns the project the
--      file belongs to (derived from the object path's first segment).
--   3. Renames `floor_plans.file_url` to `storage_path`, since it now
--      stores a bucket-relative path, not a browsable URL — the app must
--      call floorPlanService.getFloorPlanPreviewUrl() to get a short-lived
--      signed URL for display.

insert into storage.buckets (id, name, public)
values ('floor-plans', 'floor-plans', false)
on conflict (id) do update set public = false;

alter table floor_plans rename column file_url to storage_path;

comment on column floor_plans.storage_path is
  'Path within the floor-plans storage bucket, e.g. "<project_id>/<uuid>-plan.pdf". Not a public URL — generate a signed URL for display.';

-- Uploads are written as "<project_id>/<filename>" (see
-- floorPlanService.uploadFloorPlan), so the first path segment tells us
-- which project — and therefore which company — an object belongs to.
create or replace function public.can_access_floor_plan_object(object_name text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from projects p
    where p.id::text = split_part(object_name, '/', 1)
      and is_company_member(p.company_id)
  );
$$;

drop policy if exists "floor-plans: company member select" on storage.objects;
create policy "floor-plans: company member select"
  on storage.objects for select
  using (bucket_id = 'floor-plans' and can_access_floor_plan_object(name));

drop policy if exists "floor-plans: company member insert" on storage.objects;
create policy "floor-plans: company member insert"
  on storage.objects for insert
  with check (bucket_id = 'floor-plans' and can_access_floor_plan_object(name));

drop policy if exists "floor-plans: company member delete" on storage.objects;
create policy "floor-plans: company member delete"
  on storage.objects for delete
  using (bucket_id = 'floor-plans' and can_access_floor_plan_object(name));
