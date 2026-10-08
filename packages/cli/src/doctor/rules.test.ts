import { rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { RULES_TODO_MARK } from "@cyberzavod/core";
import { connectedProject, projectContext } from "./fixtures.ts";
import { rulesCheck } from "./rules.ts";

describe("rulesCheck", () => {
  it("принимает заполненный AGENTS.md", async () => {
    const project = await connectedProject();

    const result = await rulesCheck.run(await projectContext(project));

    expect(result).toEqual({ status: "passed", summary: "AGENTS.md is filled in" });
  });

  it("без корневого AGENTS.md просит создать его или запустить /setup", async () => {
    const project = await connectedProject();

    await rm(path.join(project.root, "AGENTS.md"));

    const result = await rulesCheck.run(await projectContext(project));

    expect(result).toEqual({
      status: "failed",
      problem: "AGENTS.md does not exist",
      fix: "create it or run /setup in Claude Code",
    });
  });

  it("с заглушкой заготовки просит запустить /setup", async () => {
    const project = await connectedProject();

    await writeFile(
      path.join(project.root, "AGENTS.md"),
      `# Rules\n\n- Tasks ${RULES_TODO_MARK}\n`,
    );

    const result = await rulesCheck.run(await projectContext(project));

    expect(result).toEqual({
      status: "failed",
      problem: "AGENTS.md still has starter placeholders",
      fix: "run /setup in Claude Code",
    });
  });
});
