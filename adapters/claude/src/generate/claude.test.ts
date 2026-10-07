import { describe, expect, it } from "vitest";
import { claudeModelOf, claudeToolsOf, GenerateError } from "./claude.ts";

describe("claudeModelOf", () => {
  it.each([
    ["planning", undefined, "opus"],
    ["implementation", { model: "default" }, "sonnet"],
    ["review", { provider: "anthropic", agent: "claude" }, "opus"],
    ["verification", { model: "haiku" }, "haiku"],
  ] as const)("этап %s с агентом %j работает на %s", (stage, agent, expected) => {
    const model = claudeModelOf(stage, agent);

    expect(model).toBe(expected);
  });

  it.each([{ provider: "openai" }, { agent: "codex" }])(
    "отклоняет агента, которого адаптер не ведёт: %j",
    (agent) => {
      const act = () => claudeModelOf("planning", agent);

      expect(act).toThrow(GenerateError);
    },
  );
});

describe("claudeToolsOf", () => {
  it("даёт роли только для чтения инструменты без правки", () => {
    const tools = claudeToolsOf("read");

    expect(tools).not.toMatch(/Edit|Write/);
  });
});
