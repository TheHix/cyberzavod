// Project files and directories that may be missing.

import { readFile, rmdir } from "node:fs/promises";
import { isNotFound } from "@cyberzavod/storage";

/**
 * Reads a text file that may be missing.
 * @param {string} file Absolute file path.
 * @returns {Promise<string | undefined>} File text, or undefined if there is no file.
 * @throws {Error} If the file cannot be read for a reason other than "no file".
 */
export async function readOptionalText(file: string): Promise<string | undefined> {
  try {
    return await readFile(file, "utf8");
  } catch (err) {
    if (isNotFound(err)) return undefined;

    throw err;
  }
}

// `rmdir` answers a non-empty directory differently: ENOTEMPTY (Linux, macOS), EEXIST (some OSes).
const DIRECTORY_NOT_EMPTY_CODES = new Set(["ENOTEMPTY", "EEXIST"]);

function isDirectoryNotEmpty(err: unknown): boolean {
  return err instanceof Error && "code" in err && DIRECTORY_NOT_EMPTY_CODES.has(String(err.code));
}

/**
 * Removes a directory if it is empty; a non-empty or missing directory stays as it is.
 * @param {string} directory Absolute directory path.
 * @returns {Promise<void>} Done when the directory is removed or there is nothing to remove.
 * @throws {Error} If removal fails for another reason.
 */
export async function removeDirectoryIfEmpty(directory: string): Promise<void> {
  try {
    await rmdir(directory);
  } catch (err) {
    if (isNotFound(err) || isDirectoryNotEmpty(err)) return;

    throw err;
  }
}
