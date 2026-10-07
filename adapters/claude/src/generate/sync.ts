// Синхронизация файлов Claude Code проекта с harness и конфигом: что сгенерировано заново,
// перезаписывается; что сгенерировано раньше и больше не нужно, удаляется; написанное человеком
// не трогается без явного разрешения.

import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { isNotFound, loadHarness, workflowOf } from "@cyberzavod/storage";
import { captureDirectories, requireProject, type LocatedProject } from "../paths.ts";
import { GenerateError } from "./claude.ts";
import {
  claudeFiles,
  GENERATED_MARK,
  type ClaudeProject,
  type ClaudeTemplates,
  type GeneratedFile,
} from "./files.ts";
import {
  adapterHooks,
  HOME_VARIABLE,
  mergeSettings,
  withHome,
  type InstallLocation,
  type Settings,
} from "./settings.ts";

/** Корень установки Cyberzavod, частью которой является этот адаптер. */
export const INSTALL_ROOT = path.resolve(import.meta.dirname, "../../../..");

const HARNESS_DIRECTORY = path.join(INSTALL_ROOT, "harness");
const TEMPLATES_DIRECTORY = path.resolve(import.meta.dirname, "../../templates");
const CLI_SCRIPT = "packages/cli/src/bin/cyberzavod.ts";
const SETTINGS_FILE = ".claude/settings.json";
const LOCAL_SETTINGS_FILE = ".claude/settings.local.json";
const RULES_FILE = "AGENTS.md";
const ENTRYPOINT_FILE = "CLAUDE.md";
const GENERATED_DIRECTORIES = [".claude/agents", ".claude/skills"];
const SKIPPED_DIRECTORIES = new Set(["node_modules"]);

/** Что делать: только сравнить или записать, и можно ли перезаписать написанное человеком. */
export interface SyncOptions {
  /** Каталог внутри проекта. */
  projectDirectory: string;
  /** Только сравнить файлы на диске со сгенерированными, ничего не записывая. */
  check?: boolean;
  /** Перезаписать файлы, которые написал человек, а не генератор. */
  force?: boolean;
}

/** Итог синхронизации: пути от корня проекта через `/`. */
export interface SyncReport {
  /** Файлы, которые записаны (или, при проверке, устарели). */
  changed: string[];
  /** Сгенерированные раньше файлы, которые удалены (или, при проверке, лишние). */
  removed: string[];
  /** Файлы, написанные человеком, на месте которых генератор пишет свои. */
  conflicts: string[];
}

function toPosix(relative: string): string {
  return relative.split(path.sep).join("/");
}

function relativeTo(root: string, target: string): string {
  return toPosix(path.relative(root, target));
}

function installLocationOf(root: string): InstallLocation {
  const relative = path.relative(root, INSTALL_ROOT);
  const inside = !relative.startsWith("..") && !path.isAbsolute(relative);
  return inside ? { in: "project", path: toPosix(relative) } : { in: "home" };
}

function cliOf(location: InstallLocation): string {
  switch (location.in) {
    case "project":
      return `node ${location.path === "" ? "" : `${location.path}/`}${CLI_SCRIPT}`;
    case "home":
      // Ту же переменную, что и хукам, Claude Code передаёт командам сессии из settings.local.json.
      return `node "$${HOME_VARIABLE}/${CLI_SCRIPT}"`;
    default:
      return location satisfies never;
  }
}

async function readOptional(file: string): Promise<string | undefined> {
  try {
    return await readFile(file, "utf8");
  } catch (err) {
    if (isNotFound(err)) return undefined;
    throw err;
  }
}

// Каталоги, где лежит файл с этим именем; скрытые каталоги, зависимости и журнал проекта
// не просматриваются.
async function directoriesWith(root: string, fileName: string, skipped: string): Promise<string[]> {
  const found: string[] = [];
  const visit = async (directory: string): Promise<void> => {
    const entries = await readdir(directory, { withFileTypes: true });
    if (entries.some((entry) => entry.isFile() && entry.name === fileName)) {
      found.push(relativeTo(root, directory));
    }
    for (const entry of entries) {
      const child = path.join(directory, entry.name);
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
      if (SKIPPED_DIRECTORIES.has(entry.name) || child === skipped) continue;
      await visit(child);
    }
  };
  await visit(root);
  return found.sort();
}

function inDirectory(directory: string, fileName: string): string {
  return directory === "" ? fileName : `${directory}/${fileName}`;
}

async function readTemplates(): Promise<ClaudeTemplates> {
  return {
    publishRecording: await readFile(
      path.join(TEMPLATES_DIRECTORY, "publish-recording.md"),
      "utf8",
    ),
    recordingEditor: await readFile(path.join(TEMPLATES_DIRECTORY, "recording-editor.md"), "utf8"),
  };
}

