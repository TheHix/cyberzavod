import { rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { writeProjectConfig } from "@cyberzavod/storage";
import { connectedProject, projectAt, projectContext } from "./fixtures.ts";
import { gitignoreCheck } from "./gitignore.ts";

const ENTRY = "/.cyberzavod/journal/capture/";

describe("gitignoreCheck", () => {
  it("находит строку, которую дописал init", async () => {
    const project = await connectedProject();

    const result = await gitignoreCheck.run(await projectContext(project));

    expect(result).toEqual({ status: "passed", summary: `.gitignore ignores ${ENTRY}` });
  });

  it("без строки просит дописать её", async () => {
    const project = await connectedProject();

    await rm(path.join(project.root, ".gitignore"));

    const result = await gitignoreCheck.run(await projectContext(project));

    expect(result).toEqual({
      status: "failed",
      problem: `.gitignore has no line ${ENTRY}: raw session logs may get committed`,
      fix: `add the line ${ENTRY} to .gitignore`,
    });
  });

  it("не принимает похожую строку за точную", async () => {
    const project = await connectedProject();

    await writeFile(path.join(project.root, ".gitignore"), ".cyberzavod/journal/capture/\n");

    const result = await gitignoreCheck.run(await projectContext(project));

    expect(result.status).toBe("failed");
  });

  it("не требует строки, если журнал вне проекта", async () => {
    const project = await connectedProject();

    await writeProjectConfig(project.root, { ...project.config, journal: "../shop.cyberzavod" });

    const result = await gitignoreCheck.run(await projectContext(await projectAt(project.root)));

    expect(result).toEqual({
      status: "passed",
      summary: "the journal is outside the project: nothing to ignore",
    });
  });
});
