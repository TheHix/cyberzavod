// Дымовая проверка настоящего npm-пакета: `npm pack`, установка архива во временный каталог и
// путь человека в чистом проекте — init, status, doctor, sync --check, повторный init, хук записи,
// решение в журнал, disconnect. После disconnect код и файлы человека на месте, файлы Cyberzavod
// убраны, журнал остался. Запускается на Linux, macOS и Windows: только API Node, без оболочки,
// кроме вызова npm, который на Windows — `npm.cmd`.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const PACKAGE = path.resolve(import.meta.dirname, "..");
const IS_WINDOWS = process.platform === "win32";
// Пробел в пути проекта ловит команды, которые склеивают путь в строку без кавычек.
const PROJECT_NAME = "smoke project";
const PUBLISHED_FILES = ["LICENSE", "README.md", "dist/cyberzavod.mjs", "package.json"];
const SESSION_ID = "smoke-session";
// С этого символа начинаются цвета и прочие управляющие последовательности терминала.
const ESCAPE = "\u001b";
const SUCCESS = 0;
const FAILURE = 1;

const SOURCE_FILES: Readonly<Record<string, string>> = {
  "package.json": `${JSON.stringify(
    { name: "smoke-project", private: true, scripts: { test: "node --test" } },
    null,
    2,
  )}\n`,
  "src/index.js": 'export const greeting = "hello";\n',
  "README.md": "# Smoke project\n\nA file the human wrote.\n",
};
const USER_GITIGNORE = "node_modules/\n";
const CAPTURE_IGNORE_ENTRY = "/.cyberzavod/journal/capture/";
const USER_SETTINGS = {
  permissions: { allow: ["Bash(npm test)"] },
  hooks: {
    PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "echo user-hook" }] }],
  },
};
const GENERATED_PATHS = [
  "CLAUDE.md",
  ".claude/agents",
  ".claude/skills",
  ".cyberzavod/project.json",
  ".cyberzavod/generated.json",
];

interface PackedPackage {
  filename: string;
  version: string;
  size: number;
  unpackedSize: number;
  files: { path: string }[];
}

interface Run {
  status: number | null;
  stdout: string;
  stderr: string;
}

interface Workspace {
  tool: string;
  project: string;
  cli: string;
}

function step(title: string): void {
  console.log(`✓ ${title}`);
}

// На Windows npm — пакетный файл `npm.cmd`, его запускает только оболочка. Аргументы npm здесь —
// пути без пробелов и флаги, поэтому склейка их оболочкой безопасна.
function npm(args: readonly string[], cwd: string): string {
  const result = spawnSync("npm", args, { cwd, encoding: "utf8", shell: IS_WINDOWS });

  assert.equal(result.status, SUCCESS, `npm ${args.join(" ")}:\n${result.stderr}`);

  return result.stdout;
}

// INIT_CWD ставит pnpm, который запускает этот скрипт: CLI принял бы его за каталог проекта.
function childEnvironment(extra: Readonly<Record<string, string>>): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = { ...process.env, ...extra, CYBERZAVOD_LANG: "en" };

  delete environment.INIT_CWD;

  return environment;
}

