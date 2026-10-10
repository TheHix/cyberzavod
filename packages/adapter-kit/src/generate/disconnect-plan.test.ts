import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  applyDisconnect,
  isEmptySettings,
  plannedDisconnectFiles,
  settingsOutcomeOf,
  settingsText,
  withoutAdapterHooks,
  type DisconnectPlan,
} from "./disconnect-plan.ts";
import { hookCommand } from "./hook-config.ts";
import { contentHash, MANIFEST_FILE } from "./manifest.ts";

const OWN = {
  type: "command",
  command: hookCommand({ runner: "npx -y", version: "1", hook: "stop", onFailure: "true" }),
};
const HUMAN = { type: "command", command: "echo mine" };

let root: string;

async function write(relative: string, content: string): Promise<void> {
  const file = path.join(root, relative);

  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, content);
}

async function exists(relative: string): Promise<boolean> {
  return access(path.join(root, relative)).then(
    () => true,
    () => false,
  );
}

describe("settingsText", () => {
  it("пишет JSON с отступом в два пробела и переводом строки в конце", () => {
    expect(settingsText({ a: 1 })).toBe('{\n  "a": 1\n}\n');
  });
});

describe("withoutAdapterHooks", () => {
  it("убирает свои обработчики и пустое hooks, оставляя прочие ключи", () => {
    const settings = { description: "mine", hooks: { Stop: [{ hooks: [OWN] }] } };

    expect(withoutAdapterHooks(settings)).toEqual({ description: "mine" });
  });

  it("оставляет чужие обработчики", () => {
    const settings = { hooks: { Stop: [{ hooks: [OWN, HUMAN] }] } };

    expect(withoutAdapterHooks(settings)).toEqual({ hooks: { Stop: [{ hooks: [HUMAN] }] } });
  });
});

describe("isEmptySettings", () => {
  it("считает пустым только объект без ключей", () => {
    expect([isEmptySettings({}), isEmptySettings({ a: 1 })]).toEqual([true, false]);
  });
});

describe("settingsOutcomeOf", () => {
  it("различает отсутствие файла, пустой остаток, правку и отсутствие правки", () => {
    const text = JSON.stringify({ a: 1 });

    expect([
      settingsOutcomeOf(undefined, {}),
      settingsOutcomeOf(text, {}),
      settingsOutcomeOf(text, { a: 1 }),
      settingsOutcomeOf(text, { b: 1 }),
    ]).toEqual(["unchanged", "removed", "unchanged", "updated"]);
  });
});

describe("файлы на диске", () => {
  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), "cyberzavod-kit-disconnect-"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  describe("plannedDisconnectFiles", () => {
    it("удаляет нетронутые файлы вместе с манифестом и оставляет исправленные", async () => {
      await write("a.md", "a");
      await write("b.md", "changed");
      await write(MANIFEST_FILE, "{}");

      const manifest = {
        files: { "a.md": contentHash("a"), "b.md": contentHash("original") },
        deny: [],
      };

      const plan = await plannedDisconnectFiles({
        root,
        manifest,
        candidates: ["a.md", "b.md", "gone.md"],
      });

      expect(plan).toEqual({ removed: ["a.md", MANIFEST_FILE], edited: ["b.md"] });
    });
  });

  describe("applyDisconnect", () => {
    function planOf(settings: DisconnectPlan["settings"], removed: string[]): DisconnectPlan {
      return { removed, edited: [], settings };
    }

    it("переписывает файл настроек, если остался чужой текст", async () => {
      await write(".agent/hooks.json", "old");

      await applyDisconnect({
        root,
        file: ".agent/hooks.json",
        plan: planOf("updated", []),
        settings: { description: "mine" },
        boundaries: [".agent"],
      });

      expect(JSON.parse(await readFile(path.join(root, ".agent/hooks.json"), "utf8"))).toEqual({
        description: "mine",
      });
    });

    it("удаляет файл настроек, файлы плана и опустевшие каталоги", async () => {
      await write(".agent/hooks.json", "old");
      await write(".agent/roles/a.toml", "a");

      await applyDisconnect({
        root,
        file: ".agent/hooks.json",
        plan: planOf("removed", [".agent/roles/a.toml"]),
        settings: {},
        boundaries: [".agent"],
      });

      expect(await exists(".agent")).toBe(false);
    });

    it("не трогает файл настроек, если он не менялся", async () => {
      await write(".agent/hooks.json", "same");

      await applyDisconnect({
        root,
        file: ".agent/hooks.json",
        plan: planOf("unchanged", []),
        settings: {},
        boundaries: [".agent"],
      });

      expect(await readFile(path.join(root, ".agent/hooks.json"), "utf8")).toBe("same");
    });
  });
});
