import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { Profile, UUID } from "@/types";

/**
 * All Supabase Auth access lives here. Stores and components call these
 * functions instead of touching `supabase.auth` directly (CLAUDE.md §3.7).
 */

export interface SignUpInput {
  fullName: string;
  email: string;
  password: string;
}

export interface SignUpResult {
  session: Session | null;
  userId: UUID | null;
  /** True when Supabase requires email confirmation before a session is
   * issued. The UI should show a "check your email" state in that case
   * rather than assuming sign-up failed. */
  needsEmailConfirmation: boolean;
}

export async function signUp({
  fullName,
  email,
  password,
}: SignUpInput): Promise<SignUpResult> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });

  if (error) throw error;

  return {
    session: data.session,
    userId: data.user?.id ?? null,
    needsEmailConfirmation: data.session === null,
  };
}

export async function signIn(email: string, password: string): Promise<Session> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  if (!data.session) throw new Error("Sign in did not return a session.");
  return data.session;
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSession(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function getProfile(userId: UUID): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/** Subscribes to auth state changes. Returns an unsubscribe function. */
export function onAuthStateChange(
  callback: (session: Session | null) => void
): () => void {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });
  return () => data.subscription.unsubscribe();
}
