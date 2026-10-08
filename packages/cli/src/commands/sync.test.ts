import { appendFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LEGACY_TOOL_FILE } from "@cyberzavod/storage";
import { confirmWithoutAsking } from "../confirmation.ts";
import {
  HARNESS_VERSION,
  readInstallation,
  type Installation,
} from "../installation/installation.ts";
import { CLI_MESSAGES } from "../messages/catalog.ts";
import { initProject } from "./init.ts";
import { requireProjectAt } from "./project.ts";
import { inspectProjectFiles } from "./sync.ts";

const messages = CLI_MESSAGES.en;

let root: string;
let installation: Installation;

describe("inspectProjectFiles", () => {
  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), "cyberzavod-sync-"));
    installation = await readInstallation();
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    await initProject(root, {
      confirm: confirmWithoutAsking,
      overrides: {},
      installation,
      messages,
    });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(root, { recursive: true, force: true });
  });

  it("на свежем проекте ничего не находит", async () => {
    const project = await requireProjectAt(root);

    const inspection = await inspectProjectFiles(project, installation);

    expect(inspection).toEqual({
      report: { changed: [], removed: [], conflicts: [] },
      configVersion: HARNESS_VERSION,
      isHarnessOutdated: false,
    });
  });

  it("находит устаревший файл, ничего не записывая", async () => {
    await appendFile(path.join(root, "CLAUDE.md"), "\nstale\n");
    const project = await requireProjectAt(root);

    const first = await inspectProjectFiles(project, installation);
    const second = await inspectProjectFiles(project, installation);

    expect({ changed: first.report.changed, again: second.report.changed }).toEqual({
      changed: ["CLAUDE.md"],
      again: ["CLAUDE.md"],
    });
  });

  it("называет файл человека конфликтом", async () => {
    await writeFile(path.join(root, "CLAUDE.md"), "# Mine\n");
    const project = await requireProjectAt(root);

    const inspection = await inspectProjectFiles(project, installation);

    expect(inspection.report.conflicts).toEqual(["CLAUDE.md"]);
  });

  it("находит прежний вшитый CLI как лишний файл", async () => {
    const legacyTool = path.join(root, ...LEGACY_TOOL_FILE.split("/"));

    await mkdir(path.dirname(legacyTool), { recursive: true });
    await writeFile(legacyTool, "// old");
    const project = await requireProjectAt(root);

    const inspection = await inspectProjectFiles(project, installation);

    expect(inspection.report.removed).toEqual([LEGACY_TOOL_FILE]);
  });

  it("отмечает версию harness в конфиге, которая отстала от CLI", async () => {
    const project = await requireProjectAt(root);
    const outdated = { ...project, config: { ...project.config, harness: "0.1.0" } };

    const inspection = await inspectProjectFiles(outdated, installation);

    expect({ version: inspection.configVersion, outdated: inspection.isHarnessOutdated }).toEqual({
      version: "0.1.0",
      outdated: true,
    });
  });
});
