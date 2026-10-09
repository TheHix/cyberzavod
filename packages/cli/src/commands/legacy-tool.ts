// The built CLI of earlier versions: before 0.8.0 `init` and `sync` put it into the project, and
// hooks ran from there. Now hooks go through npx, and `sync` removes this file.

import { rm, stat } from "node:fs/promises";
import path from "node:path";
import { isNotFound, LEGACY_TOOL_FILE } from "@cyberzavod/storage";
import { removeDirectoryIfEmpty } from "../files.ts";

function legacyToolPath(root: string): string {
  return path.join(root, ...LEGACY_TOOL_FILE.split("/"));
}

/**
 * Checks whether the project holds the built CLI of earlier versions.
 * @param {string} root Project root.
 * @returns {Promise<boolean>} true if the file is in place.
 * @throws {Error} If the file cannot be read for a reason other than "no file".
 */
export async function hasLegacyTool(root: string): Promise<boolean> {
  try {
    await stat(legacyToolPath(root));

    return true;
  } catch (err) {
    if (isNotFound(err)) return false;

    throw err;
  }
}

/**
 * Removes the built CLI of earlier versions and the `bin` directory if nothing else is in it.
 * @param {string} root Project root.
 * @returns {Promise<void>} Done when the file is removed.
 * @throws {Error} If removal fails for a reason other than "no file" or "directory not empty".
 */
export async function removeLegacyTool(root: string): Promise<void> {
  const file = legacyToolPath(root);

  await rm(file, { force: true });
  await removeDirectoryIfEmpty(path.dirname(file));
}