function cyberzavod(
  workspace: Workspace,
  args: readonly string[],
  options: { input?: string; env?: Readonly<Record<string, string>> } = {},
): Run {
  const result = spawnSync(process.execPath, [workspace.cli, ...args], {
    cwd: workspace.project,
    encoding: "utf8",
    input: options.input,
    env: childEnvironment(options.env ?? {}),
  });

  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

function expectExit(run: Run, status: number, command: string): void {
  assert.equal(run.status, status, `${command}:\n${run.stdout}\n${run.stderr}`);
}

function jsonOf(run: Run, command: string): Record<string, unknown> {
  assert.ok(!run.stdout.includes(ESCAPE), `${command}: управляющие символы терминала в JSON`);

  return JSON.parse(run.stdout) as Record<string, unknown>;
}

// Перед JSON npm может напечатать вывод скриптов сборки: документ начинается с первой `[`.
function packPackage(destination: string): PackedPackage {
  const output = npm(["pack", "--json", "--pack-destination", destination], PACKAGE);
  const [packed] = JSON.parse(output.slice(output.indexOf("["))) as PackedPackage[];

  assert.ok(packed, "npm pack не вернул архив");

  const packedFiles = packed.files.map((file) => file.path).sort();

  assert.deepEqual(packedFiles, PUBLISHED_FILES, "в архиве лишние или недостающие файлы");
  console.log(
    `  ${packed.filename}: ${packed.size} B packed, ${packed.unpackedSize} B unpacked, ` +
      `${packedFiles.length} files`,
  );

  return packed;
}

async function installPackage(tool: string, packed: PackedPackage): Promise<string> {
  npm(["install", "--no-audit", "--no-fund", `./${packed.filename}`], tool);

  const installed = path.join(tool, "node_modules", "cyberzavod");
  const manifest = JSON.parse(await readFile(path.join(installed, "package.json"), "utf8")) as {
    bin: Record<string, string>;
    dependencies?: Record<string, string>;
  };
  const binName = IS_WINDOWS ? "cyberzavod.cmd" : "cyberzavod";
  const entry = manifest.bin.cyberzavod;

  assert.equal(manifest.dependencies, undefined, "у пакета не должно быть зависимостей");
  assert.ok(entry, "в package.json нет bin cyberzavod");
  assert.ok(existsSync(path.join(tool, "node_modules", ".bin", binName)), "npm не создал bin");

  return path.join(installed, entry);
}

async function writeFiles(root: string, files: Readonly<Record<string, string>>): Promise<void> {
  for (const [file, text] of Object.entries(files)) {
    const target = path.join(root, file);

    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, text);
  }
}

async function createProject(project: string): Promise<void> {
  const settings = `${JSON.stringify(USER_SETTINGS, null, 2)}\n`;

  await writeFiles(project, {
    ...SOURCE_FILES,
    ".gitignore": USER_GITIGNORE,
    ".claude/settings.json": settings,
  });

  const git = spawnSync("git", ["init", "-q"], { cwd: project, encoding: "utf8" });

  assert.equal(git.status, SUCCESS, `git init:\n${git.stderr}`);
}

async function readText(root: string, file: string): Promise<string> {
  return readFile(path.join(root, file), "utf8");
}

function countLines(text: string, line: string): number {
  return text.split(/\r?\n/).filter((candidate) => candidate === line).length;
}

function checkVersion(workspace: Workspace, packed: PackedPackage): void {
  const run = cyberzavod(workspace, ["--version"]);

  expectExit(run, SUCCESS, "--version");
  assert.equal(run.stdout.trim(), packed.version, "--version не совпадает с версией пакета");
  step(`--version: ${packed.version}`);
}

async function checkInit(workspace: Workspace): Promise<void> {
  const run = cyberzavod(workspace, ["init", "--yes"]);

  expectExit(run, SUCCESS, "init --yes");

  for (const file of [...GENERATED_PATHS, "AGENTS.md"]) {
    assert.ok(existsSync(path.join(workspace.project, file)), `init не создал ${file}`);
  }

  const settings = await readText(workspace.project, ".claude/settings.json");

  assert.match(settings, /echo user-hook/, "init потерял хук человека");
  assert.match(settings, /cyberzavod@\d+\.\d+\.\d+ hook stop/, "init не поставил хук остановки");
  step("init --yes");
}

function checkStatus(workspace: Workspace): void {
  expectExit(cyberzavod(workspace, ["status"]), SUCCESS, "status");

  const run = cyberzavod(workspace, ["status", "--json"]);

  expectExit(run, SUCCESS, "status --json");

  const status = jsonOf(run, "status --json");

  assert.equal(status.schemaVersion, 1);
  assert.equal(status.command, "status");
  assert.equal(status.status, "connected");
  step("status, status --json");
}

// Код выхода doctor здесь не проверяется: заготовка AGENTS.md ждёт /setup, а Claude Code на
// машине CI нет. Важно, что проект, хуки и файлы агента в порядке и JSON разбирается.
function checkDoctor(workspace: Workspace): void {
  const run = cyberzavod(workspace, ["doctor", "--json"]);
  const doctor = jsonOf(run, "doctor --json");
  const checks = doctor.checks as { id: string; status: string }[];
  const statusOf = (id: string) => checks.find((check) => check.id === id)?.status;

  assert.equal(doctor.schemaVersion, 1);

  for (const id of ["node", "config", "hooks", "files", "gitignore"]) {
    assert.equal(statusOf(id), "passed", `doctor: проверка ${id}\n${run.stdout}`);
  }

  step("doctor --json");
}

