import { describe, expect, it } from "vitest";
import { AgentConfigError, parseAgentConfig } from "./agent.ts";

describe("parseAgentConfig", () => {
  it("принимает провайдера, агента и модель", () => {
    const raw = { provider: "anthropic", agent: "claude", model: "default" };

    const config = parseAgentConfig(raw);

    expect(config).toEqual(raw);
  });

  it("не добавляет отсутствующие поля", () => {
    const config = parseAgentConfig({ agent: "claude" });

    expect(config).toEqual({ agent: "claude" });
  });

  it.each([
    ["не объект", "claude", /object/],
    ["пустая модель", { model: "" }, /model/],
    ["провайдер не строкой", { provider: 1 }, /provider/],
  ])("отклоняет агента: %s", (_name, raw, message) => {
    const act = () => parseAgentConfig(raw);

    expect(act).toThrow(message);
    expect(act).toThrow(AgentConfigError);
  });
});
