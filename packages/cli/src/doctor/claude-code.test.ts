import { describe, expect, it } from "vitest";
import { CLI_MESSAGES } from "../messages/catalog.ts";
import { claudeCodeCheck } from "./claude-code.ts";
import { machine } from "./fixtures.ts";

const messages = CLI_MESSAGES.en;

describe("claudeCodeCheck", () => {
  it("проходит, если программа claude найдена", async () => {
    const found = machine({ isProgramAvailable: async (name) => name === "claude" });

    const result = await claudeCodeCheck.run(found, messages);

    expect(result.status).toBe("passed");
  });

  it("без программы claude даёт заметку, а не ошибку", async () => {
    const missing = machine({ isProgramAvailable: async () => false });

    const result = await claudeCodeCheck.run(missing, messages);

    expect(result.status).toBe("notice");
  });
});
