import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it, onTestFinished } from "vitest";
import { parseProjectConfig, type ProjectConfig } from "@cyberzavod/core";
import { MARKER_DIRECTORY, PROJECT_CONFIG_FILE, writeProjectConfig } from "@cyberzavod/storage";
import { adapters } from "./fixtures.ts";
import { adapterAt, adapterFor, hostAgentOf } from "./host-agent.ts";

function configWith(agents: Record<string, { agent?: string; provider?: string }>): ProjectConfig {
  return parseProjectConfig({
    projectId: "shop",
    harness: "0.9.1",
    workflow: "default",
    journal: ".cyberzavod/journal",
    agents,
    verification: { commands: [], paths: [] },
  });
}

describe("hostAgentOf", () => {
  it("без агентов в конфиге возвращает агента по умолчанию", () => {
    const config = configWith({});

    expect(hostAgentOf(config)).toBe("claude");
  });

  it("берёт агента, которого назвали все этапы", () => {
    const config = configWith({
      implementation: { agent: "claude" },
      review: { agent: "claude" },
    });

    expect(hostAgentOf(config)).toBe("claude");
  });

  it("не считает этап без имени агента", () => {
    const config = configWith({ implementation: { provider: "anthropic" } });

    expect(hostAgentOf(config)).toBe("claude");
  });

  it("отклоняет неизвестного агента и перечисляет поддерживаемых", () => {
    const config = configWith({ implementation: { agent: "gemini" } });

    const act = () => hostAgentOf(config);

    expect(act).toThrow("the agent “gemini” is not supported: available are claude");
  });

  it("отклоняет смешанных агентов и называет их", () => {
    const config = configWith({
      implementation: { agent: "claude" },
      review: { agent: "gemini" },
    });

    const act = () => hostAgentOf(config);

    expect(act).toThrow(
      ".cyberzavod/project.json names several agents (claude, gemini): a project is driven by one agent",
    );
  });
});

describe("adapterFor", () => {
  it("возвращает адаптер агента проекта", () => {
    const config = configWith({ implementation: { agent: "claude" } });

    expect(adapterFor(config, adapters).name).toBe("claude");
  });
});

describe("adapterAt", () => {
  async function directory(): Promise<string> {
    const created = await mkdtemp(path.join(tmpdir(), "cyberzavod-host-agent-"));

    onTestFinished(() => rm(created, { recursive: true, force: true }));

    return created;
  }

  it("вне проекта возвращает адаптер по умолчанию", async () => {
    const adapter = await adapterAt(await directory(), adapters);

    expect(adapter.name).toBe("claude");
  });

  it("с неподходящим агентом в конфиге возвращает адаптер по умолчанию", async () => {
    const root = await directory();

    await writeProjectConfig(root, configWith({ implementation: { agent: "gemini" } }));

    const adapter = await adapterAt(root, adapters);

    expect(adapter.name).toBe("claude");
  });

  it("с нечитаемым конфигом возвращает адаптер по умолчанию", async () => {
    const root = await directory();

    await mkdir(path.join(root, MARKER_DIRECTORY));
    await writeFile(path.join(root, PROJECT_CONFIG_FILE), "{ not json");

    const adapter = await adapterAt(root, adapters);

    expect(adapter.name).toBe("claude");
  });
});
