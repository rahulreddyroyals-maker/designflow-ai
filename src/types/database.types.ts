/**
 * Placeholder for Supabase's generated database types.
 *
 * Once the schema in `supabase/migrations/` is applied to a real project,
 * regenerate this file with:
 *
 *   npx supabase gen types typescript --project-id <project-id> > src/types/database.types.ts
 *
 * Do NOT hand-edit the generated file once real generation is wired up —
 * hand-write domain types in `src/types/*.ts` instead and keep this file
 * purely as the Supabase client's schema contract.
 */

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface Database {
  // Intentionally empty until `supabase gen types` has been run against a
  // real project. The Supabase client still works without this being
  // filled in — it just won't have row-level autocompletion yet.
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
