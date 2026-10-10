// Where the adapters keep their files: raw session logs and drafts live in the project journal's
// `capture/<agent>/`. The project config sets the journal directory, so the journal can live
// inside the repository or next to it.

import path from "node:path";
import {
  CAPTURE_DIRECTORY,
  findProjectRoot,
  journalDirectory,
  readProjectConfig,
  type ProjectFileError,
} from "@cyberzavod/storage";
import type { ProjectConfig } from "@cyberzavod/core";
import { KitError } from "./errors.ts";

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
