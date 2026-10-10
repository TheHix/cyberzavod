// Where the adapters keep their files: raw session logs and drafts live in the project journal's
// `capture/<agent>/`. The project config sets the journal directory, so the journal can live
// inside the repository or next to it.

import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import {
  CAPTURE_DIRECTORY,
  findProjectRoot,
  isNotFound,
  journalDirectory,
  ProjectFileError,
  readProjectConfig,
} from "@cyberzavod/storage";
import type { ProjectConfig } from "@cyberzavod/core";
import { KitError } from "./errors.ts";
import type { KitMessages } from "./messages/kit-messages.ts";

/** Adapter directories in the project journal: raw session logs and recording drafts. */
export interface CaptureDirectories {
  raw: string;
  drafts: string;
}

/**
 * Adapter directories in the project journal.
 * @param {string} journal Absolute path of the project journal.
 * @param {string} agent Agent name: its files live in `capture/<agent>/`.
 * @returns {CaptureDirectories} Directories of raw logs and drafts.
 */
export function captureDirectories(journal: string, agent: string): CaptureDirectories {
  const capture = path.join(journal, CAPTURE_DIRECTORY, agent);

  return { raw: path.join(capture, "raw"), drafts: path.join(capture, "drafts") };
}

/** Project found on disk: root, config and journal. */
export interface LocatedProject {
  root: string;
  config: ProjectConfig;
  journal: string;
}

/**
 * Finds the directory's project and its journal.
 * @param {string} directory Directory inside the project.
 * @returns {Promise<LocatedProject | undefined>} The project, or undefined if there is no marker.
 * @throws {ProjectFileError} If the project config is broken.
 */
export async function locateProject(directory: string): Promise<LocatedProject | undefined> {
  const root = await findProjectRoot(directory);

  if (root === undefined) return undefined;

  const config = await readProjectConfig(root);

  if (config === undefined) return undefined;

  return { root, config, journal: journalDirectory(root, config) };
}

/**
 * Finds the directory's project for a command that has nothing to do without one.
 * @param {string} directory Directory inside the project.
 * @returns {Promise<LocatedProject>} The project.
 * @throws {KitError} If there is no marker anywhere up the path.
 * @throws {ProjectFileError} If the project config is broken.
 */
export async function requireProject(directory: string): Promise<LocatedProject> {
  const project = await locateProject(directory);

  if (project === undefined) {
    throw new KitError((messages) => messages.errors.projectNotFound(directory));
  }

  return project;
}

/** Project not yet on disk: the root and the config that `init` is about to write. */
export interface PlannedProject {
  root: string;
  config: ProjectConfig;
}

/**
 * The project as if the config were already written.
 * @param {PlannedProject} planned Root and config of the future project.
 * @returns {LocatedProject} The project with its journal.
 */
export function locatedFromPlanned(planned: PlannedProject): LocatedProject {
  return { ...planned, journal: journalDirectory(planned.root, planned.config) };
}

/**
 * Finds the directory's project: walks up from it to the first marker. No marker anywhere up the
 * path means the directory belongs to no project; a broken config means a warning.
 * @param {string} directory Absolute path of the directory; it may no longer exist.
 * @param {KitMessages} messages Messages in the chosen language.
 * @returns {Promise<string | undefined>} `projectId`, or undefined if there is no project.
 */
export async function findProjectId(
  directory: string,
  messages: KitMessages,
): Promise<string | undefined> {
  try {
    return (await locateProject(directory))?.config.projectId;
  } catch (err) {
    if (!(err instanceof ProjectFileError)) throw err;

    console.warn(messages.draft.configNotRead(err.message));

    return undefined;
  }
}

// No directory yet means no files in it either; other errors are not swallowed.
async function filesIn(dir: string): Promise<string[]> {
  try {
    return await readdir(dir);
  } catch (err) {
    if (isNotFound(err)) return [];

    throw err;
  }
}

async function modifiedAt(file: string): Promise<number> {
  const { mtimeMs } = await stat(file);

  return mtimeMs;
}

/**
 * Finds the most recently modified file with the extension in a directory.
 * @param {string} dir Directory; if it does not exist, it has no files either.
 * @param {string} extension Extension with the dot: `.jsonl`.
 * @returns {Promise<string | undefined>} Path to the file, or undefined if none matches.
 */
export async function newestFile(dir: string, extension: string): Promise<string | undefined> {
  const names = (await filesIn(dir)).filter((name) => name.endsWith(extension));
  const withTimes = await Promise.all(
    names.map(async (name) => ({ name, mtime: await modifiedAt(path.join(dir, name)) })),
  );
  const [newest] = withTimes.sort((a, b) => b.mtime - a.mtime);

  return newest === undefined ? undefined : path.join(dir, newest.name);
}
