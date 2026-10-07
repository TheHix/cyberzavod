import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PROJECT_CONFIG_FILE } from "@cyberzavod/storage";
import { GENERATED_MARK } from "./files.ts";
import { INSTALL_ROOT, syncClaude } from "./sync.ts";

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
    journal: "../lab.cyberzavod",
    verification: { commands: ["npm test"], paths: [] },
  };
  await writeProjectFile(PROJECT_CONFIG_FILE, JSON.stringify(config));
  await writeProjectFile("AGENTS.md", "# Правила\n");
  await writeProjectFile("src/AGENTS.md", "# Правила src\n");
}

describe("syncClaude", () => {
  beforeEach(async () => {
    root = path.join(await mkdtemp(path.join(tmpdir(), "cyberzavod-sync-")), "lab");
    await newProject();
  });

  afterEach(async () => {
    await rm(path.dirname(root), { recursive: true, force: true });
  });

  it("пишет файлы Claude Code и путь установки в локальные настройки", async () => {
    const report = await syncClaude({ projectDirectory: root });

    const local: unknown = JSON.parse(
      await readFile(path.join(root, ".claude/settings.local.json"), "utf8"),
    );
    expect({
      changed: report.changed.includes("src/CLAUDE.md"),
      agent: await exists(".claude/agents/coder.md"),
      local,
    }).toEqual({ changed: true, agent: true, local: { env: { CYBERZAVOD_HOME: INSTALL_ROOT } } });
  });

  it("вне установки зовёт CLI через путь установки из локальных настроек", async () => {
    await syncClaude({ projectDirectory: root });

    const skill = await readFile(
      path.join(root, ".claude/skills/publish-recording/SKILL.md"),
      "utf8",
    );
    expect(skill).toContain('`node "$CYBERZAVOD_HOME/packages/cli/src/bin/cyberzavod.ts" draft`');
  });

  it("в режиме проверки ничего не пишет и называет устаревшие файлы", async () => {
    const report = await syncClaude({ projectDirectory: root, check: true });

    expect({ claudeMd: await exists("CLAUDE.md"), changed: report.changed.length > 0 }).toEqual({
      claudeMd: false,
      changed: true,
    });
  });

  it("после синхронизации проверка не находит расхождений", async () => {
    await syncClaude({ projectDirectory: root });

    const report = await syncClaude({ projectDirectory: root, check: true });

    expect(report).toEqual({ changed: [], removed: [], conflicts: [] });
  });

  it("не пишет поверх файла человека и не меняет ничего", async () => {
    await writeProjectFile("CLAUDE.md", "Мои правила\n");

    const act = () => syncClaude({ projectDirectory: root });

    await expect(act).rejects.toThrow(/CLAUDE\.md/);
    expect(await exists(".claude/settings.json")).toBe(false);
  });

  it("с force пишет поверх файла человека", async () => {
    await writeProjectFile("CLAUDE.md", "Мои правила\n");

    await syncClaude({ projectDirectory: root, force: true });

    expect(await readFile(path.join(root, "CLAUDE.md"), "utf8")).toContain(GENERATED_MARK);
  });

  it("удаляет сгенерированный раньше файл, который больше не нужен", async () => {
    await writeProjectFile(".claude/agents/old-role.md", `<!-- ${GENERATED_MARK} -->\n`);
    await writeProjectFile(".claude/agents/mine.md", "Мой агент\n");

    const report = await syncClaude({ projectDirectory: root });

    expect({
      removed: report.removed,
      old: await exists(".claude/agents/old-role.md"),
      mine: await exists(".claude/agents/mine.md"),
    }).toEqual({ removed: [".claude/agents/old-role.md"], old: false, mine: true });
  });
});
