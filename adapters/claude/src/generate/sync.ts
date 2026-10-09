// Синхронизация файлов Claude Code проекта с harness и конфигом: что сгенерировано заново,
// перезаписывается; что сгенерировано раньше и больше не нужно, удаляется; написанное человеком
// не трогается без явного разрешения.

import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Harness, ProjectConfig } from "@cyberzavod/core";
import { isNotFound, journalDirectory, workflowOf } from "@cyberzavod/storage";
import { pinnedCliCommand } from "../cli-command.ts";
import { captureDirectories, requireProject, type LocatedProject } from "../paths.ts";
import { GenerateError } from "./claude.ts";
import {
  claudeFiles,
  GENERATED_MARK,
  LEGACY_GENERATED_MARK,
  type ClaudeProject,
  type ClaudeTemplates,
  type GeneratedFile,
} from "./files.ts";
import {
  contentHash,
  MANIFEST_FILE,
  manifestText,
  parseManifest,
  type Manifest,
} from "./manifest.ts";
import {
  adapterHooks,
  mergeSettings,
  missingAdapterDeny,
  parseSettings,
  SETTINGS_FILE,
  SettingsError,
  unparsedSettings,
  type Settings,
} from "./settings.ts";

const RULES_FILE = "AGENTS.md";
const ENTRYPOINT_FILE = "CLAUDE.md";
const GENERATED_DIRECTORIES = [".claude/agents", ".claude/skills"];
const SKIPPED_DIRECTORIES = new Set(["node_modules"]);

/** Из чего генерировать: harness и шаблоны той версии Cyberzavod, что запущена. */
export interface ClaudeInstallation {
  harness: Harness;
  templates: ClaudeTemplates;
}

/** Что делать: только сравнить или записать, и можно ли перезаписать написанное человеком. */
export interface SyncOptions {
  /** Каталог внутри проекта. */
  projectDirectory: string;
  installation: ClaudeInstallation;
  /** Только сравнить файлы на диске со сгенерированными, ничего не записывая. */
  check?: boolean;
  /** Перезаписать файлы, которые написал человек, а не генератор. */
  force?: boolean;
}

/** Итог синхронизации: пути от корня проекта через `/`. */
export interface SyncReport {
  /** Файлы, которых не было и которые записаны (или, при проверке, появятся). */
  added: string[];
  /** Сгенерированные файлы, которые перезаписаны (или, при проверке, устарели). */
  updated: string[];
  /** Сгенерированные раньше файлы, которые удалены (или, при проверке, лишние). */
  removed: string[];
  /** Файлы, написанные человеком, на месте которых генератор пишет свои. */
  conflicts: string[];
  /** Сгенерированные файлы, исправленные руками: без `force` генератор их не трогает. */
  edited: string[];
}

function toPosix(relative: string): string {
  return relative.split(path.sep).join("/");
}

function relativeTo(root: string, target: string): string {
  return toPosix(path.relative(root, target));
}

/**
 * Путь файла на диске по пути от корня проекта через `/`.
 * @param {string} root Корень проекта.
 * @param {string} relative Путь от корня через `/`.
 * @returns {string} Путь на диске.
 */
export function fileAt(root: string, relative: string): string {
  return path.join(root, ...relative.split("/"));
}

/**
 * Читает текстовый файл, если он есть.
 * @param {string} file Путь на диске.
 * @returns {Promise<string | undefined>} Содержимое или undefined, если файла нет.
 * @throws {Error} Если файл не читается по другой причине.
 */
