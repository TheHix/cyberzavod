// The project marker on disk: `.cyberzavod/project.json` in the repository root. The CLI,
// adapters and hooks use it to find the project and its journal.

import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  parseProjectConfig,
  PROJECT_CONFIG_SCHEMA_VERSION,
  type ProjectConfig,
} from "@cyberzavod/core";

/** Marker directory relative to the project root. */
export const MARKER_DIRECTORY = ".cyberzavod";

/** Project config path relative to its root. */
export const PROJECT_CONFIG_FILE = path.join(MARKER_DIRECTORY, "project.json");

/**
 * The built CLI inside the project before version 0.8.0, from the root with `/`: the file the hooks
 * ran was put there. Now hooks go through npx, `sync` deletes this file, and the adapter uses it
 * to recognize hooks of earlier versions.
 */
export const LEGACY_TOOL_FILE = `${MARKER_DIRECTORY}/bin/cyberzavod.mjs`;

/** Default project journal, from the root with `/`: next to the config, in the project repo. */
export const DEFAULT_JOURNAL = `${MARKER_DIRECTORY}/journal`;

/** Project config read error: the file exists but cannot be read or failed validation. */
export class ProjectFileError extends Error {}

const FILE_NOT_FOUND = "ENOENT";
const NOT_A_DIRECTORY = "ENOTDIR";

function hasErrorCode(err: unknown, code: string): boolean {
  return err instanceof Error && "code" in err && err.code === code;
}

/**
 * Tells "no file" apart from other file system errors.
 * @param {unknown} err An error from node:fs.
 * @returns {boolean} true if the file or directory does not exist.
 */
export function isNotFound(err: unknown): boolean {
  return hasErrorCode(err, FILE_NOT_FOUND);
}

// The path may go through a file (ENOTDIR): when looking for the marker that is also "no file".
function isMissing(err: unknown): boolean {
  return isNotFound(err) || hasErrorCode(err, NOT_A_DIRECTORY);
}

/**
 * Reads the project config from its root.
 * @param {string} root Project root.
 * @returns {Promise<ProjectConfig | undefined>} The config, or undefined if there is no marker.
 * @throws {ProjectFileError} If the file exists but is not JSON or failed validation.
 */
export async function readProjectConfig(root: string): Promise<ProjectConfig | undefined> {
  const configPath = path.join(root, PROJECT_CONFIG_FILE);
  let text: string;

  try {
    text = await readFile(configPath, "utf8");
  } catch (err) {
    if (isMissing(err)) return undefined;

    throw new ProjectFileError(`${configPath} cannot be read`, { cause: err });
  }

  try {
    return parseProjectConfig(JSON.parse(text));
  } catch (err) {
    throw new ProjectFileError(`${configPath}: ${(err as Error).message}`, { cause: err });
  }
}

/**
 * Finds a directory's project: walks up from it to the first marker.
 * @param {string} directory Directory the search starts from.
 * @returns {Promise<string | undefined>} Project root, or undefined if there is no marker up to the
 *   disk root.
 * @throws {Error} If the path cannot be read for a reason other than "no file".
 */
export async function findProjectRoot(directory: string): Promise<string | undefined> {
  for (let current = path.resolve(directory); ; current = path.dirname(current)) {
    if (await isFile(path.join(current, PROJECT_CONFIG_FILE))) return current;
    if (path.dirname(current) === current) return undefined;
  }
}

async function isFile(file: string): Promise<boolean> {
  try {
    const stats = await stat(file);

    return stats.isFile();
  } catch (err) {
    if (isMissing(err)) return false;

    throw err;
  }
}

/**
 * Writes the project config to its root, creating the marker directory; the file format version
 * comes as the first field.
 * @param {string} root Project root.
 * @param {ProjectConfig} config The validated config.
 * @returns {Promise<void>} Resolves when the file is written.
 */
export async function writeProjectConfig(root: string, config: ProjectConfig): Promise<void> {
  await mkdir(path.join(root, MARKER_DIRECTORY), { recursive: true });
  const document = { schemaVersion: PROJECT_CONFIG_SCHEMA_VERSION, ...config };

  await writeFile(path.join(root, PROJECT_CONFIG_FILE), `${JSON.stringify(document, null, 2)}\n`);
}
