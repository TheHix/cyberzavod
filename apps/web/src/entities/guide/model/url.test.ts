import { describe, expect, it } from "vitest";
import { guideUrl } from "./url.ts";

describe("guideUrl", () => {
  it("оставляет адрес в корне для английского", () => {
    const url = guideUrl("how-to", "en");

    expect(url).toBe("/guides/how-to/");
  });

  it("добавляет префикс /ru для русского", () => {
    const url = guideUrl("how-to", "ru");

    expect(url).toBe("/ru/guides/how-to/");
  });
});
