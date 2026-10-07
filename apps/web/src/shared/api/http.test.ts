import { describe, expect, it } from "vitest";
import { ApiRequestError, ApiResponseError } from "./errors.ts";
import { getJson, type ApiRequest } from "./http.ts";

function respondWith(body: string, status: number): ApiRequest {
  return () => Promise.resolve(new Response(body, { status }));
}

describe("getJson", () => {
  it("отдаёт тело успешного ответа", async () => {
    const request = respondWith('{"recordings": 3}', 200);

    const body = await getJson("/api/stats", request);

    expect(body).toEqual({ recordings: 3 });
  });

  it("бросает ошибку с кодом и статусом из ответа API", async () => {
    const request = respondWith('{"error": "not_found", "message": "нет"}', 404);

    const act = getJson("/api/galleries/ghost", request);

    await expect(act).rejects.toEqual(
      expect.objectContaining({ status: 404, code: "not_found" }) as ApiRequestError,
    );
  });

  it("помечает код неизвестным, если тело ошибки не JSON", async () => {
    const request = respondWith("<html>Bad Gateway</html>", 502);

    const act = getJson("/api/stats", request);

    await expect(act).rejects.toEqual(
      expect.objectContaining({ status: 502, code: "unknown" }) as ApiRequestError,
    );
  });

  it("отклоняет успешный ответ, тело которого не JSON", async () => {
    const request = respondWith("<html></html>", 200);

    const act = getJson("/api/stats", request);

    await expect(act).rejects.toBeInstanceOf(ApiResponseError);
  });
});
