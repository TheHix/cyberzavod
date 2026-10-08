import { describe, expect, it, vi } from "vitest";
import { CommandError } from "../errors.ts";
import { CLI_MESSAGES } from "../messages/catalog.ts";
import { HttpCyberzavodApi } from "./api.ts";
import { author, SECRET_TOKEN, summary } from "./fixtures.ts";
import type { FetchFunction } from "./http.ts";

const BASE_URL = "https://cyberzavod.test";

function answering(status: number, body?: unknown) {
  return vi.fn<FetchFunction>(async () =>
    body === undefined ? new Response(null, { status }) : Response.json(body, { status }),
  );
}

function lastRequest(fetchStub: ReturnType<typeof answering>) {
  const [url, init] = fetchStub.mock.calls[0] ?? [];
  const headers = new Headers(init?.headers);

  return {
    url,
    method: init?.method,
    authorization: headers.get("Authorization"),
    body: init?.body,
  };
}

describe("HttpCyberzavodApi.githubClientId", () => {
  it("читает clientId без авторизации", async () => {
    const fetchStub = answering(200, { clientId: "abc" });
    const api = new HttpCyberzavodApi(BASE_URL, fetchStub);

    const clientId = await api.githubClientId();

    expect({ clientId, request: lastRequest(fetchStub) }).toMatchObject({
      clientId: "abc",
      request: { url: `${BASE_URL}/api/auth/github`, method: "GET", authorization: null },
    });
  });

  it("503 auth_unavailable — ошибка сервера с его текстом", async () => {
    const api = new HttpCyberzavodApi(
      BASE_URL,
      answering(503, { error: "auth_unavailable", message: "Вход недоступен" }),
    );

    const act = () => api.githubClientId();

    await expect(act()).rejects.toMatchObject({
      code: "auth_unavailable",
      status: 503,
      message: "Вход недоступен",
    });
  });
});

describe("HttpCyberzavodApi.me", () => {
  it("несёт токен в Authorization и разбирает автора", async () => {
    const me = author({ login: "alice", recordings: [summary()] });
    const fetchStub = answering(200, me);
    const api = new HttpCyberzavodApi(BASE_URL, fetchStub);

    const result = await api.me(SECRET_TOKEN);

    expect({ result, authorization: lastRequest(fetchStub).authorization }).toEqual({
      result: me,
      authorization: `Bearer ${SECRET_TOKEN}`,
    });
  });

  it("ответ без полей — неожиданный ответ, а не undefined в командах", async () => {
    const api = new HttpCyberzavodApi(BASE_URL, answering(200, { login: "alice" }));

    const act = () => api.me(SECRET_TOKEN);

    await expect(act()).rejects.toThrow(CommandError);
    await expect(act()).rejects.toThrow(
      "the server returned an unexpected response: no valid field galleryPublic",
    );
  });

  it("запись автора без поля — называет поле записи", async () => {
    const body = { ...author(), recordings: [{ ...summary(), slug: 1 }] };
    const api = new HttpCyberzavodApi(BASE_URL, answering(200, body));

    const act = () => api.me(SECRET_TOKEN);

    await expect(act()).rejects.toThrow("no valid field recordings[].slug");
  });

  it("502 без тела — ошибка команды со статусом, а не ошибка сервера", async () => {
    const api = new HttpCyberzavodApi(BASE_URL, answering(502));

    const act = () => api.me(SECRET_TOKEN);

    await expect(act()).rejects.toThrow(CommandError);
    await expect(act()).rejects.toThrow("the server answered 502");
  });

  it("ошибка без тела печатается на языке сообщений", async () => {
    const api = new HttpCyberzavodApi(BASE_URL, answering(502));

    const error = await api.me(SECRET_TOKEN).then(
      () => undefined,
      (err: unknown) => err,
    );

    expect((error as CommandError).describe(CLI_MESSAGES.ru)).toBe("сервер ответил 502");
  });
});

describe("HttpCyberzavodApi.uploadRecording", () => {
  it("201 — новая запись, тело — сама запись", async () => {
    const fetchStub = answering(201, { recording: summary() });
    const api = new HttpCyberzavodApi(BASE_URL, fetchStub);

    const uploaded = await api.uploadRecording(SECRET_TOKEN, "a-1", { id: "a-1" });

    expect({ uploaded, request: lastRequest(fetchStub) }).toMatchObject({
      uploaded: { isNew: true, recording: summary() },
      request: {
        url: `${BASE_URL}/api/me/recordings/a-1`,
        method: "PUT",
        body: '{"id":"a-1"}',
      },
    });
  });

  it("200 — запись заменена", async () => {
    const api = new HttpCyberzavodApi(BASE_URL, answering(200, { recording: summary() }));

    const uploaded = await api.uploadRecording(SECRET_TOKEN, "a-1", {});

    expect(uploaded.isNew).toBe(false);
  });

  it("409 limit_reached сохраняет код ошибки", async () => {
    const api = new HttpCyberzavodApi(
      BASE_URL,
      answering(409, { error: "limit_reached", message: "Лимит" }),
    );

    const act = () => api.uploadRecording(SECRET_TOKEN, "a-1", {});

    await expect(act()).rejects.toMatchObject({ code: "limit_reached", status: 409 });
  });
});

describe("HttpCyberzavodApi.deleteRecording", () => {
  it("DELETE записи; 204 без тела — успех", async () => {
    const fetchStub = answering(204);
    const api = new HttpCyberzavodApi(BASE_URL, fetchStub);

    await api.deleteRecording(SECRET_TOKEN, "a-1");

    expect(lastRequest(fetchStub)).toMatchObject({
      url: `${BASE_URL}/api/me/recordings/a-1`,
      method: "DELETE",
    });
  });
});

describe("HttpCyberzavodApi.setGalleryPublic", () => {
  it("отправляет public в теле", async () => {
    const fetchStub = answering(200, { galleryPublic: true });
    const api = new HttpCyberzavodApi(BASE_URL, fetchStub);

    await api.setGalleryPublic(SECRET_TOKEN, true);

    expect(lastRequest(fetchStub)).toMatchObject({
      url: `${BASE_URL}/api/me/gallery`,
      method: "PUT",
      body: '{"public":true}',
    });
  });
});
