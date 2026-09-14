import { create } from "zustand";
import type { AsyncState, ProjectSummary, UUID } from "@/types";
import { listProjectSummaries } from "@/services/projectService";

interface ProjectState {
  summaries: AsyncState<ProjectSummary[]>;
  activeProjectId: UUID | null;
  fetchSummaries: (companyId: UUID) => Promise<void>;
  setActiveProject: (projectId: UUID | null) => void;
}

/** Reference Zustand store — mirrors the AsyncState convention from
 * CLAUDE.md §3.9 so every screen renders loading/error/empty states
 * consistently. */
export const useProjectStore = create<ProjectState>((set) => ({
  summaries: { status: "idle" },
  activeProjectId: null,

  fetchSummaries: async (companyId) => {
    set({ summaries: { status: "loading" } });
    try {
      const data = await listProjectSummaries(companyId);
      set({
        summaries:
          data.length === 0 ? { status: "empty" } : { status: "success", data },
      });
    } catch (err) {
      set({
        summaries: {
          status: "error",
          error: err instanceof Error ? err.message : "Failed to load projects",
        },
      });
    }
  },

  setActiveProject: (projectId) => set({ activeProjectId: projectId }),
}));
