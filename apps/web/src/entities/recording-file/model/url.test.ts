import { describe, expect, it } from "vitest";
import { recordingFileUrl } from "./url.ts";

describe("recordingFileUrl", () => {
  it("ведёт к файлу записи от корня сайта", () => {
    const url = recordingFileUrl("2026-10-07-79fd668f-2");

    expect(url).toBe("/recordings/2026-10-07-79fd668f-2.json");
  });

  it("кодирует id, чтобы он не выходил из пути", () => {
    const url = recordingFileUrl("../a b");

    expect(url).toBe("/recordings/..%2Fa%20b.json");
  });
});
