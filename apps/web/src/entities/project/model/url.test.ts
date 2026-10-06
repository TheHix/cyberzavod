import { describe, expect, it } from "vitest";
import { projectUrl } from "./url.ts";

describe("projectUrl", () => {
  it("оставляет адрес в корне для английского", () => {
    const url = projectUrl("demo", "en");

    expect(url).toBe("/projects/demo/");
  });

  it("добавляет префикс /ru для русского", () => {
    const url = projectUrl("demo", "ru");

    expect(url).toBe("/ru/projects/demo/");
  });
});
