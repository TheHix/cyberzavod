import { atom, type ReadableAtom } from "nanostores";
import type { BuildStats } from "@/entities/stats";
import { LOADING, settle, type Remote } from "@/shared/api/remote.ts";

/** Analytics page: the API response and the action that requests it. */
export interface StatsPageModel {
  /** Analytics: loading, ready, or why it is missing. */
  readonly $stats: ReadableAtom<Remote<BuildStats>>;
  /**
   * Requests the analytics.
   * @returns {Promise<void>} When the response arrives or it is clear why there is none.
   */
  load(): Promise<void>;
}

/**
 * Creates the analytics page model.
 * @param {() => Promise<BuildStats>} fetchStats Analytics request.
 * @returns {StatsPageModel} A model in the initial "loading" state.
 */
export function createStatsPageModel(fetchStats: () => Promise<BuildStats>): StatsPageModel {
  const $stats = atom<Remote<BuildStats>>(LOADING);

  return {
    $stats,
    load: async () => {
      $stats.set(await settle(fetchStats));
    },
  };
}
