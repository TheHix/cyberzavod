import { describe, expect, it } from "vitest";
import type { PromptEvent } from "@cyberzavod/core";
import { recipientOf } from "./recipient.ts";

function promptTo(model?: string): PromptEvent {
  const prompt: PromptEvent = { t: 0, type: "prompt", goal: "Продолжай", requirements: [] };
  return model === undefined ? prompt : { ...prompt, model };
}

describe("recipientOf", () => {
  it.each(["ru", "en"] as const)("называет модель, получившую промпт, на языке %s", (locale) => {
    const prompt = promptTo("claude-opus-5-5");

    const recipient = recipientOf(prompt, locale);

    expect(recipient).toBe("Claude Opus 5.5");
  });

  it.each([
    ["ru", "агент"],
    ["en", "agent"],
  ] as const)("пишет слово «агент», если модель неизвестна, на языке %s", (locale, expected) => {
    const prompt = promptTo();

    const recipient = recipientOf(prompt, locale);

    expect(recipient).toBe(expected);
  });
});
