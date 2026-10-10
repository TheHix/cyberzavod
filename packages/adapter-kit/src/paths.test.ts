import { mkdir, mkdtemp, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { PROJECT_CONFIG_FILE } from "@cyberzavod/storage";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KIT_MESSAGES } from "./messages/catalog.ts";
import { KitError } from "./errors.ts";
import {
  captureDirectories,
  findProjectId,
  locateProject,
  locatedFromPlanned,
  newestFile,
  requireProject,
} from "./paths.ts";

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

function configOf(projectId: string): string {
  return JSON.stringify({ projectId, harness: "0.1.0", workflow: "default", journal: "journal" });
}

async function writeConfigAt(directory: string, content: string): Promise<void> {
  await mkdir(path.join(directory, path.dirname(PROJECT_CONFIG_FILE)), { recursive: true });
  await writeFile(path.join(directory, PROJECT_CONFIG_FILE), content);
}

describe("findProjectId", () => {
  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), "cyberzavod-paths-"));
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(root, { recursive: true, force: true });
  });

  it("находит id проекта в самом каталоге", async () => {
    await writeConfigAt(root, configOf("lab"));

    const id = await findProjectId(root, KIT_MESSAGES.en);

    expect(id).toBe("lab");
  });

  it("поднимается из подкаталога до конфига", async () => {
    await writeConfigAt(root, configOf("lab"));
    const nested = path.join(root, "src", "state");

    await mkdir(nested, { recursive: true });

    const id = await findProjectId(nested, KIT_MESSAGES.en);

    expect(id).toBe("lab");
  });

  it("берёт ближайший конфиг", async () => {
    await writeConfigAt(root, configOf("outer"));
    const inner = path.join(root, "inner");

    await writeConfigAt(inner, configOf("inner"));

    const id = await findProjectId(inner, KIT_MESSAGES.en);

    expect(id).toBe("inner");
  });

  it("находит конфиг, когда каталога уже нет", async () => {
    await writeConfigAt(root, configOf("lab"));

    const id = await findProjectId(path.join(root, "removed", "deeper"), KIT_MESSAGES.en);

    expect(id).toBe("lab");
  });

  it("поднимается выше, когда на пути лежит файл, а не каталог", async () => {
    await writeConfigAt(root, configOf("lab"));
    await writeFile(path.join(root, "file.txt"), "");

    const id = await findProjectId(path.join(root, "file.txt", "inside"), KIT_MESSAGES.en);

    expect(id).toBe("lab");
  });

  it("возвращает undefined, когда конфига нет на всём пути", async () => {
    const id = await findProjectId(root, KIT_MESSAGES.en);

    expect(id).toBeUndefined();
  });

  it("предупреждает о битом конфиге и возвращает undefined", async () => {
    await writeConfigAt(root, "{ не json");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const id = await findProjectId(root, KIT_MESSAGES.en);

    expect([id, warn.mock.calls.length]).toEqual([undefined, 1]);
  });
});

describe("newestFile", () => {
  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), "cyberzavod-kit-newest-"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("берёт последний изменённый файл с нужным расширением", async () => {
    await writeFile(path.join(root, "old.jsonl"), "");
    await writeFile(path.join(root, "new.jsonl"), "");
    await writeFile(path.join(root, "newest.json"), "");
    await utimes(path.join(root, "old.jsonl"), new Date(1000), new Date(1000));
    await utimes(path.join(root, "new.jsonl"), new Date(2000), new Date(2000));
    await utimes(path.join(root, "newest.json"), new Date(3000), new Date(3000));

    const file = await newestFile(root, ".jsonl");

    expect(file).toBe(path.join(root, "new.jsonl"));
  });

  it("возвращает undefined, когда подходящих файлов нет", async () => {
    await writeFile(path.join(root, "draft.json"), "");

    const file = await newestFile(root, ".jsonl");

    expect(file).toBeUndefined();
  });

  it("возвращает undefined, когда каталога ещё нет", async () => {
    const file = await newestFile(path.join(root, "absent"), ".jsonl");

    expect(file).toBeUndefined();
  });
});
