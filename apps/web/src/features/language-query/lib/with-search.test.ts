import { describe, expect, it } from "vitest";
import { withSearch } from "./with-search.ts";

describe("withSearch", () => {
  it("добавляет параметры страницы к ссылке на другой язык", () => {
    const href = withSearch("/ru/r/", "?id=abc");

    expect(href).toBe("/ru/r/?id=abc");
  });

  it("заменяет прежние параметры ссылки", () => {
    const href = withSearch("/gallery/?user=old", "?user=alice");

    expect(href).toBe("/gallery/?user=alice");
  });

  it("сохраняет якорь ссылки", () => {
    const href = withSearch("/ru/gallery/#top", "?user=alice");

    expect(href).toBe("/ru/gallery/?user=alice#top");
  });

  it("оставляет ссылку без параметров, если у страницы их нет", () => {
    const href = withSearch("/ru/stats/", "");

    expect(href).toBe("/ru/stats/");
  });
});