export async function readOptional(file: string): Promise<string | undefined> {
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

async function claudeProjectOf(
  project: LocatedProject,
  installation: ClaudeInstallation,
): Promise<ClaudeProject> {
  const { harness, templates } = installation;
  const capture = captureDirectories(project.journal);

  return {
    config: project.config,
    harness,
    workflow: workflowOf(harness, project.config.workflow),
    rules: await directoriesWith(project.root, RULES_FILE, project.journal),
    capture: {
      raw: relativeTo(project.root, capture.raw),
      drafts: relativeTo(project.root, capture.drafts),
    },
    cli: pinnedCliCommand(project.config.harness),
    templates,
  };
}

function settingsText(settings: Settings): string {
  return `${JSON.stringify(settings, null, 2)}\n`;
}

function settingsWithAdapterHooks(current: Settings, version: string): Settings {
  try {
    return mergeSettings(current, adapterHooks(version));
  } catch (err) {
    if (err instanceof SettingsError) throw unparsedSettings(err);

    throw err;
  }
}

function settingsFile(current: Settings, version: string): GeneratedFile {
  return {
    path: SETTINGS_FILE,
    content: settingsText(settingsWithAdapterHooks(current, version)),
  };
}

// Перевод строк при выписке из git на Windows не делает файл устаревшим.
function sameText(left: string, right: string): boolean {
  return withUnixNewlines(left) === withUnixNewlines(right);
}

function withUnixNewlines(text: string): string {
  return text.replace(/\r\n/g, "\n");
}

function isGenerated(text: string): boolean {
  return text.includes(GENERATED_MARK) || text.includes(LEGACY_GENERATED_MARK);
}

/**
 * Чей файл на месте сгенерированного: его нет; он сгенерирован и не тронут; сгенерирован, но
 * исправлен руками; написан человеком. Отпечаток в манифесте главнее отметки: отметку правка
 * руками не снимает.
 */
export type Ownership = "missing" | "generated" | "edited" | "human";

/**
 * Чей файл на месте сгенерированного.
 * @param {string} file Путь от корня через `/`.
 * @param {string | undefined} text Содержимое; undefined, если файла нет.
 * @param {Manifest} manifest Манифест сгенерированного.
 * @returns {Ownership} Нет файла, сгенерирован, исправлен руками или написан человеком.
 */
export function ownershipOf(file: string, text: string | undefined, manifest: Manifest): Ownership {
  if (text === undefined) return "missing";

  const recorded = manifest.files[file];

  if (recorded !== undefined) return contentHash(text) === recorded ? "generated" : "edited";

  return isGenerated(text) ? "generated" : "human";
}

function ignoreMissing(err: unknown): string[] {
  if (isNotFound(err)) return [];

  throw err;
}

async function markdownFilesUnder(root: string, directory: string): Promise<string[]> {
  const entries = await readdir(path.join(root, directory), { recursive: true }).catch(
    ignoreMissing,
  );
  const markdown = entries.filter((entry) => entry.endsWith(".md"));

  return markdown.map((entry) => `${directory}/${toPosix(entry)}`);
}

/**
 * Файлы, которые генератор записал раньше: с отметкой генерации или из манифеста.
 * @param {LocatedProject} project Проект.
 * @param {Manifest} manifest Манифест сгенерированного.
 * @returns {Promise<string[]>} Пути от корня через `/`; файла по пути может уже не быть.
 */
export async function generatedCandidates(
  project: LocatedProject,
  manifest: Manifest,
): Promise<string[]> {
  const { root, journal } = project;
  const entrypointDirectories = await directoriesWith(root, ENTRYPOINT_FILE, journal);
  const entrypoints = entrypointDirectories.map((directory) =>
    inDirectory(directory, ENTRYPOINT_FILE),
  );
  const generatedFiles = await Promise.all(
    GENERATED_DIRECTORIES.map((directory) => markdownFilesUnder(root, directory)),
  );

  return [...new Set([...entrypoints, ...generatedFiles.flat(), ...Object.keys(manifest.files)])];
}

/** Файл на месте сгенерированного и чей он. */
interface FileOnDisk {
  path: string;
  ownership: Ownership;
}

async function filesOnDisk(
  root: string,
  paths: string[],
  manifest: Manifest,
): Promise<FileOnDisk[]> {
  return Promise.all(
    paths.map(async (file) => {
      const text = await readOptional(fileAt(root, file));

      return { path: file, ownership: ownershipOf(file, text, manifest) };
    }),
  );
}

/** Что генератор сделает с файлами проекта, без записи. */
interface SyncPlan {
  report: SyncReport;
  files: GeneratedFile[];
}

/** Что генератор делает с файлом, который хочет записать. */
type WriteOutcome = "added" | "updated" | "conflict" | "edited";

function writeOutcomeOf(ownership: Ownership, force: boolean): WriteOutcome {
  switch (ownership) {
    case "missing":
      return "added";
    case "generated":
      return "updated";
    case "edited":
      return force ? "updated" : "edited";
    case "human":
      return force ? "updated" : "conflict";
    default:
      return ownership satisfies never;
  }
}

// Настройки и манифест общие: настройки генератор правит только в своей части, манифест — его.
const SHARED_FILES: ReadonlySet<string> = new Set([SETTINGS_FILE, MANIFEST_FILE]);

async function planWrites(
  root: string,
  files: GeneratedFile[],
  manifest: Manifest,
  force: boolean,
) {
  const outcomes: Record<WriteOutcome, string[]> = {
    added: [],
    updated: [],
    conflict: [],
    edited: [],
  };

  for (const file of files) {
    const current = await readOptional(fileAt(root, file.path));

    if (current !== undefined && sameText(current, file.content)) continue;

    const isSharedPresent = SHARED_FILES.has(file.path) && current !== undefined;
    const ownership = isSharedPresent ? "generated" : ownershipOf(file.path, current, manifest);

    outcomes[writeOutcomeOf(ownership, force)].push(file.path);
  }

  return outcomes;
}

async function planRemovals(
  project: LocatedProject,
  wanted: Set<string>,
  manifest: Manifest,
  force: boolean,
) {
  const candidates = await generatedCandidates(project, manifest);
  const obsolete = candidates.filter((file) => !wanted.has(file));
  const onDisk = await filesOnDisk(project.root, obsolete, manifest);
  const removed = onDisk
    .filter(({ ownership }) => ownership === "generated" || (ownership === "edited" && force))
    .map((file) => file.path);
  const edited = onDisk
    .filter(({ ownership }) => ownership === "edited" && !force)
    .map((file) => file.path);

  return { removed: removed.sort(), edited };
}

function manifestOf(files: GeneratedFile[], deny: readonly string[]): Manifest {
  const owned = files.filter((file) => file.path !== SETTINGS_FILE);
  const hashes = owned.map((file) => [file.path, contentHash(file.content)] as const);

  return { files: Object.fromEntries(hashes), deny };
}

/**
 * Читает манифест сгенерированного из проекта.
 * @param {string} root Корень проекта.
 * @returns {Promise<Manifest>} Манифест; пустой, если файла нет.
 * @throws {GenerateError} Если манифест не разобран.
 */
export async function readManifest(root: string): Promise<Manifest> {
  return parseManifest(await readOptional(fileAt(root, MANIFEST_FILE)));
}

/**
 * Читает настройки Claude Code проекта.
 * @param {string} root Корень проекта.
 * @returns {Promise<Settings>} Настройки; пустой объект, если файла нет.
 * @throws {GenerateError} Если файл не JSON или не объект.
 */
export async function readSettings(root: string): Promise<Settings> {
  return parseSettings(await readOptional(fileAt(root, SETTINGS_FILE)), SETTINGS_FILE);
}

function addedDeny(settings: Settings): string[] {
  try {
    return missingAdapterDeny(settings);
  } catch (err) {
    if (err instanceof SettingsError) throw unparsedSettings(err);

    throw err;
  }
}

async function planSync(
  project: LocatedProject,
  installation: ClaudeInstallation,
  force: boolean,
): Promise<SyncPlan> {
  const claudeProject = await claudeProjectOf(project, installation);
  const manifest = await readManifest(project.root);
  const settings = await readSettings(project.root);
  const deny = [...new Set([...manifest.deny, ...addedDeny(settings)])];
  const generated = [...claudeFiles(claudeProject), settingsFile(settings, project.config.harness)];
  const files = [
    ...generated,
    { path: MANIFEST_FILE, content: manifestText(manifestOf(generated, deny)) },
  ];
  const writes = await planWrites(project.root, files, manifest, force);
  const wanted = new Set(files.map(({ path: filePath }) => filePath));
  const removals = await planRemovals(project, wanted, manifest, force);
  const report: SyncReport = {
    added: writes.added,
    updated: writes.updated,
    removed: removals.removed,
    conflicts: writes.conflict,
    edited: [...writes.edited, ...removals.edited],
  };

  return { report, files };
}

async function writeFiles(root: string, files: GeneratedFile[], paths: string[]): Promise<void> {
  for (const file of files.filter(({ path: filePath }) => paths.includes(filePath))) {
    const target = fileAt(root, file.path);

    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, file.content);
  }
}

