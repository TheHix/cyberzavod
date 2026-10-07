import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseProjectConfig } from "@cyberzavod/core";
import { PROJECT_CONFIG_FILE, TOOL_FILE } from "@cyberzavod/storage";
import { runCli } from "./cli.ts";

// Из исходников CLI собранного себя не знает; тесту хватает любого текста на его месте.
const BUILT_TOOL = "// собранный cyberzavod\n";

vi.mock("./installation/assets.ts", async (importOriginal) => {
  const original = await importOriginal<typeof import("./installation/assets.ts")>();

  return {
    readAssets: async () => ({ ...(await original.readAssets()), tool: BUILT_TOOL }),
  };
});

let workspace: string;
let root: string;

async function initialized(): Promise<void> {
  await runCli(["init", "--yes"], root);
}

async function journalFiles(collection: string): Promise<string[]> {
  return readdir(path.join(root, ".cyberzavod/journal", collection));
}

describe("runCli", () => {
  beforeEach(async () => {
    workspace = await mkdtemp(path.join(tmpdir(), "cyberzavod-cli-"));
    root = path.join(workspace, "shop");
    await mkdir(root);
    await writeFile(path.join(root, "package.json"), JSON.stringify({ scripts: { test: "x" } }));
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(workspace, { recursive: true, force: true });
  });

  it("без команды печатает справку и выходит с успехом", async () => {
    const code = await runCli([], root);

    expect(code).toBe(0);
  });

  it("на неизвестную команду печатает справку и выходит с ошибкой", async () => {
    const code = await runCli(["deploy"], root);

    expect(code).toBe(1);
  });

  it("init --yes пишет конфиг, AGENTS.md и тонкий CLAUDE.md", async () => {
    const code = await runCli(["init", "--yes"], root);

    const configText = await readFile(path.join(root, PROJECT_CONFIG_FILE), "utf8");
    const config = parseProjectConfig(JSON.parse(configText));
    const rules = await readFile(path.join(root, "AGENTS.md"), "utf8");
    const entrypoint = await readFile(path.join(root, "CLAUDE.md"), "utf8");

    expect({
      code,
      projectId: config.projectId,
      commands: config.verification.commands,
      rules: rules.includes("`npm run test`"),
      imports: entrypoint.includes("@AGENTS.md"),
    }).toEqual({
      code: 0,
      projectId: "shop",
      commands: ["npm run test"],
      rules: true,
      imports: true,
    });
  });

  it("init кладёт в проект собранный CLI и прячет от git сырые журналы", async () => {
    await runCli(["init", "--yes"], root);

    const tool = await readFile(path.join(root, TOOL_FILE), "utf8");
    const gitignore = await readFile(path.join(root, ".gitignore"), "utf8");

    expect({ tool, gitignore }).toEqual({
      tool: BUILT_TOOL,
      gitignore: "/.cyberzavod/journal/capture/\n",
    });
  });

  it("переносит написанный человеком CLAUDE.md в AGENTS.md", async () => {
    await writeFile(path.join(root, "CLAUDE.md"), "# Мои правила\n");

    await runCli(["init", "--yes"], root);

    const rules = await readFile(path.join(root, "AGENTS.md"), "utf8");

    expect(rules).toBe("# Мои правила\n");
  });

  it("второй init отказывает", async () => {
    await initialized();

    const code = await runCli(["init", "--yes"], root);

    expect(code).toBe(1);
  });

  it("sync --check после init не находит расхождений, а после правки — находит", async () => {
    await initialized();
    const clean = await runCli(["sync", "--check"], root);

    await writeFile(path.join(root, ".claude/agents/coder.md"), "правка\n");

    const stale = await runCli(["sync", "--check"], root);

    expect([clean, stale]).toEqual([0, 1]);
  });

  it("sync восстанавливает сгенерированные файлы", async () => {
    await initialized();
    await rm(path.join(root, ".claude/agents/coder.md"));

    await runCli(["sync"], root);

    const code = await runCli(["sync", "--check"], root);

    expect(code).toBe(0);
  });

  it("decision и note пишут записи в журнал проекта", async () => {
    await initialized();

    const codes = [
      await runCli(["decision", "Храним", "журнал", "рядом", "--why", "Чистый репозиторий"], root),
      await runCli(["note", "Первая заметка"], root),
    ];

    const decisions = await journalFiles("decisions");
    const notes = await journalFiles("notes");

    expect({ codes, decisions: decisions.length, notes: notes.length }).toEqual({
      codes: [0, 0],
      decisions: 1,
      notes: 1,
    });
  });

  it("decision без текста выходит с ошибкой", async () => {
    await initialized();

    const code = await runCli(["decision"], root);

    expect(code).toBe(1);
  });

  it("команды проекта вне проекта выходят с ошибкой", async () => {
    const codes = await Promise.all(
      ["status", "note", "sync"].map((name) => runCli([name, "x"], root)),
    );

    expect(codes).toEqual([1, 1, 1]);
  });

  it("неизвестный флаг — ошибка, а не падение", async () => {
    const code = await runCli(["sync", "--nope"], root);

    expect(code).toBe(1);
  });

  it("status описывает подключённый проект", async () => {
    await initialized();

    const code = await runCli(["status"], root);

    expect(code).toBe(0);
  });
});
