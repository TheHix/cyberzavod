import { describe, expect, it } from "vitest";
import type { ApiRequest } from "@/shared/api/http.ts";
import { deleteOwnRecording, fetchOwnGallery, setGalleryPublic } from "./requests.ts";

function respondWith(body: string | null, status: number): ApiRequest {
  return () => Promise.resolve(new Response(body, { status }));
}

function recordingRequests(): { request: ApiRequest; calls: [string, RequestInit | undefined][] } {
  const calls: [string, RequestInit | undefined][] = [];
  const request: ApiRequest = (path, init) => {
    calls.push([path, init]);

    return Promise.resolve(new Response(null, { status: 204 }));
  };

  return { request, calls };
}

describe("fetchOwnGallery", () => {
  it("отдаёт галерею вошедшего автора", async () => {
    const request = respondWith(
      '{"login": "alice", "galleryPublic": true, "limit": 5, "recordings": []}',
      200,
    );

    const gallery = await fetchOwnGallery(request);

    expect(gallery).toEqual({ login: "alice", galleryPublic: true, limit: 5, recordings: [] });
  });

  it("называет ответ 401 тем, что никто не вошёл", async () => {
    const request = respondWith('{"error": "unauthorized", "message": "нет"}', 401);

    const gallery = await fetchOwnGallery(request);

    expect(gallery).toBeUndefined();
  });

  it("бросает другие ошибки API", async () => {
    const request = respondWith('{"error": "internal", "message": "упал"}', 500);

    const act = fetchOwnGallery(request);

    await expect(act).rejects.toEqual(expect.objectContaining({ status: 500 }) as Error);
  });
});

describe("setGalleryPublic", () => {
  it("шлёт видимость галереи в теле PUT", async () => {
    const { request, calls } = recordingRequests();

    await setGalleryPublic(false, request);

    expect(calls.map(([path, init]) => [path, init?.method, init?.body])).toEqual([
      ["/api/me/gallery", "PUT", '{"public":false}'],
    ]);
  });
});

describe("deleteOwnRecording", () => {
  it("удаляет запись по id из адреса", async () => {
    const { request, calls } = recordingRequests();

    await deleteOwnRecording("2026-10-05 a/b", request);

    expect(calls.map(([path, init]) => [path, init?.method])).toEqual([
      ["/api/me/recordings/2026-10-05%20a%2Fb", "DELETE"],
    ]);
  });
});
