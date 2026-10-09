// Syncs the project's Claude Code files with the harness and config: what is generated anew is
// overwritten; what was generated earlier and is no longer needed is deleted; what the human wrote
// is not touched without explicit permission.

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

/** What to generate from: the harness and templates of the running Cyberzavod version. */
export interface ClaudeInstallation {
  harness: Harness;
  templates: ClaudeTemplates;
}

/** What to do: only compare or write, and whether what the human wrote may be overwritten. */
export interface SyncOptions {
  /** Directory inside the project. */
  projectDirectory: string;
  installation: ClaudeInstallation;
  /** Only compare the files on disk with the generated ones, writing nothing. */
  check?: boolean;
  /** Overwrite files written by the human rather than the generator. */
  force?: boolean;
}

/** Sync outcome: paths from the project root with `/`. */
export interface SyncReport {
  /** Files that did not exist and were written (or, in a check, will appear). */
  added: string[];
  /** Generated files that were overwritten (or, in a check, are outdated). */
  updated: string[];
  /** Previously generated files that were deleted (or, in a check, are extra). */
  removed: string[];
  /** Files written by the human where the generator writes its own. */
  conflicts: string[];
  /** Generated files edited by hand: without `force` the generator leaves them alone. */
  edited: string[];
}

function toPosix(relative: string): string {
  return relative.split(path.sep).join("/");
}

function relativeTo(root: string, target: string): string {
  return toPosix(path.relative(root, target));
}

/**
 * Path of a file on disk from its path from the project root with `/`.
 * @param {string} root Project root.
 * @param {string} relative Path from the root with `/`.
 * @returns {string} Path on disk.
 */
export function fileAt(root: string, relative: string): string {
  return path.join(root, ...relative.split("/"));
}

/**
 * Reads a text file if it exists.
 * @param {string} file Path on disk.
 * @returns {Promise<string | undefined>} The contents, or undefined if there is no file.
 * @throws {Error} If the file cannot be read for another reason.
 */
export async function readOptional(file: string): Promise<string | undefined> {
  try {
    return await readFile(file, "utf8");
  } catch (err) {
    if (isNotFound(err)) return undefined;

    throw err;
  }
}

// Directories containing a file with this name; hidden directories, dependencies and the project
// journal are not scanned.
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

// Line ending conversion on git checkout on Windows does not make a file outdated.
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
 * Whose file is in place of a generated one: there is none; generated and untouched; generated but
 * edited by hand; written by the human. The manifest fingerprint outranks the mark: a hand edit
 * does not remove the mark.
 */
export type Ownership = "missing" | "generated" | "edited" | "human";

/**
 * Whose file is in place of a generated one.
 * @param {string} file Path from the root with `/`.
 * @param {string | undefined} text Contents; undefined if there is no file.
 * @param {Manifest} manifest Manifest of generated output.
 * @returns {Ownership} No file, generated, edited by hand, or written by the human.
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
 * Files the generator wrote earlier: with the generated mark or from the manifest.
 * @param {LocatedProject} project Project.
 * @param {Manifest} manifest Manifest of generated output.
 * @returns {Promise<string[]>} Paths from the root with `/`; the file at a path may be gone.
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

/** File in place of a generated one, and whose it is. */
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

/** What the generator will do with the project files, without writing. */
interface SyncPlan {
  report: SyncReport;
  files: GeneratedFile[];
}

/** What the generator does with a file it wants to write. */
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

// Settings and manifest are shared: the generator edits only its part of the settings; the
// manifest is its own.
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
 * Reads the manifest of generated output from the project.
 * @param {string} root Project root.
 * @returns {Promise<Manifest>} The manifest; empty if there is no file.
 * @throws {GenerateError} If the manifest cannot be parsed.
 */
export async function readManifest(root: string): Promise<Manifest> {
  return parseManifest(await readOptional(fileAt(root, MANIFEST_FILE)));
}

/**
 * Reads the project's Claude Code settings.
 * @param {string} root Project root.
 * @returns {Promise<Settings>} The settings; an empty object if there is no file.
 * @throws {GenerateError} If the file is not JSON or not an object.
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
 * Checks that the generator can write everything in the report: no human-written or hand-edited
 * files stand where its files go.
 * @param {SyncReport} report Comparison report.
 * @throws {GenerateError} If there are such files: the message lists them.
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
 * Brings the project's Claude Code files in line with the harness and config: CLAUDE.md next to
 * each AGENTS.md, role agents, skills, hooks in the settings, and the manifest of generated output.
 * @param {SyncOptions} options Project and mode.
 * @returns {Promise<SyncReport>} What was written and deleted or, in a check, what is outdated.
 * @throws {GenerateError} If the generator would write over human-written or hand-edited files
 *   without `force`, the config assigns a stage to another agent, or the project settings cannot
 *   be parsed.
 */
export async function syncClaude(options: SyncOptions): Promise<SyncReport> {
  const project = await requireProject(options.projectDirectory);
  const plan = await planSync(project, options.installation, options.force === true);

  if (options.check !== true) await applySync(project, plan);

  return plan.report;
}

/** Project not yet on disk: the root and the config that `init` is about to write. */
export interface PlannedProject {
  root: string;
  config: ProjectConfig;
}

/**
 * What the generator will do in the project with this config, writing nothing: this way `init`
 * learns before its first write whether it would have to write over the human's files.
 * @param {PlannedProject} planned Root and config of the future project.
 * @param {ClaudeInstallation} installation Harness and templates of the running version.
 * @returns {Promise<SyncReport>} What will appear, what will be updated, and what conflicts.
 * @throws {GenerateError} If the config assigns a stage to another agent or the project settings
 *   cannot be parsed.
 */
export async function previewClaude(
  planned: PlannedProject,
  installation: ClaudeInstallation,
): Promise<SyncReport> {
  const project = { ...planned, journal: journalDirectory(planned.root, planned.config) };
  const plan = await planSync(project, installation, false);

  return plan.report;
}
