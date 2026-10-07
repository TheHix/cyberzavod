import { atom, type ReadableAtom } from "nanostores";
import type { BuildStats } from "@/entities/stats";
import { LOADING, settle, type Remote } from "@/shared/api/remote.ts";

/** Страница аналитики: ответ API и действие, которое его запрашивает. */
export interface StatsPageModel {
  /** Аналитика: грузится, готова или почему её нет. */
  readonly $stats: ReadableAtom<Remote<BuildStats>>;
  /**
   * Запрашивает аналитику.
   * @returns {Promise<void>} Когда ответ получен или стало ясно, почему его нет.
   */
  load(): Promise<void>;
}

/**
 * Создаёт модель страницы аналитики.
 * @param {() => Promise<BuildStats>} fetchStats Запрос аналитики.
 * @returns {StatsPageModel} Модель с начальным состоянием «грузится».
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
