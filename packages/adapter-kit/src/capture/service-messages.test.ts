import { describe, expect, it } from "vitest";
import { isHumanPrompt } from "./service-messages.ts";

describe("isHumanPrompt", () => {
  it("отличает сообщение человека от служебного", () => {
    const texts = ["Сделай цех", "[SYSTEM NOTIFICATION - NOT USER INPUT]", "<system-reminder>…"];

    const results = texts.map(isHumanPrompt);

    expect(results).toEqual([true, false, false]);
  });

  it("не принимает за человека причину отказа хука остановки и прерванный ход Codex", () => {
    const texts = [
      '<hook_prompt hook_run_id="stop:1">checks are red</hook_prompt>',
      "  <turn_aborted>\nThe user interrupted the previous turn.",
    ];

    const results = texts.map(isHumanPrompt);

    expect(results).toEqual([false, false]);
  });
});
