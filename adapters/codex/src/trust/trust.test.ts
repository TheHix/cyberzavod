import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { parse } from "smol-toml";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { settingsText } from "@cyberzavod/adapter-kit";
import { CodexError } from "../errors.ts";
import { codexHooks, HOOKS_FILE, mergeHooksFile } from "../generate/hooks-config.ts";
import { CODEX_MESSAGES } from "../messages/catalog.ts";
import { carryOverTrust, inspectTrust, planConnectTrust, planDisconnectTrust } from "./trust.ts";

const VERSION = "0.9.2";
const NEXT_VERSION = "0.9.3";

let sandbox: string;
let root: string;
let home: string;
let codexHome: string;

function source() {
  return { env: { CODEX_HOME: codexHome }, homeDirectory: home };
}

function configFile(): string {
  return path.join(codexHome, "config.toml");
}

async function writeHooks(version: string): Promise<void> {
  const file = path.join(root, HOOKS_FILE);

  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, settingsText(mergeHooksFile({}, codexHooks(version))));
}

async function writeConfig(text: string): Promise<void> {
  await mkdir(codexHome, { recursive: true });
  await writeFile(configFile(), text);
}

async function readConfig(): Promise<string> {
  return readFile(configFile(), "utf8");
}

async function connect(): Promise<void> {
  const plan = await planConnectTrust(source(), { root, version: VERSION });

  await plan.apply();
}

