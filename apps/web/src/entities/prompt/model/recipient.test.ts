import { describe, expect, it } from "vitest";
import type { PromptEvent } from "@cyberzavod/core";
import { recipientOf } from "./recipient.ts";

function promptTo(model?: string): PromptEvent {
  const prompt: PromptEvent = { t: 0, type: "prompt", goal: "Продолжай", requirements: [] };
  return model === undefined ? prompt : { ...prompt, model };
}

describe("recipientOf", () => {
  it("называет модель, получившую промпт", () => {
    const prompt = promptTo("claude-opus-5-5");

    const recipient = recipientOf(prompt);

    expect(recipient).toBe("Claude Opus 5.5");
  });

  it("пишет «агент», если модель неизвестна", () => {
    const prompt = promptTo();

    const recipient = recipientOf(prompt);

    expect(recipient).toBe("агент");
  });
});
