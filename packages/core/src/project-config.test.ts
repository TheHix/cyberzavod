import { describe, expect, it } from "vitest";
import { parseProjectConfig, ProjectConfigError } from "./project-config.ts";

function validConfig(): Record<string, unknown> {
  return {
    projectId: "lab",
    harness: "0.3.0",
    workflow: "default",
    journal: "../lab.cyberzavod",
    agents: { planning: { provider: "anthropic", agent: "claude", model: "default" } },
    verification: { commands: ["pnpm test", "pnpm lint"], paths: ["src"] },
    stack: { languages: ["typescript"], frameworks: ["react"], packageManager: "pnpm" },
  };
}

describe("parseProjectConfig", () => {
  it("принимает полный конфиг", () => {
    const raw = validConfig();

    const config = parseProjectConfig(raw);

    expect(config).toEqual(raw);
  });

  it("без agents и verification даёт пустые значения", () => {
    const raw = validConfig();
    delete raw.agents;
    delete raw.verification;
    delete raw.stack;

    const config = parseProjectConfig(raw);

    expect(config).toMatchObject({ agents: {}, verification: { commands: [], paths: [] } });
    expect(config.stack).toBeUndefined();
  });

  it.each([
    ["projectId с пробелом", { projectId: "my lab" }, /projectId/],
    ["без harness", { harness: undefined }, /harness/],
    ["без workflow", { workflow: "" }, /workflow/],
    ["без journal", { journal: undefined }, /journal/],
    ["агент неизвестного этапа", { agents: { deploy: {} } }, /неизвестный этап deploy/],
    ["агент с неверной моделью", { agents: { review: { model: 5 } } }, /agents\.review: model/],
    ["команды проверки не строками", { verification: { commands: [1] } }, /commands/],
    ["пути проверки не списком", { verification: { paths: "src" } }, /paths/],
    ["языки не списком", { stack: { languages: "ts", frameworks: [] } }, /languages/],
    ["пустой менеджер пакетов", { stack: { packageManager: "" } }, /packageManager/],
  ])("отклоняет конфиг: %s", (_name, override, message) => {
    const raw = { ...validConfig(), ...override };

    const act = () => parseProjectConfig(raw);

    expect(act).toThrow(message);
    expect(act).toThrow(ProjectConfigError);
  });
});
