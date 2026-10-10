import { mkdir, mkdtemp, readFile, rm, writeFile, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { KitError } from "../errors.ts";
import {
  applySyncPlan,
  generatedCandidates,
  ownershipOf,
  planSyncFiles,
  removeEmptyParents,
  removeGeneratedFiles,
  requireWritable,
} from "./file-plan.ts";
import { EMPTY_MANIFEST, contentHash } from "./manifest.ts";
import { GENERATED_MARK } from "./marks.ts";

let root: string;

async function write(relative: string, content: string): Promise<void> {
  const file = path.join(root, relative);

  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, content);
}

async function exists(relative: string): Promise<boolean> {
  return access(path.join(root, relative)).then(
    () => true,
    () => false,
  );
}

function source(files: { path: string; content: string }[], overrides = {}) {
  return {
    root,
    files,
    manifest: EMPTY_MANIFEST,
    force: false,
    sharedFiles: new Set<string>(),
    candidates: [],
    ...overrides,
  };
}

describe("ownershipOf", () => {
  it("различает отсутствие, нетронутый, исправленный, помеченный и чужой файл", () => {
    const manifest = { files: { "a.md": contentHash("generated") }, deny: [] };

    expect([
      ownershipOf("a.md", undefined, manifest),
      ownershipOf("a.md", "generated", manifest),
      ownershipOf("a.md", "changed", manifest),
      ownershipOf("b.md", `# ${GENERATED_MARK}`, manifest),
      ownershipOf("b.md", "mine", manifest),
    ]).toEqual(["missing", "generated", "edited", "generated", "human"]);
  });
});

describe("файлы на диске", () => {
  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), "cyberzavod-kit-plan-"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  describe("planSyncFiles", () => {
    it("называет новый файл добавленным, а совпадающий — не называет", async () => {
      await write("same.md", "same");

      const plan = await planSyncFiles(
        source([
          { path: "same.md", content: "same" },
          { path: "new.md", content: "new" },
        ]),
      );

      expect(plan.report.added).toEqual(["new.md"]);
      expect(plan.report.updated).toEqual([]);
    });

    it("называет файл человека конфликтом, а с force — обновлением", async () => {
      await write("mine.md", "mine");
      const files = [{ path: "mine.md", content: "generated" }];

      const plain = await planSyncFiles(source(files));
      const forced = await planSyncFiles(source(files, { force: true }));

      expect(plain.report.conflicts).toEqual(["mine.md"]);
      expect(forced.report.updated).toEqual(["mine.md"]);
    });

    it("считает общий файл, который уже есть, своим для записи", async () => {
      await write("hooks.json", "{}");

      const plan = await planSyncFiles(
        source([{ path: "hooks.json", content: "{\n}" }], { sharedFiles: new Set(["hooks.json"]) }),
      );

      expect(plan.report.updated).toEqual(["hooks.json"]);
      expect(plan.report.conflicts).toEqual([]);
    });

    it("предлагает удалить сгенерированный файл, который больше не нужен, и не трогает чужой", async () => {
      await write("old.md", `# ${GENERATED_MARK}`);
      await write("mine.md", "mine");

      const plan = await planSyncFiles(source([], { candidates: ["old.md", "mine.md"] }));

      expect(plan.report.removed).toEqual(["old.md"]);
    });

    it("называет исправленный руками файл отдельно", async () => {
      await write("edited.md", "changed");
      const manifest = { files: { "edited.md": contentHash("original") }, deny: [] };

      const plan = await planSyncFiles(
        source([{ path: "edited.md", content: "new" }], { manifest }),
      );

      expect(plan.report.edited).toEqual(["edited.md"]);
    });
  });

  describe("requireWritable", () => {
    it("перечисляет конфликты и исправленные файлы в ошибке", () => {
      const report = { added: [], updated: [], removed: [], conflicts: ["a"], edited: ["b"] };

      const act = () => requireWritable(report);

      expect(act).toThrow(KitError);
      expect(act).toThrow("a, b");
    });
  });

  describe("applySyncPlan", () => {
    it("пишет новое и обновлённое, создавая каталоги, и удаляет лишнее", async () => {
      await write("old.md", `# ${GENERATED_MARK}`);

      const plan = await planSyncFiles(
        source([{ path: "deep/new.md", content: "new" }], { candidates: ["old.md"] }),
      );

      await applySyncPlan(root, plan);

      expect(await readFile(path.join(root, "deep/new.md"), "utf8")).toBe("new");
      expect(await exists("old.md")).toBe(false);
    });

    it("не пишет ничего, если в плане есть конфликт", async () => {
      await write("mine.md", "mine");

      const plan = await planSyncFiles(
        source([
          { path: "mine.md", content: "generated" },
          { path: "new.md", content: "new" },
        ]),
      );

      const act = applySyncPlan(root, plan);

      await expect(act).rejects.toBeInstanceOf(KitError);
      expect(await exists("new.md")).toBe(false);
    });
  });

  describe("generatedCandidates", () => {
    it("собирает файлы каталогов агента, дополнительные и записанные в манифесте", async () => {
      await write(".agent/roles/a.toml", "");
      await write(".agent/roles/readme.txt", "");

      const found = await generatedCandidates(
        root,
        { files: { "from-manifest.md": "x" }, deny: [] },
        [{ directory: ".agent/roles", extensions: [".toml"] }],
        ["extra.toml"],
      );

      expect(found.sort()).toEqual([".agent/roles/a.toml", "extra.toml", "from-manifest.md"]);
    });

    it("не падает, если каталога агента нет", async () => {
      const found = await generatedCandidates(
        root,
        EMPTY_MANIFEST,
        [{ directory: "none", extensions: [".md"] }],
        [],
      );

      expect(found).toEqual([]);
    });
  });

  describe("removeEmptyParents и removeGeneratedFiles", () => {
    it("убирает опустевшие каталоги до границы, но не саму границу выше", async () => {
      await write(".agent/a/b/file.md", "x");

      await removeGeneratedFiles(root, [".agent/a/b/file.md"], [".agent"]);

      expect(await exists(".agent")).toBe(false);
    });

    it("оставляет каталог, где ещё что-то лежит", async () => {
      await write(".agent/a/file.md", "x");
      await write(".agent/other.md", "y");

      await removeGeneratedFiles(root, [".agent/a/file.md"], [".agent"]);

      expect(await exists(".agent/a")).toBe(false);
      expect(await exists(".agent/other.md")).toBe(true);
    });

    it("не поднимается выше границ", async () => {
      await write("outside/file.md", "x");
      await rm(path.join(root, "outside/file.md"));

      await removeEmptyParents(root, path.join(root, "outside/file.md"), [".agent"]);

      expect(await exists("outside")).toBe(true);
    });
  });
});
