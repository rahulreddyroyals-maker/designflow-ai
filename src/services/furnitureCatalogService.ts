import { supabase } from "@/lib/supabase";
import type { FurnitureCategory, FurnitureItem } from "@/types";

/** Read-only access to the shared `furniture_items` catalog. Seeded via
 * migration 0006 — this is a global reference catalog, not company-scoped
 * (see FurnitureItem's doc comment in types/furniture.ts). */

export async function listCatalog(category?: FurnitureCategory): Promise<FurnitureItem[]> {
  let query = supabase.from("furniture_items").select("*").order("name", { ascending: true });
  if (category) query = query.eq("category", category);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}
