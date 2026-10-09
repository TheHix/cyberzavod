// Adapter working files (raw session logs and drafts) carry the original prompt texts:
// they do not go into the project's git.

import { appendFile } from "node:fs/promises";
import path from "node:path";
import { CAPTURE_DIRECTORY } from "@cyberzavod/storage";
import { readOptionalText } from "../files.ts";

/** The git file where `init` appends a line about ignored working files. */
export const GITIGNORE_FILE = ".gitignore";

/**
 * The `.gitignore` line for adapter working files, if the journal is inside the project.
 * @param {string} journal Journal directory from the project root, with `/` separators.
 * @returns {string | undefined} The line, or undefined if the journal is outside the project and
 *   there is nothing to ignore.
 */
export function captureIgnoreEntry(journal: string): string | undefined {
  const relative = path.posix.normalize(journal);

  if (relative.startsWith("..") || path.isAbsolute(journal)) return undefined;

  return `/${relative}/${CAPTURE_DIRECTORY}/`;
}

function hasEntryIn(text: string | undefined, entry: string): boolean {
  return text?.split(/\r?\n/).includes(entry) === true;
}

/**
 * Whether the project's `.gitignore` has exactly this line.
 * @param {string} root Project root.
 * @param {string} entry Line for `.gitignore`.
 * @returns {Promise<boolean>} true if the line is there; no file means false.
 */
export async function hasIgnoreEntry(root: string, entry: string): Promise<boolean> {
  const current = await readOptionalText(path.join(root, GITIGNORE_FILE));

  return hasEntryIn(current, entry);
}

/**
 * Appends a line to the project's `.gitignore`.
 * @param {string} root Project root.
 * @param {string} entry Line for `.gitignore`.
 * @returns {Promise<boolean>} true if the line was added; false if it was already there.
 */
export async function appendIgnoreEntry(root: string, entry: string): Promise<boolean> {
  const file = path.join(root, GITIGNORE_FILE);
  const current = await readOptionalText(file);

  if (hasEntryIn(current, entry)) return false;

  const separator = current === undefined || current.endsWith("\n") ? "" : "\n";

  await appendFile(file, `${separator}${entry}\n`);

  return true;
}
