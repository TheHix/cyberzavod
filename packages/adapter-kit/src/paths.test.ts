import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { PROJECT_CONFIG_FILE } from "@cyberzavod/storage";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { KIT_MESSAGES } from "./messages/catalog.ts";
import { KitError } from "./errors.ts";
import { captureDirectories, locateProject, locatedFromPlanned, requireProject } from "./paths.ts";

let root: string;

async function writeConfig(journal: string): Promise<void> {
  const file = path.join(root, PROJECT_CONFIG_FILE);

  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(
    file,
    JSON.stringify({
      projectId: "lab",
      harness: "1.0.0",
      workflow: "default",
      journal,
      verification: { commands: [], paths: [] },
    }),
  );
}

describe("captureDirectories", () => {
  it("кладёт сырые журналы и черновики в каталог агента", () => {
    const directories = captureDirectories("/j", "codex");

    expect(directories).toEqual({
      raw: path.join("/j", "capture", "codex", "raw"),
      drafts: path.join("/j", "capture", "codex", "drafts"),
    });
  });
});

describe("locateProject и requireProject", () => {
  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), "cyberzavod-kit-paths-"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("находит проект из вложенного каталога и называет его журнал", async () => {
    await writeConfig("journal");
    await mkdir(path.join(root, "src/deep"), { recursive: true });

    const project = await locateProject(path.join(root, "src/deep"));

    expect(project?.config.projectId).toBe("lab");
    expect(project?.journal).toBe(path.join(project?.root ?? "", "journal"));
  });

  it("без проекта locateProject даёт undefined, а requireProject — ошибку с каталогом", async () => {
    const located = await locateProject(root);
    const act = () => requireProject(root);

    expect(located).toBeUndefined();
    await expect(act()).rejects.toBeInstanceOf(KitError);
    await expect(act()).rejects.toThrow(root);
  });

  it("описывает отсутствие проекта по-русски", async () => {
    const act = () => requireProject(root);

    const err = await act().then(
      () => undefined,
      (thrown: KitError) => thrown,
    );

    expect(err?.describe(KIT_MESSAGES.ru)).toContain(root);
  });
});

describe("locatedFromPlanned", () => {
  it("берёт журнал из конфига будущего проекта", () => {
    const located = locatedFromPlanned({
      root: "/p",
      config: {
        projectId: "lab",
        harness: "1.0.0",
        workflow: "default",
        journal: "j",
        agents: {},
        verification: { commands: [], paths: [] },
      },
    });

    expect(located.journal).toBe(path.join("/p", "j"));
  });
});
