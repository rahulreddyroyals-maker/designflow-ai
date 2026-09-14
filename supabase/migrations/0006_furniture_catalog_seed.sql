-- Starter furniture catalog for the 2D Designer's palette (see
-- docs/PRODUCT_SPEC.md §11 "Furniture Library"). Dimensions are realistic
-- cm figures for common pieces — a reasonable default set a designer can
-- immediately drag onto the canvas, not placeholder/fake data: these are
-- genuinely usable starting dimensions, editable per-placement afterward.

alter table furniture_items add constraint furniture_items_name_key unique (name);

insert into furniture_items (name, category, subcategory, width, depth, height) values
  -- Living
  ('3-Seater Sofa', 'living', 'sofa', 200, 90, 85),
  ('L-Shaped Sofa', 'living', 'sofa', 270, 180, 85),
  ('Armchair', 'living', 'seating', 80, 85, 90),
  ('Coffee Table', 'living', 'table', 110, 60, 45),
  ('TV Unit', 'living', 'storage', 180, 40, 50),
  ('Console Table', 'living', 'table', 120, 35, 80),

  -- Bedroom
  ('Queen Bed', 'bedroom', 'bed', 153, 203, 45),
  ('King Bed', 'bedroom', 'bed', 193, 203, 45),
  ('Single Bed', 'bedroom', 'bed', 96, 190, 45),
  ('Bedside Table', 'bedroom', 'table', 45, 40, 55),
  ('Wardrobe (2-door)', 'bedroom', 'storage', 100, 60, 210),
  ('Wardrobe (3-door)', 'bedroom', 'storage', 150, 60, 210),
  ('Dressing Table', 'bedroom', 'table', 100, 45, 140),
  ('Study Desk', 'bedroom', 'table', 120, 60, 75),

  -- Dining
  ('4-Seater Dining Table', 'dining', 'table', 120, 75, 75),
  ('6-Seater Dining Table', 'dining', 'table', 160, 90, 75),
  ('8-Seater Dining Table', 'dining', 'table', 220, 100, 75),
  ('Dining Chair', 'dining', 'seating', 45, 50, 90),
  ('Crockery Unit', 'dining', 'storage', 150, 45, 180),

  -- Kitchen
  ('Base Cabinet Run (2m)', 'kitchen', 'cabinet', 200, 60, 85),
  ('Wall Cabinet Run (2m)', 'kitchen', 'cabinet', 200, 35, 70),
  ('Tall Unit', 'kitchen', 'cabinet', 60, 60, 210),
  ('Refrigerator', 'kitchen', 'appliance', 75, 70, 175),
  ('Kitchen Island', 'kitchen', 'cabinet', 150, 90, 90),

  -- Lighting
  ('Floor Lamp', 'lighting', 'lamp', 40, 40, 160),
  ('Pendant Light', 'lighting', 'ceiling', 30, 30, 30),

  -- Storage
  ('Bookshelf', 'storage', 'shelving', 90, 30, 180),
  ('Shoe Cabinet', 'storage', 'cabinet', 80, 35, 100)
on conflict (name) do nothing;
