// Code fingerprint for hooks: it tells the stop hook whether the agent changed code in this turn.

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

/** Git error: git is missing or could not run the command. */
export class GitError extends Error {}

const FINGERPRINT_ALGORITHM = "sha256";
// The diff of a large repository does not fit into spawnSync's default buffer.
const GIT_OUTPUT_LIMIT_BYTES = 256 * 1024 * 1024;
const NUL = "\0";

// The exit code is not checked: in a repository without commits `rev-parse HEAD` and `diff HEAD`
// fail, but even then their output is the same between calls, which is enough for a fingerprint.
function gitOutput(root: string, args: string[]): string {
  const result = spawnSync("git", args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: GIT_OUTPUT_LIMIT_BYTES,
  });

  if (result.error !== undefined) {
    throw new GitError(`git ${args.join(" ")}: ${result.error.message}`, { cause: result.error });
  }

  return result.stdout;
}

function untrackedFiles(root: string, paths: string[]): string[] {
  const listed = gitOutput(root, [
    "ls-files",
    "--others",
    "--exclude-standard",
    "-z",
    "--",
    ...paths,
  ]);

  return listed.split(NUL).filter((file) => file !== "");
}

/**
 * Fingerprint of the code in the directories: the current commit, uncommitted changes and the
 * contents of new files. The commit is included so that changes committed within the turn also
 * count as a change.
 * @param {string} root Repository root.
 * @param {string[]} paths Code directories relative to the root.
 * @returns {string} The fingerprint.
 * @throws {GitError} If git does not start.
 */
export function codeFingerprint(root: string, paths: string[]): string {
  const hash = createHash(FINGERPRINT_ALGORITHM);

  hash.update(gitOutput(root, ["rev-parse", "HEAD"]));
  hash.update(gitOutput(root, ["diff", "HEAD", "--", ...paths]));

  for (const file of untrackedFiles(root, paths)) {
    hash.update(`${file}${NUL}`);
    hash.update(readFileSync(path.join(root, file)));
  }

  return hash.digest("hex");
}

/**
 * Whether the directories have uncommitted changes or new files.
 * @param {string} root Repository root.
 * @param {string[]} paths Code directories relative to the root.
 * @returns {boolean} true if the working copy in the directories is not clean.
 * @throws {GitError} If git does not start.
 */
export function hasUncommittedChanges(root: string, paths: string[]): boolean {
  return gitOutput(root, ["status", "--porcelain", "--", ...paths]).trim() !== "";
}
