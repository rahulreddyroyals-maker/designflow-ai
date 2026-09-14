-- Rooms already track confidence_score + verified (0001_init.sql). Walls,
-- doors, and windows detected by AI need the same so the designer can
-- verify structural elements, not just rooms (CLAUDE.md §4 "Human
-- verification").

alter table floor_plan_elements
  add column confidence_score numeric,
  add column verified boolean not null default false;
