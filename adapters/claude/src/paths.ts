// Where the adapter keeps its files: raw session logs and drafts live in the project journal's
// `capture/claude/`. The shared part (finding the project) lives in the adapter kit.

import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import {
  captureDirectories as kitCaptureDirectories,
  locateProject,
  type CaptureDirectories,
} from "@cyberzavod/adapter-kit";
import { isNotFound, ProjectFileError } from "@cyberzavod/storage";
import type { ClaudeMessages } from "./messages/claude-messages.ts";
import { CLAUDE_AGENT } from "./generate/claude.ts";

/**
 * Adapter directories in the project journal.
 * @param {string} journal Absolute path of the project journal.
 * @returns {CaptureDirectories} Directories of raw logs and drafts.
 */
export function captureDirectories(journal: string): CaptureDirectories {
  return kitCaptureDirectories(journal, CLAUDE_AGENT);
}

/**
 * Finds the directory's project: walks up from it to the first marker. No marker anywhere up the
 * path means the directory belongs to no project; a broken config means a warning.
 * @param {string} directory Absolute path of the directory; it may no longer exist.
 * @param {ClaudeMessages} messages Messages in the chosen language.
 * @returns {Promise<string | undefined>} `projectId`, or undefined if there is no project.
 */
export async function findProjectId(
  directory: string,
  messages: ClaudeMessages,
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
