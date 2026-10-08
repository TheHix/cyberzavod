import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { inspectClaudeHooks } from "./inspect.ts";
import { adapterHooks, mergeSettings, SETTINGS_FILE } from "./settings.ts";

const VERSION = "1.2.3";

let root: string;

async function writeSettings(text: string): Promise<void> {
  await mkdir(path.join(root, path.dirname(SETTINGS_FILE)), { recursive: true });
  await writeFile(path.join(root, SETTINGS_FILE), text);
}

describe("inspectClaudeHooks", () => {
  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), "cyberzavod-inspect-"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("говорит, что хуков нет, если нет файла настроек", async () => {
    const reading = await inspectClaudeHooks(root, VERSION);

    expect(reading).toEqual({ kind: "missing" });
  });

  it("видит хуки в файле настроек", async () => {
    await writeSettings(JSON.stringify(mergeSettings({}, adapterHooks(VERSION))));

    const reading = await inspectClaudeHooks(root, VERSION);

    expect(reading).toEqual({ kind: "installed" });
  });

  it("называет причину, если настройки не JSON", async () => {
    await writeSettings("{ not json");

    const reading = await inspectClaudeHooks(root, VERSION);

    expect(reading).toMatchObject({
      kind: "unreadable",
      error: { message: expect.stringContaining(".claude/settings.json cannot be parsed:") },
    });
  });

  it("называет причину, если настройки не объект", async () => {
    await writeSettings("[]");

    const reading = await inspectClaudeHooks(root, VERSION);

    expect(reading).toMatchObject({
      kind: "unreadable",
      error: {
        message: ".claude/settings.json cannot be parsed: the settings must be an object",
      },
    });
  });

  it("называет причину, если hooks не того вида", async () => {
    await writeSettings(JSON.stringify({ hooks: [] }));

    const reading = await inspectClaudeHooks(root, VERSION);

    expect(reading).toMatchObject({
      kind: "unreadable",
      error: { message: ".claude/settings.json cannot be parsed: hooks должен быть объектом" },
    });
  });
});
