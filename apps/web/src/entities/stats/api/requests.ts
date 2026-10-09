import { getJson, type ApiRequest } from "@/shared/api/http.ts";
import { parseStats, type BuildStats } from "../model/stats.ts";

/**
 * Requests stats over the recordings of public galleries.
 * @param {ApiRequest} [request] Request; the browser `fetch` by default.
 * @returns {Promise<BuildStats>} Stats.
 */
export async function fetchStats(request?: ApiRequest): Promise<BuildStats> {
  const body = await getJson("/api/stats", request);

  return parseStats(body);
}
