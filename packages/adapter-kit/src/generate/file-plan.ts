// Planning and carrying out the writes and removals of generated files: what is generated anew is
// overwritten; what was generated earlier and is no longer needed is deleted; what the human wrote
// is not touched without explicit permission. The agents differ in which files they generate and
// where they look for earlier ones.

import { mkdir, readdir, readFile, rm, rmdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { isNotFound } from "@cyberzavod/storage";
import { KitError } from "../errors.ts";
import { contentHash, type Manifest } from "./manifest.ts";
import { isGenerated, type GeneratedFile } from "./marks.ts";

const SKIPPED_DIRECTORIES = new Set(["node_modules"]);

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

/**
 * Path from the root with `/`.
 * @param {string} root Project root.
 * @param {string} target Path on disk inside the root.
 * @returns {string} Path from the root with `/`.
 */
export function relativeTo(root: string, target: string): string {
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

/**
 * Directories containing a file with this name; hidden directories, dependencies and the skipped
 * directory (the project journal) are not scanned.
 * @param {string} root Project root.
 * @param {string} fileName File name, for example `AGENTS.md`.
 * @param {string} skipped Absolute path of a directory not to look into.
 * @returns {Promise<string[]>} Directories from the root with `/` in order; the root is an empty
 *   string.
 */
export async function directoriesWith(
  root: string,
  fileName: string,
  skipped: string,
): Promise<string[]> {
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

// Line ending conversion on git checkout on Windows does not make a file outdated.
function withUnixNewlines(text: string): string {
  return text.replace(/\r\n/g, "\n");
}

function sameText(left: string, right: string): boolean {
  return withUnixNewlines(left) === withUnixNewlines(right);
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

/** Where earlier generated files of one kind lie: a directory and the file extensions in it. */
export interface CandidateSource {
  /** Directory from the root with `/`. */
  directory: string;
  /** Extensions with the dot: `.md`. */
  extensions: readonly string[];
}

async function filesUnder(root: string, source: CandidateSource): Promise<string[]> {
  const entries = await readdir(path.join(root, source.directory), { recursive: true }).catch(
    ignoreMissing,
  );
  const matching = entries.filter((entry) =>
    source.extensions.some((extension) => entry.endsWith(extension)),
  );

  return matching.map((entry) => `${source.directory}/${toPosix(entry)}`);
}

/**
 * Files the generator wrote earlier: those under the agent's directories, the listed extra ones
 * and those from the manifest.
 * @param {string} root Project root.
 * @param {Manifest} manifest Manifest of generated output.
 * @param {readonly CandidateSource[]} sources Directories of the agent's generated files.
 * @param {readonly string[]} extra Further paths from the root with `/`, for example the
 *   entrypoint files next to each AGENTS.md.
 * @returns {Promise<string[]>} Paths from the root with `/`; the file at a path may be gone.
 */
export async function generatedCandidates(
  root: string,
  manifest: Manifest,
  sources: readonly CandidateSource[],
  extra: readonly string[],
): Promise<string[]> {
  const found = await Promise.all(sources.map((source) => filesUnder(root, source)));

  return [...new Set([...extra, ...found.flat(), ...Object.keys(manifest.files)])];
}

/** File in place of a generated one, and whose it is. */
export interface FileOnDisk {
  path: string;
  ownership: Ownership;
}

/**
 * Whose files stand at the paths.
 * @param {string} root Project root.
 * @param {readonly string[]} paths Paths from the root with `/`.
 * @param {Manifest} manifest Manifest of generated output.
 * @returns {Promise<FileOnDisk[]>} A file with its owner per path.
 */
export async function filesOnDisk(
  root: string,
  paths: readonly string[],
  manifest: Manifest,
): Promise<FileOnDisk[]> {
  return Promise.all(
    paths.map(async (file) => {
      const text = await readOptional(fileAt(root, file));

      return { path: file, ownership: ownershipOf(file, text, manifest) };
    }),
  );
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

/** What to plan: the files the generator wants to write, and what stands in their way. */
export interface PlanSource {
  /** Project root. */
  root: string;
  /** Files the generator wants to write. */
  files: readonly GeneratedFile[];
  manifest: Manifest;
  /** Overwrite files written by the human rather than the generator. */
  force: boolean;
  /**
   * Files the generator edits only its own part of (hooks file, manifest): one that is present is
   * never the human's.
   */
  sharedFiles: ReadonlySet<string>;
  /** Paths where earlier generated files may lie, from `generatedCandidates`. */
  candidates: readonly string[];
}

/** What the generator will do with the project files, without writing. */
export interface SyncPlan {
  report: SyncReport;
  files: readonly GeneratedFile[];
}

async function plannedWrites({ root, files, manifest, force, sharedFiles }: PlanSource) {
  const outcomes: Record<WriteOutcome, string[]> = {
    added: [],
    updated: [],
    conflict: [],
    edited: [],
  };

  for (const file of files) {
    const current = await readOptional(fileAt(root, file.path));

    if (current !== undefined && sameText(current, file.content)) continue;

    const isSharedPresent = sharedFiles.has(file.path) && current !== undefined;
    const ownership = isSharedPresent ? "generated" : ownershipOf(file.path, current, manifest);

    outcomes[writeOutcomeOf(ownership, force)].push(file.path);
  }

  return outcomes;
}

async function plannedRemovals({ root, files, manifest, force, candidates }: PlanSource) {
  const wanted = new Set(files.map(({ path: filePath }) => filePath));
  const obsolete = candidates.filter((file) => !wanted.has(file));
  const onDisk = await filesOnDisk(root, obsolete, manifest);
  const removed = onDisk
    .filter(({ ownership }) => ownership === "generated" || (ownership === "edited" && force))
    .map((file) => file.path);
  const edited = onDisk
    .filter(({ ownership }) => ownership === "edited" && !force)
    .map((file) => file.path);

  return { removed: removed.sort(), edited };
}

/**
 * What the generator will do with the files: write, overwrite, delete, leave alone.
 * @param {PlanSource} source Files, manifest, mode and where earlier files may lie.
 * @returns {Promise<SyncPlan>} The report and the files to write.
 */
export async function planSyncFiles(source: PlanSource): Promise<SyncPlan> {
  const writes = await plannedWrites(source);
  const removals = await plannedRemovals(source);
  const report: SyncReport = {
    added: writes.added,
    updated: writes.updated,
    removed: removals.removed,
    conflicts: writes.conflict,
    edited: [...writes.edited, ...removals.edited],
  };

  return { report, files: source.files };
}

/**
 * Checks that the generator can write everything in the report: no human-written or hand-edited
 * files stand where its files go.
 * @param {SyncReport} report Comparison report.
 * @throws {KitError} If there are such files: the message lists them.
 */
export function requireWritable(report: SyncReport): void {
  const blocked = [...report.conflicts, ...report.edited];

  if (blocked.length === 0) return;

  const list = blocked.join(", ");

  throw new KitError((messages) => messages.errors.fileConflicts(list));
}

/**
 * Carries out the plan: writes what is new and outdated, deletes what is extra.
 * @param {string} root Project root.
 * @param {SyncPlan} plan Plan from `planSyncFiles`.
 * @throws {KitError} If the plan has files the generator may not touch.
 */
export async function applySyncPlan(root: string, plan: SyncPlan): Promise<void> {
  const { report, files } = plan;

  requireWritable(report);

  const written = [...report.added, ...report.updated];

  for (const file of files.filter(({ path: filePath }) => written.includes(filePath))) {
    const target = fileAt(root, file.path);

    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, file.content);
  }

  for (const filePath of report.removed) await rm(fileAt(root, filePath));
}

/**
 * Removes emptied directories from the file upward, but not above the boundaries: `rmdir` leaves
 * alone a directory where something remains.
 * @param {string} root Project root.
 * @param {string} file Path on disk of the file that was removed.
 * @param {readonly string[]} boundaries Directories from the root with `/` the cleanup stays
 *   inside, the directory of the adapter's files.
 * @returns {Promise<void>} Done when the cleanup stops.
 */
export async function removeEmptyParents(
  root: string,
  file: string,
  boundaries: readonly string[],
): Promise<void> {
  const inside = boundaries.map((boundary) => fileAt(root, boundary));
  const isInside = (directory: string) =>
    inside.some(
      (boundary) => directory === boundary || directory.startsWith(`${boundary}${path.sep}`),
    );
  let directory = path.dirname(file);

  while (isInside(directory)) {
    const isRemoved = await rmdir(directory).then(
      () => true,
      () => false,
    );

    if (!isRemoved) return;

    directory = path.dirname(directory);
  }
}

/**
 * Deletes the files with the emptied directories around them.
 * @param {string} root Project root.
 * @param {readonly string[]} files Paths from the root with `/`.
 * @param {readonly string[]} boundaries Directories the cleanup of empty parents stays inside.
 * @returns {Promise<void>} Done when the files are gone.
 */
export async function removeGeneratedFiles(
  root: string,
  files: readonly string[],
  boundaries: readonly string[],
): Promise<void> {
  for (const file of files) {
    const target = fileAt(root, file);

    await rm(target);
    await removeEmptyParents(root, target, boundaries);
  }
}
