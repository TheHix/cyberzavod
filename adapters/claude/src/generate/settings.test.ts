import { describe, expect, it } from "vitest";
import {
  ADAPTER_DENY,
  ADAPTER_HOOKS,
  mergeSettings,
  SettingsError,
  type HookGroup,
  type Settings,
} from "./settings.ts";

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
              command: 'node "$CLAUDE_PROJECT_DIR/.cyberzavod/bin/cyberzavod.mjs" hook record',
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

describe("ADAPTER_HOOKS", () => {
  it("зовут CLI из проекта от CLAUDE_PROJECT_DIR", () => {
    const stop = ADAPTER_HOOKS.Stop;

    expect(commandsOf(stop)).toEqual([
      'node "$CLAUDE_PROJECT_DIR/.cyberzavod/bin/cyberzavod.mjs" hook record',
      'node "$CLAUDE_PROJECT_DIR/.cyberzavod/bin/cyberzavod.mjs" hook stop',
    ]);
  });
});

describe("mergeSettings", () => {
  it("заменяет прежние обработчики адаптера и оставляет чужие", () => {
    const settings = projectHooks();

    const merged = mergeSettings(settings, ADAPTER_HOOKS);

    expect(commandsOf((merged.hooks as Record<string, unknown>).SessionStart)).toEqual([
      "./setup.sh",
      'node "$CLAUDE_PROJECT_DIR/.cyberzavod/bin/cyberzavod.mjs" hook record',
    ]);
  });

  it("не трогает события и настройки, о которых адаптер не знает", () => {
    const settings = projectHooks();

    const merged = mergeSettings(settings, ADAPTER_HOOKS);

    expect({
      effortLevel: merged.effortLevel,
      preToolUse: commandsOf((merged.hooks as Record<string, unknown>).PreToolUse),
    }).toEqual({ effortLevel: "high", preToolUse: ["./guard.sh"] });
  });

  it("дописывает запреты адаптера к запретам проекта без повторов", () => {
    const settings = projectHooks();

    const twice = mergeSettings(mergeSettings(settings, ADAPTER_HOOKS), ADAPTER_HOOKS);

    expect(twice.permissions).toEqual({
      allow: ["Bash(ls)"],
      deny: ["Read(**/secret)", ...ADAPTER_DENY],
    });
  });

  it("создаёт настройки с нуля", () => {
    const merged = mergeSettings({}, ADAPTER_HOOKS);

    expect(Object.keys(merged.hooks as object)).toContain("Stop");
  });

  it.each([
    ["hooks не объект", { hooks: [] }],
    ["группа без обработчиков", { hooks: { Stop: [{ matcher: "x" }] } }],
    ["deny не список", { permissions: { deny: "Read(.env)" } }],
  ])("отклоняет настройки: %s", (_name, settings) => {
    const act = () => mergeSettings(settings, ADAPTER_HOOKS);

    expect(act).toThrow(SettingsError);
  });
});
