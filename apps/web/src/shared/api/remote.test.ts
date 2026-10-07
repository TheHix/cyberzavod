import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiRequestError, ApiResponseError } from "./errors.ts";
import { readyValue, settle } from "./remote.ts";

describe("settle", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("отдаёт готовые данные", async () => {
    const state = await settle(() => Promise.resolve(42));

    expect(state).toEqual({ status: "ready", value: 42 });
  });

  it("называет ответ 404 отсутствием данных", async () => {
    const notFound = new ApiRequestError(404, "not_found", "нет");

    const state = await settle(() => Promise.reject(notFound));

    expect(state).toEqual({ status: "missing" });
  });

  it("называет ответ не того вида битым", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const state = await settle(() => Promise.reject(new ApiResponseError("не объект")));

    expect(state).toEqual({ status: "broken" });
  });

  it.each([
    ["ошибку сервера", new ApiRequestError(500, "internal", "упал")],
    ["обрыв сети", new TypeError("Failed to fetch")],
  ])("называет %s неудачей запроса", async (_case, error) => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const state = await settle(() => Promise.reject(error));

    expect(state).toEqual({ status: "failed" });
  });
});

describe("readyValue", () => {
  it("отдаёт готовые данные", () => {
    const value = readyValue({ status: "ready", value: 42 });

    expect(value).toBe(42);
  });

  it.each(["loading", "missing", "broken", "failed"] as const)(
    "молчит в состоянии %s",
    (status) => {
      const value = readyValue({ status });

      expect(value).toBeUndefined();
    },
  );
});
