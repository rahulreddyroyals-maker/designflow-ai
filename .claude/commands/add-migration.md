Add a Supabase migration for: $ARGUMENTS

1. Never edit a migration file that has already shipped — create a new numbered file in
   supabase/migrations/ (e.g. 0002_description.sql).
2. Update matching TypeScript types in src/types/ in the same change.
3. Add or update RLS policies for any new tenant-owned table — follow the pattern in
   0001_init.sql (scope by company_id, or by joining up to the parent project/company).
4. If the change affects an AI task's input/output shape, update src/types/ai.ts too.
5. Summarize the schema change and list every file touched.
