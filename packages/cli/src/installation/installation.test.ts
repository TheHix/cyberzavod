import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { HARNESS_VERSION, readInstallation } from "./installation.ts";

const PACKAGE_MANIFEST = path.resolve(import.meta.dirname, "../../package.json");

describe("HARNESS_VERSION", () => {
  it("совпадает с версией npm-пакета", async () => {
    const manifest = JSON.parse(await readFile(PACKAGE_MANIFEST, "utf8")) as { version: string };

    expect(HARNESS_VERSION).toBe(manifest.version);
  });
});

describe("readInstallation", () => {
  it("из исходников читает harness и шаблоны", async () => {
    const installation = await readInstallation();

    expect({
      workflows: installation.harness.workflows.map((workflow) => workflow.name),
      rules: installation.rulesTemplate.length > 0,
    }).toEqual({ workflows: ["default"], rules: true });
  });

  it("читает шаблон скилла /setup", async () => {
    const installation = await readInstallation();

    expect(installation.claudeTemplates.setup.length).toBeGreaterThan(0);
  });

  it("читает шаблон скилла $setup для Codex", async () => {
    const installation = await readInstallation();

    expect(installation.codexTemplates.setup.length).toBeGreaterThan(0);
  });
});
