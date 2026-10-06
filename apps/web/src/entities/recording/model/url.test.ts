import { describe, expect, it } from "vitest";
import { recordingUrl } from "./url.ts";

describe("recordingUrl", () => {
  it("оставляет адрес в корне для английского", () => {
    const url = recordingUrl("a-1", "en");

    expect(url).toBe("/recordings/a-1/");
  });

  it("добавляет префикс /ru для русского", () => {
    const url = recordingUrl("a-1", "ru");

    expect(url).toBe("/ru/recordings/a-1/");
  });
});
