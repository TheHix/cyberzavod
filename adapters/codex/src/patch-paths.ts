// Files an `apply_patch` patch touches, read from its headers. The patch text itself never leaves
// the hook: the recording and the guard need only the paths.

const PATCH_HEADER = /^\*\*\* (?:Add File|Update File|Delete File|Move to): (.+)$/;

/**
 * Paths named in the headers of a patch: `*** Add File:`, `*** Update File:`, `*** Delete File:`
 * and `*** Move to:`.
 * @param {string} patch Text of an `apply_patch` call.
 * @returns {string[]} Paths as the patch writes them, in order of appearance.
 */
export function patchPaths(patch: string): string[] {
  return patch.split("\n").flatMap((line) => {
    const [, file] = PATCH_HEADER.exec(line.trimEnd()) ?? [];

    return file === undefined ? [] : [file];
  });
}
