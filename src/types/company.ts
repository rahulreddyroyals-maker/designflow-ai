import type { BaseRecord, CurrencyCode, ISODateString, UUID } from "./common";

/** Matches Supabase `auth.users` linked profile. */
export interface Profile extends BaseRecord {
  full_name: string | null;
  email: string;
  avatar_url: string | null;
  role: PlatformRole;
}

/** Platform-level role, distinct from a per-company role (see CompanyMember). */
export type PlatformRole = "user" | "admin";

export interface Company extends BaseRecord {
  name: string;
  logo_url: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  country: string | null;
  currency: CurrencyCode;
}

export type CompanyMemberRole = "owner" | "admin" | "designer" | "viewer";

export interface CompanyMember extends BaseRecord {
  company_id: UUID;
  user_id: UUID;
  role: CompanyMemberRole;
}

/** Joined shape used by the UI when listing a company's team. */
export interface CompanyMemberWithProfile extends CompanyMember {
  profile: Profile;
}

export interface Client extends BaseRecord {
  company_id: UUID;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
}

/** Form shape for creating/editing a client. */
export interface ClientInput {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
}

export interface Subscription extends BaseRecord {
  company_id: UUID;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  current_period_end: ISODateString | null;
}

export type SubscriptionPlan = "free" | "studio" | "business" | "enterprise";
export type SubscriptionStatus = "active" | "trialing" | "past_due" | "canceled";