async function claudeProjectOf(
  project: LocatedProject,
  location: InstallLocation,
): Promise<ClaudeProject> {
  const harness = await loadHarness(HARNESS_DIRECTORY);
  const capture = captureDirectories(project.journal);
  const claudeProject: ClaudeProject = {
    config: project.config,
    harness,
    workflow: workflowOf(harness, project.config.workflow),
    rules: await directoriesWith(project.root, RULES_FILE, project.journal),
    capture: {
      raw: relativeTo(project.root, capture.raw),
      drafts: relativeTo(project.root, capture.drafts),
    },
    cli: cliOf(location),
    templates: await readTemplates(),
  };
  return claudeProject;
}

function parseSettings(text: string | undefined, file: string): Settings {
  if (text === undefined) return {};
  try {
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new GenerateError("настройки должны быть объектом");
    }
    return parsed as Settings;
  } catch (err) {
    throw new GenerateError(`${file} не разобран: ${(err as Error).message}`, { cause: err });
  }
}

function settingsText(settings: Settings): string {
  return `${JSON.stringify(settings, null, 2)}\n`;
}

async function settingsFile(root: string, location: InstallLocation): Promise<GeneratedFile> {
  const current = parseSettings(await readOptional(path.join(root, SETTINGS_FILE)), SETTINGS_FILE);
  return {
    path: SETTINGS_FILE,
    content: settingsText(mergeSettings(current, adapterHooks(location))),
  };
}

// Перевод строк при выписке из git на Windows не делает файл устаревшим.
function sameText(left: string, right: string): boolean {
  return left.replace(/\r\n/g, "\n") === right.replace(/\r\n/g, "\n");
}

function isGenerated(text: string): boolean {
  return text.includes(GENERATED_MARK);
}

async function generatedOnDisk(root: string, journal: string): Promise<string[]> {
  const candidates = (await directoriesWith(root, ENTRYPOINT_FILE, journal)).map((directory) =>
    inDirectory(directory, ENTRYPOINT_FILE),
  );
  for (const directory of GENERATED_DIRECTORIES) {
    const entries = await readdir(path.join(root, directory), { recursive: true }).catch(
      (err: unknown) => {
        if (isNotFound(err)) return [];
        throw err;
      },
    );
    candidates.push(
      ...entries
        .filter((entry) => entry.endsWith(".md"))
        .map((entry) => `${directory}/${toPosix(entry)}`),
    );
  }
  const generated: string[] = [];
  for (const candidate of candidates) {
    const text = await readOptional(path.join(root, ...candidate.split("/")));
    if (text !== undefined && isGenerated(text)) generated.push(candidate);
  }
  return generated;
}

async function compare(root: string, files: GeneratedFile[], force: boolean) {
  const changed: string[] = [];
  const conflicts: string[] = [];
  for (const file of files) {
    const current = await readOptional(path.join(root, ...file.path.split("/")));
    if (current !== undefined && sameText(current, file.content)) continue;
    const ownedByGenerator =
      current === undefined || isGenerated(current) || file.path === SETTINGS_FILE;
    if (ownedByGenerator || force) changed.push(file.path);
    else conflicts.push(file.path);
  }
  return { changed, conflicts };
}

async function writeFiles(root: string, files: GeneratedFile[], paths: string[]): Promise<void> {
  for (const file of files.filter(({ path: filePath }) => paths.includes(filePath))) {
    const target = path.join(root, ...file.path.split("/"));
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, file.content);
  }
}

async function writeLocalHome(root: string): Promise<void> {
  const file = path.join(root, ...LOCAL_SETTINGS_FILE.split("/"));
  const current = parseSettings(await readOptional(file), LOCAL_SETTINGS_FILE);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, settingsText(withHome(current, INSTALL_ROOT)));
}

/**
 * Приводит файлы Claude Code проекта к harness и конфигу: CLAUDE.md рядом с каждым AGENTS.md,
 * агенты ролей, скиллы, хуки в настройках; вне проекта — путь установки в локальных настройках.
 * @param {SyncOptions} options Проект и режим.
 * @returns {Promise<SyncReport>} Что записано и удалено или, при проверке, что устарело.
 * @throws {GenerateError} Если генератор пишет поверх файлов человека без `force`, конфиг
 *   отдаёт этап чужому агенту или настройки проекта не разобраны.
 */
export async function syncClaude(options: SyncOptions): Promise<SyncReport> {
  const project = await requireProject(options.projectDirectory);
  const location = installLocationOf(project.root);
  const claudeProject = await claudeProjectOf(project, location);
  const files = [...claudeFiles(claudeProject), await settingsFile(project.root, location)];
  const { changed, conflicts } = await compare(project.root, files, options.force === true);
  const wanted = new Set(files.map(({ path: filePath }) => filePath));
  const removed = (await generatedOnDisk(project.root, project.journal)).filter(
    (filePath) => !wanted.has(filePath),
  );
  const report = { changed, removed, conflicts };
  if (options.check === true) return report;
  if (conflicts.length > 0) {
    throw new GenerateError(
      `эти файлы написаны не генератором, перенесите их содержимое в AGENTS.md или запустите с --force: ${conflicts.join(", ")}`,
    );
  }
  await writeFiles(project.root, files, changed);
  for (const filePath of removed) await rm(path.join(project.root, ...filePath.split("/")));
  if (location.in === "home") await writeLocalHome(project.root);
  return report;
}
