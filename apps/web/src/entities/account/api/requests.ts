import { sendCommand, type ApiRequest } from "@/shared/api/http.ts";

/**
 * Выходит с сайта: API удаляет сессию и стирает её куку.
 * @param {ApiRequest} [request] Запрос; по умолчанию `fetch` браузера.
 * @returns {Promise<void>} Когда API ответил.
 */
export function signOut(request?: ApiRequest): Promise<void> {
  return sendCommand({ method: "POST", path: "/api/auth/logout" }, request);
}