describe("trust", () => {
  beforeEach(async () => {
    sandbox = await realpath(await mkdtemp(path.join(tmpdir(), "cyberzavod-trust-")));
    root = path.join(sandbox, "project");
    home = path.join(sandbox, "home");
    codexHome = path.join(home, ".codex");
    await mkdir(root, { recursive: true });
    await writeHooks(VERSION);
  });

  afterEach(async () => {
    await rm(sandbox, { recursive: true, force: true });
  });

  describe("planConnectTrust", () => {
    it("называет доверие проекту и хукам и ничего не пишет до apply", async () => {
      const plan = await planConnectTrust(source(), { root, version: VERSION });

      expect(plan.changes.map(({ kind }) => kind)).toEqual(["project", "hooks"]);
      await expect(readFile(configFile(), "utf8")).rejects.toThrow();
    });

    it("показывает файл через ~, если он в домашнем каталоге", async () => {
      const plan = await planConnectTrust(
        { env: {}, homeDirectory: home },
        { root, version: VERSION },
      );

      expect(plan.changes[0]?.file).toBe("~/.codex/config.toml");
    });

    it("после apply пишет в config.toml проект и хуки, которые парсер читает как доверие", async () => {
      const plan = await planConnectTrust(source(), { root, version: VERSION });

      await plan.apply();

      const config = parse(await readConfig());
      const states = Object.keys((config.hooks as { state: object }).state);

      expect(config.projects).toEqual({ [root]: { trust_level: "trusted" } });
      expect(states).toHaveLength(9);
      expect(states.every((key) => key.startsWith(path.join(root, HOOKS_FILE)))).toBe(true);
    });

    it("не называет то, что уже доверено, и ничего не пишет", async () => {
      await connect();
      const before = await readConfig();

      const plan = await planConnectTrust(source(), { root, version: VERSION });

      await plan.apply();

      expect(plan.changes).toEqual([]);
      expect(await readConfig()).toBe(before);
    });

    it("считает доверенным проект, который человек доверил сам", async () => {
      await writeConfig(`[projects."${root}"]\ntrust_level = "trusted"\n`);

      const plan = await planConnectTrust(source(), { root, version: VERSION });

      expect(plan.changes.map(({ kind }) => kind)).toEqual(["hooks"]);
    });

    it("падает до записи, если config.toml не TOML", async () => {
      await writeConfig("[broken");

      const act = planConnectTrust(source(), { root, version: VERSION });

      await expect(act).rejects.toBeInstanceOf(CodexError);
      expect(await readConfig()).toBe("[broken");
    });

    it("пишет через ссылку, а не заменяет её файлом", async () => {
      const real = path.join(sandbox, "dotfiles", "config.toml");

      await mkdir(path.dirname(real), { recursive: true });
      await writeFile(real, 'model = "gpt"\n');
      await mkdir(codexHome, { recursive: true });
      await symlink(real, configFile());

      const plan = await planConnectTrust(source(), { root, version: VERSION });

      await plan.apply();

      expect(await readFile(real, "utf8")).toContain("added by cyberzavod");
      expect(await readFile(real, "utf8")).toContain('model = "gpt"');
    });
  });

  describe("inspectTrust", () => {
    it("говорит, что проект не доверен, если config.toml нет", async () => {
      const inspection = await inspectTrust(source(), root);

      expect(inspection.kind).toBe("projectUntrusted");
    });

    it("говорит, что хуки не одобрены, и называет события", async () => {
      await writeConfig(`[projects."${root}"]\ntrust_level = "trusted"\n`);

      const inspection = await inspectTrust(source(), root);

      expect(inspection).toMatchObject({ kind: "hooksUntrusted" });
      expect(inspection.kind === "hooksUntrusted" ? inspection.events : []).toContain("Stop");
    });

    it("говорит, что всё доверено, после connect", async () => {
      await connect();

      const inspection = await inspectTrust(source(), root);

      expect(inspection.kind).toBe("trusted");
    });

    it("замечает, что хуки сменились и их хеши уже не одобрены", async () => {
      await connect();
      await writeHooks(NEXT_VERSION);

      const inspection = await inspectTrust(source(), root);

      expect(inspection.kind).toBe("hooksUntrusted");
    });

    it("отдаёт ошибку с текстом на двух языках, если config.toml не TOML", async () => {
      await writeConfig("[broken");

      const inspection = await inspectTrust(source(), root);

      expect(inspection.kind).toBe("unreadable");
      expect(
        inspection.kind === "unreadable" && inspection.error instanceof CodexError
          ? inspection.error.describe(CODEX_MESSAGES.ru)
          : "",
      ).toContain("не разобран как TOML");
    });

    it("отдаёт unreadable, если группа в .codex/hooks.json без обработчиков", async () => {
      await writeConfig("");
      await writeFile(path.join(root, HOOKS_FILE), '{"hooks":{"Stop":[{"matcher":"x"}]}}');

      const inspection = await inspectTrust(source(), root);

      expect(inspection.kind).toBe("unreadable");
    });

    it("отдаёт unreadable, если .codex/hooks.json не JSON", async () => {
      await writeConfig("");
      await writeFile(path.join(root, HOOKS_FILE), "{broken");

      const inspection = await inspectTrust(source(), root);

      expect(inspection.kind).toBe("unreadable");
    });

    it("отдаёт unreadable, если hooks в .codex/hooks.json не объект", async () => {
      await writeConfig("");
      await writeFile(path.join(root, HOOKS_FILE), '{"hooks":[]}');

      const inspection = await inspectTrust(source(), root);

      expect(inspection.kind).toBe("unreadable");
    });
  });

  describe("carryOverTrust", () => {
    it("переносит одобрение на новые хуки и убирает прежние", async () => {
      await connect();

      const result = await carryOverTrust(source(), root, async () => {
        await writeHooks(NEXT_VERSION);

        return "synced";
      });

      expect(result.value).toBe("synced");
      expect(result.change?.kind).toBe("hooks");
      expect((await inspectTrust(source(), root)).kind).toBe("trusted");
      expect((await readConfig()).match(/trusted_hash/g)).toHaveLength(9);
    });

    it("не одобряет хуки, одобрение которых человек снял", async () => {
      await connect();

      const withoutGuard = (await readConfig()).replace(
        /\[hooks\.state\.[^\]]*:pre_tool_use:0:0"\]\ntrusted_hash = "[^"]*"\n\n?/,
        "",
      );

      await writeConfig(withoutGuard);

      await carryOverTrust(source(), root, async () => {
        await writeHooks(NEXT_VERSION);
      });

      const inspection = await inspectTrust(source(), root);

      expect(inspection).toMatchObject({ kind: "hooksUntrusted", events: ["PreToolUse"] });
      expect((await readConfig()).match(/trusted_hash/g)).toHaveLength(8);
    });

    it("не выдаёт доверие, если прежние хуки не были одобрены", async () => {
      const result = await carryOverTrust(source(), root, async () => {
        await writeHooks(NEXT_VERSION);
      });

      expect(result.change).toBeUndefined();
      await expect(readFile(configFile(), "utf8")).rejects.toThrow();
    });

    it("ничего не пишет, если хуки не изменились", async () => {
      await connect();
      const before = await readConfig();

      const result = await carryOverTrust(source(), root, async () => undefined);

      expect(result.change).toBeUndefined();
      expect(await readConfig()).toBe(before);
    });

    it("не выдаёт доверие проекту", async () => {
      await writeConfig("");
      await connect();
      await writeConfig((await readConfig()).replace(/\[projects[^[]*/, ""));

      await carryOverTrust(source(), root, async () => {
        await writeHooks(NEXT_VERSION);
      });

      expect(parse(await readConfig())).not.toHaveProperty("projects");
    });
  });

  describe("planDisconnectTrust", () => {
    it("возвращает прежнее значение trust_level, которое заменил connect", async () => {
      const original = `[projects."${root}"]\ntrust_level = "untrusted"\n`;

      await writeConfig(original);
      await connect();
      const connected = await readConfig();

      const plan = await planDisconnectTrust(source(), root);

      await plan.apply();

      expect(connected).toContain('trust_level = "trusted" # added by cyberzavod, was "untrusted"');
      expect(await readConfig()).toBe(original);
    });

    it("возвращает config.toml байт в байт к виду до connect", async () => {
      const original = '# mine\nmodel = "gpt"\n';

      await writeConfig(original);
      await connect();

      const plan = await planDisconnectTrust(source(), root);

      await plan.apply();

      expect(plan.changes.map(({ kind }) => kind)).toEqual(["project", "hooks"]);
      expect(await readConfig()).toBe(original);
    });

    it("оставляет доверие проекту, которое человек дал сам, и называет его", async () => {
      await writeConfig(`[projects."${root}"]\ntrust_level = "trusted"\n`);
      await connect();

      const plan = await planDisconnectTrust(source(), root);

      await plan.apply();

      expect(plan.changes.map(({ kind }) => kind)).toEqual(["hooks"]);
      expect(plan.keptProjectTrustFile).toBe("~/.codex/config.toml");
      expect(parse(await readConfig()).projects).toEqual({ [root]: { trust_level: "trusted" } });
    });

    it("не пишет и не создаёт config.toml, если его не было", async () => {
      const plan = await planDisconnectTrust(source(), root);

      await plan.apply();

      expect(plan.changes).toEqual([]);
      await expect(readFile(configFile(), "utf8")).rejects.toThrow();
    });

    it("падает до записи, если config.toml не TOML", async () => {
      await writeConfig("[broken");

      const act = planDisconnectTrust(source(), root);

      await expect(act).rejects.toBeInstanceOf(CodexError);
    });
  });
});