/**
 * Проверяет, что генератор может записать всё по отчёту: на месте его файлов нет файлов человека
 * и исправленных руками.
 * @param {SyncReport} report Отчёт сравнения.
 * @throws {GenerateError} Если такие файлы есть: их список — в сообщении.
 */
export function requireWritable(report: SyncReport): void {
  const blocked = [...report.conflicts, ...report.edited];

  if (blocked.length === 0) return;

  const list = blocked.join(", ");

  throw new GenerateError((messages) => messages.errors.fileConflicts(list));
}

async function applySync(project: LocatedProject, plan: SyncPlan): Promise<void> {
  const { report, files } = plan;

  requireWritable(report);
  await writeFiles(project.root, files, [...report.added, ...report.updated]);
  for (const filePath of report.removed) await rm(fileAt(project.root, filePath));
}

/**
 * Приводит файлы Claude Code проекта к harness и конфигу: CLAUDE.md рядом с каждым AGENTS.md,
 * агенты ролей, скиллы, хуки в настройках и манифест сгенерированного.
 * @param {SyncOptions} options Проект и режим.
 * @returns {Promise<SyncReport>} Что записано и удалено или, при проверке, что устарело.
 * @throws {GenerateError} Если генератор пишет поверх файлов человека или исправленных руками
 *   без `force`, конфиг отдаёт этап чужому агенту или настройки проекта не разобраны.
 */
export async function syncClaude(options: SyncOptions): Promise<SyncReport> {
  const project = await requireProject(options.projectDirectory);
  const plan = await planSync(project, options.installation, options.force === true);

  if (options.check !== true) await applySync(project, plan);

  return plan.report;
}

/** Проект, которого ещё нет на диске: корень и конфиг, который `init` только собирается записать. */
export interface PlannedProject {
  root: string;
  config: ProjectConfig;
}

/**
 * Что генератор сделает в проекте с этим конфигом, ничего не записывая: так `init` до первой
 * записи узнаёт, не придётся ли писать поверх файлов человека.
 * @param {PlannedProject} planned Корень и конфиг будущего проекта.
 * @param {ClaudeInstallation} installation Harness и шаблоны запущенной версии.
 * @returns {Promise<SyncReport>} Что появится, обновится и с чем конфликт.
 * @throws {GenerateError} Если конфиг отдаёт этап чужому агенту или настройки проекта не разобраны.
 */
export async function previewClaude(
  planned: PlannedProject,
  installation: ClaudeInstallation,
): Promise<SyncReport> {
  const project = { ...planned, journal: journalDirectory(planned.root, planned.config) };
  const plan = await planSync(project, installation, false);

  return plan.report;
}
