import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadHarness, PROJECT_CONFIG_FILE } from "@cyberzavod/storage";
import { ClaudeError } from "../errors.ts";
import { CLAUDE_MESSAGES } from "../messages/catalog.ts";
import { GENERATED_MARK, LEGACY_GENERATED_MARK } from "./files.ts";
import { syncClaude, type ClaudeInstallation, type SyncOptions } from "./sync.ts";

const REPOSITORY = path.resolve(import.meta.dirname, "../../../..");
const TEMPLATES = path.join(REPOSITORY, "adapters/claude/templates");

let root: string;

async function writeProjectFile(relative: string, content: string): Promise<void> {
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

async function newProject(): Promise<void> {
  const config = {
    projectId: "lab",
    harness: "0.3.0",
    workflow: "default",
    journal: ".cyberzavod/journal",
    verification: { commands: ["npm test"], paths: [] },
  };

  await writeProjectFile(PROJECT_CONFIG_FILE, JSON.stringify(config));
  await writeProjectFile("AGENTS.md", "# Правила\n");
  await writeProjectFile("src/AGENTS.md", "# Правила src\n");
}

async function installation(): Promise<ClaudeInstallation> {
  return {
    harness: await loadHarness(path.join(REPOSITORY, "harness")),
    templates: {
      publishRecording: await readFile(path.join(TEMPLATES, "publish-recording.md"), "utf8"),
      recordingEditor: await readFile(path.join(TEMPLATES, "recording-editor.md"), "utf8"),
    },
  };
}

async function sync(mode: Pick<SyncOptions, "check" | "force"> = {}) {
  return syncClaude({ projectDirectory: root, installation: await installation(), ...mode });
}

describe("syncClaude", () => {
  beforeEach(async () => {
    root = path.join(await mkdtemp(path.join(tmpdir(), "cyberzavod-sync-")), "lab");
    await newProject();
  });

  afterEach(async () => {
    await rm(path.dirname(root), { recursive: true, force: true });
  });

  it("пишет CLAUDE.md рядом с каждым AGENTS.md, агентов и хуки", async () => {
    const report = await sync();

    const settings = await readFile(path.join(root, ".claude/settings.json"), "utf8");

    expect({
      changed: report.changed.includes("src/CLAUDE.md"),
      agent: await exists(".claude/agents/coder.md"),
      hook: settings.includes("cyberzavod@0.3.0 hook record"),
    }).toEqual({ changed: true, agent: true, hook: true });
  });

  it("зовёт в текстах CLI той версии, что в конфиге", async () => {
    await sync();

    const skill = await readFile(
      path.join(root, ".claude/skills/publish-recording/SKILL.md"),
      "utf8",
    );

    expect(skill).toContain("`npx cyberzavod@0.3.0 draft`");
  });

  it("в режиме проверки ничего не пишет и называет устаревшие файлы", async () => {
    const report = await sync({ check: true });

    expect({ claudeMd: await exists("CLAUDE.md"), changed: report.changed.length > 0 }).toEqual({
      claudeMd: false,
      changed: true,
    });
  });

  it("после синхронизации проверка не находит расхождений", async () => {
    await sync();

    const report = await sync({ check: true });

    expect(report).toEqual({ changed: [], removed: [], conflicts: [] });
  });

  it("не пишет поверх файла человека и не меняет ничего", async () => {
    await writeProjectFile("CLAUDE.md", "Мои правила\n");

    const act = () => sync();
    const error = await act().then(
      () => undefined,
      (err: unknown) => err,
    );

    expect(error).toBeInstanceOf(ClaudeError);
    expect((error as ClaudeError).describe(CLAUDE_MESSAGES.en)).toMatch(/CLAUDE\.md/);
    expect(await exists(".claude/settings.json")).toBe(false);
  });

  it("с force пишет поверх файла человека", async () => {
    await writeProjectFile("CLAUDE.md", "Мои правила\n");

    await sync({ force: true });

    expect(await readFile(path.join(root, "CLAUDE.md"), "utf8")).toContain(GENERATED_MARK);
  });

  it("удаляет сгенерированный раньше файл, который больше не нужен", async () => {
    await writeProjectFile(".claude/agents/old-role.md", `<!-- ${GENERATED_MARK} -->\n`);
    await writeProjectFile(".claude/agents/mine.md", "Мой агент\n");

    const report = await sync();

    expect({
      removed: report.removed,
      old: await exists(".claude/agents/old-role.md"),
      mine: await exists(".claude/agents/mine.md"),
    }).toEqual({ removed: [".claude/agents/old-role.md"], old: false, mine: true });
  });

  it("перезаписывает без force файл с прежней русской отметкой", async () => {
    await writeProjectFile("CLAUDE.md", `<!-- ${LEGACY_GENERATED_MARK} из harness -->\n`);

    await sync();

    expect(await readFile(path.join(root, "CLAUDE.md"), "utf8")).toContain(GENERATED_MARK);
  });

  it("удаляет без force ненужный файл с прежней русской отметкой", async () => {
    await writeProjectFile(".claude/agents/old-role.md", `<!-- ${LEGACY_GENERATED_MARK} -->\n`);

    const report = await sync();

    expect({ removed: report.removed, old: await exists(".claude/agents/old-role.md") }).toEqual({
      removed: [".claude/agents/old-role.md"],
      old: false,
    });
  });
});
