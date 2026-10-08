import { spawnSync } from "node:child_process";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ADAPTER_DENY,
  adapterHooks,
  mergeSettings,
  SettingsError,
  type HookGroup,
  type Settings,
} from "./settings.ts";

const VERSION = "1.2.3";
const NPX_PREFIX =
  'npx -y --prefer-offline --fetch-retries=0 --prefix "$CLAUDE_PROJECT_DIR" cyberzavod@1.2.3';
const STOP_FAILURE_MESSAGE =
  "Cyberzavod: the stop hook failed or could not start (for example, npx without network). Project checks were skipped.";
const LEGACY_RECORD_COMMAND =
  'node "$CLAUDE_PROJECT_DIR/.cyberzavod/bin/cyberzavod.mjs" hook record';

function projectHooks(): Settings {
  return {
    effortLevel: "high",
    permissions: { allow: ["Bash(ls)"], deny: ["Read(**/secret)"] },
    hooks: {
      SessionStart: [
        {
          hooks: [
            {
              type: "command",
              command: LEGACY_RECORD_COMMAND,
            },
          ],
        },
        { matcher: "startup", hooks: [{ type: "command", command: "./setup.sh" }] },
      ],
      PreToolUse: [{ hooks: [{ type: "command", command: "./guard.sh" }] }],
    },
  };
}

function commandsOf(groups: unknown): string[] {
  return (groups as HookGroup[]).flatMap((group) => group.hooks.map(({ command }) => command));
}

function hookCommand(event: string, hookName: string): string {
  const command = commandsOf(adapterHooks(VERSION)[event]).find((candidate) =>
    candidate.includes(` hook ${hookName} `),
  );

  if (command === undefined) throw new Error(`нет обработчика ${hookName} у события ${event}`);

  return command;
}

describe("adapterHooks", () => {
  it("запускают пакет через npx той версии, что в конфиге, с запасным путём", () => {
    const stop = adapterHooks(VERSION).Stop;

    expect(commandsOf(stop)).toEqual([
      `${NPX_PREFIX} hook record || true`,
      `${NPX_PREFIX} hook stop || echo '${JSON.stringify({ systemMessage: STOP_FAILURE_MESSAGE })}'`,
    ]);
  });

  it("берут версию из аргумента", () => {
    const turnStart = adapterHooks("0.9.0").UserPromptSubmit;

    expect(commandsOf(turnStart)[1]).toContain("cyberzavod@0.9.0 hook turn-start");
  });

  describe("запасной путь без сети", () => {
    let workspace: string;

    async function fakeNpx(body: string): Promise<void> {
      const file = path.join(workspace, "npx");

      await writeFile(file, `#!/bin/sh\n${body}\n`);
      await chmod(file, 0o755);
    }

    function run(command: string) {
      return spawnSync("sh", ["-c", command], {
        encoding: "utf8",
        env: { PATH: `${workspace}:${process.env.PATH ?? ""}`, CLAUDE_PROJECT_DIR: workspace },
      });
    }

    beforeEach(async () => {
      workspace = await mkdtemp(path.join(tmpdir(), "cyberzavod-hooks-"));
    });

    afterEach(async () => {
      await rm(workspace, { recursive: true, force: true });
    });

    it("остановка отпускает агента с сообщением человеку", async () => {
      await fakeNpx("exit 1");

      const result = run(hookCommand("Stop", "stop"));

      expect({ status: result.status, stdout: JSON.parse(result.stdout) as unknown }).toEqual({
        status: 0,
        stdout: { systemMessage: STOP_FAILURE_MESSAGE },
      });
    });

    it.each([
      ["record", "SessionStart"],
      ["turn-start", "UserPromptSubmit"],
    ])("хук %s молча пропускается", async (hookName, event) => {
      await fakeNpx("exit 1");

      const result = run(hookCommand(event, hookName));

      expect({ status: result.status, stdout: result.stdout }).toEqual({ status: 0, stdout: "" });
    });

    it("решение остановки без изменений проходит наружу", async () => {
      const decision = '{"decision":"block","reason":"r"}';

      await fakeNpx(`echo '${decision}'`);

      const result = run(hookCommand("Stop", "stop"));

      expect({ status: result.status, stdout: result.stdout }).toEqual({
        status: 0,
        stdout: `${decision}\n`,
      });
    });
  });
});

describe("mergeSettings", () => {
  it("заменяет прежние обработчики адаптера и оставляет чужие", () => {
    const settings = projectHooks();

    const merged = mergeSettings(settings, adapterHooks(VERSION));

    expect(commandsOf((merged.hooks as Record<string, unknown>).SessionStart)).toEqual([
      "./setup.sh",
      `${NPX_PREFIX} hook record || true`,
    ]);
  });

  it("заменяет обработчик другой версии без дублей", () => {
    const olderHooks = adapterHooks("1.0.0");
    const olderSettings = mergeSettings(projectHooks(), olderHooks);

    const merged = mergeSettings(olderSettings, adapterHooks(VERSION));

    expect(commandsOf((merged.hooks as Record<string, unknown>).Stop)).toEqual([
      `${NPX_PREFIX} hook record || true`,
      expect.stringContaining(`${NPX_PREFIX} hook stop`),
    ]);
  });

  it("заменяет обработчик с другими флагами npx без дубля", () => {
    const settings: Settings = {
      hooks: {
        Stop: [
          {
            hooks: [
              {
                type: "command",
                command: "npx -y --prefix . cyberzavod@0.9.0 hook record || true",
              },
            ],
          },
        ],
      },
    };

    const merged = mergeSettings(settings, adapterHooks(VERSION));

    expect(commandsOf((merged.hooks as Record<string, unknown>).Stop)).toEqual([
      `${NPX_PREFIX} hook record || true`,
      expect.stringContaining(`${NPX_PREFIX} hook stop`),
    ]);
  });

  it("не трогает события и настройки, о которых адаптер не знает", () => {
    const settings = projectHooks();

    const merged = mergeSettings(settings, adapterHooks(VERSION));

    expect({
      effortLevel: merged.effortLevel,
      preToolUse: commandsOf((merged.hooks as Record<string, unknown>).PreToolUse),
    }).toEqual({ effortLevel: "high", preToolUse: ["./guard.sh"] });
  });

  it("дописывает запреты адаптера к запретам проекта без повторов", () => {
    const settings = projectHooks();

    const twice = mergeSettings(
      mergeSettings(settings, adapterHooks(VERSION)),
      adapterHooks(VERSION),
    );

    expect(twice.permissions).toEqual({
      allow: ["Bash(ls)"],
      deny: ["Read(**/secret)", ...ADAPTER_DENY],
    });
  });

  it("создаёт настройки с нуля", () => {
    const merged = mergeSettings({}, adapterHooks(VERSION));

    expect(Object.keys(merged.hooks as object)).toContain("Stop");
  });

  it.each([
    ["hooks не объект", { hooks: [] }],
    ["группа без обработчиков", { hooks: { Stop: [{ matcher: "x" }] } }],
    ["deny не список", { permissions: { deny: "Read(.env)" } }],
  ])("отклоняет настройки: %s", (_name, settings) => {
    const act = () => mergeSettings(settings, adapterHooks(VERSION));

    expect(act).toThrow(SettingsError);
  });
});
