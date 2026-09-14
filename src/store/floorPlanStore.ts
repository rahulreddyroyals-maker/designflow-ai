import { create } from "zustand";

/**
 * TODO: implement floorPlanStore.
 * Follow the pattern in projectStore.ts — wrap async data in AsyncState<T>,
 * keep Supabase calls out of this file (call a service function instead),
 * and keep this store scoped to its own domain slice only.
 */
interface FloorPlanStoreState {
  _placeholder?: never;
}

export const useFloorPlanStore = create<FloorPlanStoreState>(() => ({}));
