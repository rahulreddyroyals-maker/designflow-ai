import { supabase } from "@/lib/supabase";
import type {
  Company,
  CompanyMemberRole,
  CompanyMemberWithProfile,
  UUID,
} from "@/types";

/**
 * All company / multi-tenancy queries live here. This is the only place
 * that reads or writes `companies` and `company_members`.
 */

export interface UserCompany {
  company: Company;
  role: CompanyMemberRole;
}

/** MVP assumption: one company per user. Revisit if multi-company
 * membership becomes a real requirement — the schema already supports it
 * (company_members is a join table), this query just takes the first row. */
export async function getCompanyForUser(userId: UUID): Promise<UserCompany | null> {
  const { data, error } = await supabase
    .from("company_members")
    .select("role, company:companies(*)")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data || !data.company) return null;

  return {
    company: data.company as unknown as Company,
    role: data.role as CompanyMemberRole,
  };
}

/** Creates a company and its owner membership atomically via the
 * `create_company_with_owner` RPC (see supabase/migrations/0002_*). */
export async function createCompanyWithOwner(
  name: string,
  currency = "INR"
): Promise<Company> {
  const { data, error } = await supabase.rpc("create_company_with_owner", {
    company_name: name,
    company_currency: currency,
  });

  if (error) throw error;
  return data as Company;
}

export async function listTeamMembers(
  companyId: UUID
): Promise<CompanyMemberWithProfile[]> {
  const { data, error } = await supabase
    .from("company_members")
    .select("*, profile:profiles(*)")
    .eq("company_id", companyId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as unknown as CompanyMemberWithProfile[];
}
