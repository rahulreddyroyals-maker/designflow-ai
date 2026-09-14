import { create } from "zustand";
import type { AsyncState, UUID } from "@/types";
import { getDashboardData, type DashboardData } from "@/services/projectService";

interface DashboardState {
  data: AsyncState<DashboardData>;
  fetch: (companyId: UUID) => Promise<void>;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  data: { status: "idle" },

  fetch: async (companyId) => {
    set({ data: { status: "loading" } });
    try {
      const result = await getDashboardData(companyId);
      set({
        data:
          result.stats.total === 0
            ? { status: "empty" }
            : { status: "success", data: result },
      });
    } catch (err) {
      set({
        data: {
          status: "error",
          error: err instanceof Error ? err.message : "Failed to load dashboard.",
        },
      });
    }
  },
}));
