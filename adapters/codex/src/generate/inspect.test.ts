import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { codexHooks, HOOKS_FILE, mergeHooksFile } from "./hooks-config.ts";
import { inspectCodexHooks } from "./inspect.ts";

const VERSION = "1.2.3";

let root: string;

async function writeHooks(text: string): Promise<void> {
  await mkdir(path.join(root, path.dirname(HOOKS_FILE)), { recursive: true });
  await writeFile(path.join(root, HOOKS_FILE), text);
}

describe("inspectCodexHooks", () => {
  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), "cyberzavod-codex-inspect-"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("говорит, что хуков нет, если нет файла", async () => {
    const reading = await inspectCodexHooks(root, VERSION);

    expect(reading).toEqual({ kind: "missing" });
  });

  it("видит хуки в файле", async () => {
    await writeHooks(JSON.stringify(mergeHooksFile({}, codexHooks(VERSION))));

    const reading = await inspectCodexHooks(root, VERSION);

    expect(reading).toEqual({ kind: "installed" });
  });

  it("называет другую версию", async () => {
    await writeHooks(JSON.stringify(mergeHooksFile({}, codexHooks("0.1.0"))));

    const reading = await inspectCodexHooks(root, VERSION);

    expect(reading).toMatchObject({ kind: "otherVersion" });
  });

  it("называет причину, если файл не JSON", async () => {
    await writeHooks("{ not json");

    const reading = await inspectCodexHooks(root, VERSION);

    expect(reading).toMatchObject({
      kind: "unreadable",
      error: { message: expect.stringContaining(".codex/hooks.json cannot be parsed:") },
    });
  });

  it("называет причину, если hooks не того вида", async () => {
    await writeHooks(JSON.stringify({ hooks: [] }));

    const reading = await inspectCodexHooks(root, VERSION);

    expect(reading).toMatchObject({
      kind: "unreadable",
      error: { message: ".codex/hooks.json cannot be parsed: hooks must be an object" },
    });
  });
});