function checkSync(workspace: Workspace): void {
  expectExit(cyberzavod(workspace, ["sync", "--check"]), SUCCESS, "sync --check");

  const run = cyberzavod(workspace, ["sync", "--check", "--json"]);

  expectExit(run, SUCCESS, "sync --check --json");
  assert.equal(jsonOf(run, "sync --check --json").status, "current");
  step("sync --check, sync --check --json");
}

async function checkRepeatedInit(workspace: Workspace): Promise<void> {
  const settingsBefore = await readText(workspace.project, ".claude/settings.json");
  const run = cyberzavod(workspace, ["init", "--yes"]);

  expectExit(run, SUCCESS, "повторный init");
  assert.match(run.stdout, /Nothing to do/);

  const settingsAfter = await readText(workspace.project, ".claude/settings.json");
  const gitignore = await readText(workspace.project, ".gitignore");

  assert.equal(settingsAfter, settingsBefore, "повторный init изменил настройки");
  assert.equal(countLines(gitignore, CAPTURE_IGNORE_ENTRY), 1, "повтор строки .gitignore");
  step("повторный init ничего не меняет");
}

function checkJournal(workspace: Workspace): void {
  const payload = JSON.stringify({
    session_id: SESSION_ID,
    hook_event_name: "UserPromptSubmit",
    prompt: "Add dark mode",
  });
  const hook = cyberzavod(workspace, ["hook", "record"], {
    input: payload,
    env: { CLAUDE_PROJECT_DIR: workspace.project },
  });
  const rawLog = path.join(
    workspace.project,
    ".cyberzavod/journal/capture/claude/raw",
    `${SESSION_ID}.jsonl`,
  );

  expectExit(hook, SUCCESS, "hook record");
  assert.ok(existsSync(rawLog), "хук записи не создал сырой журнал");
  expectExit(cyberzavod(workspace, ["decision", "Smoke decision"]), SUCCESS, "decision");
  step("hook record, decision");
}

async function snapshot(root: string, files: readonly string[]): Promise<string[]> {
  return Promise.all(files.map((file) => readText(root, file)));
}

async function checkDisconnect(workspace: Workspace): Promise<void> {
  const { project } = workspace;
  const keptFiles = [...Object.keys(SOURCE_FILES), "AGENTS.md"];
  const before = await snapshot(project, keptFiles);

  expectExit(cyberzavod(workspace, ["disconnect"]), FAILURE, "disconnect без терминала");
  assert.ok(existsSync(path.join(project, ".cyberzavod/project.json")), "отказ всё же удалил");
  expectExit(cyberzavod(workspace, ["disconnect", "--yes"]), SUCCESS, "disconnect --yes");

  for (const file of GENERATED_PATHS) {
    assert.ok(!existsSync(path.join(project, file)), `disconnect оставил ${file}`);
  }

  const settings = JSON.parse(await readText(project, ".claude/settings.json")) as unknown;
  const decisions = await readdir(path.join(project, ".cyberzavod/journal/decisions"));
  const gitignore = await readText(project, ".gitignore");

  assert.deepEqual(await snapshot(project, keptFiles), before, "disconnect изменил файлы человека");
  assert.deepEqual(settings, USER_SETTINGS, "disconnect не вернул настройки человека");
  assert.equal(decisions.length, 1, "disconnect тронул журнал");
  assert.ok(gitignore.startsWith(USER_GITIGNORE), "disconnect изменил .gitignore человека");
  expectExit(cyberzavod(workspace, ["status"]), FAILURE, "status после disconnect");
  step("disconnect: код, AGENTS.md, журнал и настройки человека на месте");
}

async function main(): Promise<void> {
  const root = await mkdtemp(path.join(os.tmpdir(), "cyberzavod-smoke-"));
  const tool = path.join(root, "tool");
  const project = path.join(root, PROJECT_NAME);

  try {
    await mkdir(tool);
    await createProject(project);

    const packed = packPackage(tool);
    const workspace: Workspace = { tool, project, cli: await installPackage(tool, packed) };

    step(`npm pack и установка ${packed.filename}`);
    checkVersion(workspace, packed);
    await checkInit(workspace);
    checkStatus(workspace);
    checkDoctor(workspace);
    checkSync(workspace);
    await checkRepeatedInit(workspace);
    checkJournal(workspace);
    await checkDisconnect(workspace);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

await main();
