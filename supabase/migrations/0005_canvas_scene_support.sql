-- Support for the 2D Designer's structured scene model.
--
-- floor_plan_elements previously only ever held AI-detected walls/doors/
-- windows in *image-percentage* coordinates (tied to an uploaded floor
-- plan scan, see 0003/0004). The 2D canvas is a different, project-native
-- coordinate space measured in feet — the same units `rooms` already
-- uses. Rather than silently reinterpreting one column's meaning based on
-- context, we make the coordinate system explicit so the two can never be
-- accidentally mixed.

alter table floor_plan_elements
  add column project_id uuid references projects(id) on delete cascade,
  add column coordinate_system text not null default 'image_percentage'
    check (coordinate_system in ('image_percentage', 'scene_feet'));

-- Backfill project_id for existing (image-derived) rows from their
-- floor_plan, then make it required going forward — every element belongs
-- to a project, whether or not it's also tied to a specific uploaded scan.
update floor_plan_elements fpe
set project_id = fp.project_id
from floor_plans fp
where fpe.floor_plan_id = fp.id and fpe.project_id is null;

alter table floor_plan_elements
  alter column project_id set not null;

-- A canvas-drawn wall/door/window isn't derived from any specific upload.
alter table floor_plan_elements
  alter column floor_plan_id drop not null;

drop policy if exists "floor_plan_elements: via floor_plan" on floor_plan_elements;
create policy "floor_plan_elements: via project" on floor_plan_elements for all using (
  exists (select 1 from projects p where p.id = project_id and is_company_member(p.company_id))
);

create index on floor_plan_elements (project_id);
create index on floor_plan_elements (project_id, coordinate_system);

-- Furniture shouldn't require a room — a hallway console table or foyer
-- bench is a legitimate placement with no enclosing `rooms` row, and a
-- project may have furniture placed before any room is verified. Deleting
-- a room should orphan its furniture back to unassigned, not delete it.
alter table project_furniture
  drop constraint project_furniture_room_id_fkey,
  alter column room_id drop not null,
  add constraint project_furniture_room_id_fkey
    foreign key (room_id) references rooms(id) on delete set null;
