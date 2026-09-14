import type { Session } from "@supabase/supabase-js";
import { create } from "zustand";
import * as authService from "@/services/authService";
import * as companyService from "@/services/companyService";
import type { Company, CompanyMemberRole, Profile } from "@/types";

export type AuthStatus =
  | "loading" // initial session check in flight
  | "authenticated" // session + profile + company all resolved
  | "needs_company" // session + profile resolved, but no company yet
  | "unauthenticated"
  | "error";

interface AuthState {
  status: AuthStatus;
  session: Session | null;
  profile: Profile | null;
  company: Company | null;
  companyRole: CompanyMemberRole | null;
  error: string | null;

  /** Starts the session check + subscribes to auth changes. Safe to call
   * once at the root of the app; guarded against double-initialization. */
  initialize: () => void;
  signOut: () => Promise<void>;
  /** Re-fetches company membership — call after the Onboarding flow
   * creates a company for a `needs_company` user. */
  refreshCompany: () => Promise<void>;
}

let initialized = false;

async function loadProfileAndCompany(
  session: Session,
  set: (partial: Partial<AuthState>) => void
) {
  try {
    const profile = await authService.getProfile(session.user.id);
    if (!profile) {
      // Trigger hasn't caught up yet (rare race right after sign-up) —
      // treat as still loading rather than erroring the whole app.
      set({ status: "loading" });
      return;
    }

    const userCompany = await companyService.getCompanyForUser(session.user.id);

    set({
      session,
      profile,
      company: userCompany?.company ?? null,
      companyRole: userCompany?.role ?? null,
      status: userCompany ? "authenticated" : "needs_company",
      error: null,
    });
  } catch (err) {
    set({
      status: "error",
      error: err instanceof Error ? err.message : "Failed to load your account.",
    });
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  status: "loading",
  session: null,
  profile: null,
  company: null,
  companyRole: null,
  error: null,

  initialize: () => {
    if (initialized) return;
    initialized = true;

    authService
      .getSession()
      .then((session) => {
        if (!session) {
          set({ status: "unauthenticated" });
          return;
        }
        return loadProfileAndCompany(session, set);
      })
      .catch((err) => {
        set({
          status: "error",
          error: err instanceof Error ? err.message : "Failed to check session.",
        });
      });

    authService.onAuthStateChange((session) => {
      if (!session) {
        set({
          status: "unauthenticated",
          session: null,
          profile: null,
          company: null,
          companyRole: null,
        });
        return;
      }
      void loadProfileAndCompany(session, set);
    });
  },

  signOut: async () => {
    await authService.signOut();
    set({
      status: "unauthenticated",
      session: null,
      profile: null,
      company: null,
      companyRole: null,
    });
  },

  refreshCompany: async () => {
    const { session } = get();
    if (!session) return;
    await loadProfileAndCompany(session, set);
  },
}));
