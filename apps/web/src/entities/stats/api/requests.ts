import { getJson, type ApiRequest } from "@/shared/api/http.ts";
import { parseStats, type BuildStats } from "../model/stats.ts";

/**
 * Запрашивает аналитику по записям открытых галерей.
 * @param {ApiRequest} [request] Запрос; по умолчанию `fetch` браузера.
 * @returns {Promise<BuildStats>} Аналитика.
 */
export async function fetchStats(request?: ApiRequest): Promise<BuildStats> {
  const body = await getJson("/api/stats", request);

  return parseStats(body);
}
