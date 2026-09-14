import { supabase } from "@/lib/supabase";
import type { Client, ClientInput, UUID } from "@/types";

/** All Supabase access for `clients` lives here — pages call these
 * functions, never `supabase.from("clients")` directly. */

export async function listClients(companyId: UUID): Promise<Client[]> {
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .eq("company_id", companyId)
    .order("name", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function getClient(clientId: UUID): Promise<Client | null> {
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function createClient(
  companyId: UUID,
  input: ClientInput
): Promise<Client> {
  const { data, error } = await supabase
    .from("clients")
    .insert({
      company_id: companyId,
      name: input.name,
      email: input.email ?? null,
      phone: input.phone ?? null,
      address: input.address ?? null,
      notes: input.notes ?? null,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function updateClient(
  clientId: UUID,
  input: ClientInput
): Promise<Client> {
  const { data, error } = await supabase
    .from("clients")
    .update({
      name: input.name,
      email: input.email ?? null,
      phone: input.phone ?? null,
      address: input.address ?? null,
      notes: input.notes ?? null,
    })
    .eq("id", clientId)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

/** Deleting a client does not delete their projects — `projects.client_id`
 * is ON DELETE SET NULL, so any linked projects simply become unassigned. */
export async function deleteClient(clientId: UUID): Promise<void> {
  const { error } = await supabase.from("clients").delete().eq("id", clientId);
  if (error) throw error;
}
