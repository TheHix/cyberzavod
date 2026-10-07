import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { claimHumanCallMarker, hookStatePath } from "./state.ts";

let root: string;

describe("hookStatePath", () => {
  it("называет файл по виду состояния и сессии", () => {
    const statePath = hookStatePath("/var/tmp/cz", "4365c610-eb0b_1", "stop-blocks");

    expect(statePath).toBe(path.join("/var/tmp/cz", "cyberzavod-stop-blocks-4365c610-eb0b_1"));
  });

  it("убирает из id сессии всё, кроме безопасных символов", () => {
    const statePath = hookStatePath("/var/tmp/cz", "../s 1/", "human-call");

    expect(statePath).toBe(path.join("/var/tmp/cz", "cyberzavod-human-call-s1"));
  });

  it("называет пустой id сессии unknown", () => {
    const statePath = hookStatePath("/var/tmp/cz", "", "human-call");

    expect(statePath).toBe(path.join("/var/tmp/cz", "cyberzavod-human-call-unknown"));
  });
});

describe("claimHumanCallMarker", () => {
  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), "cyberzavod-marker-"));
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(root, { recursive: true, force: true });
  });

  it("удаляет отметку и сообщает, что она была", async () => {
    const markerPath = hookStatePath(root, "s1", "human-call");

    await writeFile(markerPath, "4");

    const claimed = await claimHumanCallMarker("s1", root);

    expect({
      claimed,
      left: await access(markerPath).then(
        () => true,
        () => false,
      ),
    }).toEqual({
      claimed: true,
      left: false,
    });
  });

  it("без отметки возвращает false и молчит", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const claimed = await claimHumanCallMarker("s1", root);

    expect({ claimed, warnings: warn.mock.calls.length }).toEqual({ claimed: false, warnings: 0 });
  });

  it("при другой ошибке предупреждает и возвращает false", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await mkdir(hookStatePath(root, "s1", "human-call"));

    const claimed = await claimHumanCallMarker("s1", root);

    expect({ claimed, warnings: warn.mock.calls.length }).toEqual({ claimed: false, warnings: 1 });
  });
});
