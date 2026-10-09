import { sendCommand, type ApiRequest } from "@/shared/api/http.ts";

/**
 * Signs out of the site: the API deletes the session and clears its cookie.
 * @param {ApiRequest} [request] Request; the browser `fetch` by default.
 * @returns {Promise<void>} When the API has responded.
 */
export function signOut(request?: ApiRequest): Promise<void> {
  return sendCommand({ method: "POST", path: "/api/auth/logout" }, request);
}
