// Отпечаток кода для хуков: по нему хук остановки понимает, менял ли агент код в этом ходе.

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

/** Ошибка git: его нет или он не смог выполнить команду. */
export class GitError extends Error {}

const FINGERPRINT_ALGORITHM = "sha256";
// Дифф большого репозитория не влезает в буфер spawnSync по умолчанию.
const GIT_OUTPUT_LIMIT_BYTES = 256 * 1024 * 1024;
const NUL = "\0";

// Код выхода не проверяется: в репозитории без коммитов `rev-parse HEAD` и `diff HEAD` падают,
// но и тогда их вывод одинаков между вызовами, а отпечатку этого достаточно.
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
 * Отпечаток кода в каталогах: текущий коммит, незакоммиченные правки и содержимое новых файлов.
 * Коммит входит в отпечаток, чтобы правки, закоммиченные внутри хода, тоже считались изменением.
 * @param {string} root Корень репозитория.
 * @param {string[]} paths Каталоги с кодом относительно корня.
 * @returns {string} Отпечаток.
 * @throws {GitError} Если git не запускается.
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
 * Есть ли в каталогах незакоммиченные правки или новые файлы.
 * @param {string} root Корень репозитория.
 * @param {string[]} paths Каталоги с кодом относительно корня.
 * @returns {boolean} true, если рабочая копия в каталогах не чистая.
 * @throws {GitError} Если git не запускается.
 */
export function hasUncommittedChanges(root: string, paths: string[]): boolean {
  return gitOutput(root, ["status", "--porcelain", "--", ...paths]).trim() !== "";
}
