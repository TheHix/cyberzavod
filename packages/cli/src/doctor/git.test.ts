import { describe, expect, it } from "vitest";
import { gitCheck } from "./git.ts";
import { machine, messages } from "./fixtures.ts";

describe("gitCheck", () => {
  it("находит git в PATH", async () => {
    const lookedUp: string[] = [];
    const found = machine({
      isProgramAvailable: async (name) => {
        lookedUp.push(name);

        return true;
      },
    });

    const result = await gitCheck.run(found, messages);

    expect({ result, lookedUp }).toEqual({
      result: { status: "passed", summary: "git is installed" },
      lookedUp: ["git"],
    });
  });

  it("просит поставить git, если его нет", async () => {
    const withoutGit = machine({ isProgramAvailable: async () => false });

    const result = await gitCheck.run(withoutGit, messages);

    expect(result).toEqual({
      status: "failed",
      problem: "git was not found in PATH",
      fix: "install git and make sure it is in PATH",
    });
  });
});
