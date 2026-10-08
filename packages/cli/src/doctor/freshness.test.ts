import { appendFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { writeProjectConfig } from "@cyberzavod/storage";
import { connectedProject, projectAt, projectContext } from "./fixtures.ts";
import { freshnessCheck } from "./freshness.ts";

describe("freshnessCheck", () => {
  it("принимает свежие файлы агента", async () => {
    const project = await connectedProject();

    const result = await freshnessCheck.run(await projectContext(project));

    expect(result).toEqual({ status: "passed", summary: "agent files are up to date" });
  });

  it("считает устаревшие файлы и зовёт sync", async () => {
    const project = await connectedProject();

    await appendFile(path.join(project.root, "CLAUDE.md"), "\nstale\n");

    const result = await freshnessCheck.run(await projectContext(project));

    expect(result).toEqual({
      status: "failed",
      problem: "agent files are outdated or extra: 1",
      fix: "run npx cyberzavod sync (npx cyberzavod sync --check lists the files)",
    });
  });

  it("при расхождении версий говорит только о них", async () => {
    const project = await connectedProject();

    await writeProjectConfig(project.root, { ...project.config, harness: "0.1.0" });
    await appendFile(path.join(project.root, "CLAUDE.md"), "\nstale\n");

    const result = await freshnessCheck.run(await projectContext(await projectAt(project.root)));

    expect(result).toMatchObject({
      status: "failed",
      problem: expect.stringMatching(
        /^\.cyberzavod[\\/]project\.json says harness 0\.1\.0, but this CLI is /,
      ) as string,
      fix: "run npx cyberzavod sync, or run npx cyberzavod@0.1.0 doctor",
    });
  });

  it("называет файл, написанный человеком, и зовёт перенести правки в AGENTS.md", async () => {
    const project = await connectedProject();

    await writeFile(path.join(project.root, "CLAUDE.md"), "# My own rules\n");

    const result = await freshnessCheck.run(await projectContext(project));

    expect(result).toEqual({
      status: "failed",
      problem: "agent files written by a human: CLAUDE.md",
      fix: "move your edits to AGENTS.md and run npx cyberzavod sync --force",
    });
  });

  it("называет причину, если файлы агента не собрать", async () => {
    const project = await connectedProject();

    await writeFile(path.join(project.root, ".claude/settings.json"), "{ not json");

    const result = await freshnessCheck.run(await projectContext(project));

    expect(result).toMatchObject({
      status: "failed",
      problem: expect.stringMatching(/^agent files cannot be checked: /) as string,
      fix: "remove the cause above and run npx cyberzavod sync --check",
    });
  });

  it("не падает на настройках с hooks не того вида", async () => {
    const project = await connectedProject();

    await writeFile(path.join(project.root, ".claude/settings.json"), '{"hooks": []}');

    const result = await freshnessCheck.run(await projectContext(project));

    expect(result).toEqual({
      status: "failed",
      problem: "agent files cannot be checked: hooks должен быть объектом",
      fix: "remove the cause above and run npx cyberzavod sync --check",
    });
  });
});
