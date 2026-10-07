import { describe, expect, it } from "vitest";
import {
  ADAPTER_DENY,
  adapterHooks,
  mergeSettings,
  SettingsError,
  withHome,
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
              command: 'node "$CLAUDE_PROJECT_DIR/adapters/claude/src/bin/record.ts"',
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

describe("adapterHooks", () => {
  it("внутри проекта ведёт хуки от CLAUDE_PROJECT_DIR", () => {
    const hooks = adapterHooks({ in: "project", path: "tools/cyberzavod" });

    expect(commandsOf(hooks.Stop)).toEqual([
      'node "$CLAUDE_PROJECT_DIR/tools/cyberzavod/adapters/claude/src/bin/record.ts"',
      '"$CLAUDE_PROJECT_DIR/tools/cyberzavod/adapters/claude/hooks/stop-gate.sh"',
    ]);
  });

  it("вне проекта ведёт хуки от CYBERZAVOD_HOME и молчит без него", () => {
    const hooks = adapterHooks({ in: "home" });

    expect(commandsOf(hooks.UserPromptSubmit)).toEqual([
      '[ -z "$CYBERZAVOD_HOME" ] || node "$CYBERZAVOD_HOME/adapters/claude/src/bin/record.ts"',
      '[ -z "$CYBERZAVOD_HOME" ] || "$CYBERZAVOD_HOME/adapters/claude/hooks/turn-start.sh"',
    ]);
  });
});

describe("mergeSettings", () => {
  it("заменяет прежние обработчики адаптера и оставляет чужие", () => {
    const settings = projectHooks();

    const merged = mergeSettings(settings, adapterHooks({ in: "project", path: "" }));

    expect(commandsOf((merged.hooks as Record<string, unknown>).SessionStart)).toEqual([
      "./setup.sh",
      'node "$CLAUDE_PROJECT_DIR/adapters/claude/src/bin/record.ts"',
    ]);
  });

  it("не трогает события и настройки, о которых адаптер не знает", () => {
    const settings = projectHooks();

    const merged = mergeSettings(settings, adapterHooks({ in: "project", path: "" }));

    expect({
      effortLevel: merged.effortLevel,
      preToolUse: commandsOf((merged.hooks as Record<string, unknown>).PreToolUse),
    }).toEqual({ effortLevel: "high", preToolUse: ["./guard.sh"] });
  });

  it("дописывает запреты адаптера к запретам проекта без повторов", () => {
    const settings = projectHooks();

    const twice = mergeSettings(
      mergeSettings(settings, adapterHooks({ in: "home" })),
      adapterHooks({ in: "home" }),
    );

    expect(twice.permissions).toEqual({
      allow: ["Bash(ls)"],
      deny: ["Read(**/secret)", ...ADAPTER_DENY],
    });
  });

  it("создаёт настройки с нуля", () => {
    const merged = mergeSettings({}, adapterHooks({ in: "home" }));

    expect(Object.keys(merged.hooks as object)).toContain("Stop");
  });

  it.each([
    ["hooks не объект", { hooks: [] }],
    ["группа без обработчиков", { hooks: { Stop: [{ matcher: "x" }] } }],
    ["deny не список", { permissions: { deny: "Read(.env)" } }],
  ])("отклоняет настройки: %s", (_name, settings) => {
    const act = () => mergeSettings(settings, adapterHooks({ in: "home" }));

    expect(act).toThrow(SettingsError);
  });
});

describe("withHome", () => {
  it("добавляет путь установки к прочим переменным", () => {
    const settings = { env: { OTHER: "1" }, model: "x" };

    const local = withHome(settings, "/opt/cyberzavod");

    expect(local).toEqual({ env: { OTHER: "1", CYBERZAVOD_HOME: "/opt/cyberzavod" }, model: "x" });
  });
});
