// Проверки проекта для хуков: что запускать и правки в каких каталогах этого требуют.

import { closeSync, openSync, readFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import type { ProjectConfig } from "@cyberzavod/core";

/** Проверки проекта: одна команда и каталоги с кодом, за которыми следят хуки. */
export interface ProjectChecks {
  command: string;
  paths: string[];
}

/** Итог прогона проверок: прошли ли они и что напечатали. */
export interface ChecksRun {
  passed: boolean;
  output: string;
}

const WHOLE_REPOSITORY = ".";
// `&&` понимают и sh, и cmd.exe: первая красная команда останавливает остальные.
const COMMAND_SEPARATOR = " && ";

/**
 * Проверки из конфига проекта.
 * @param {ProjectConfig} config Конфиг проекта.
 * @returns {ProjectChecks | undefined} Проверки или undefined, если команд нет.
 */
export function checksOf(config: ProjectConfig): ProjectChecks | undefined {
  const { commands, paths } = config.verification;

  if (commands.length === 0) return undefined;

  return {
    command: commands.join(COMMAND_SEPARATOR),
    paths: paths.length === 0 ? [WHOLE_REPOSITORY] : paths,
  };
}

/**
 * Запускает проверки оболочкой системы в корне проекта. Вывод идёт в файл, а не в канал: так
 * stdout и stderr ложатся в одном порядке, как их печатала команда.
 * @param {ProjectChecks} checks Проверки проекта.
 * @param {string} root Корень проекта.
 * @param {string} outputFile Временный файл для вывода; после прогона удаляется.
 * @returns {ChecksRun} Прошли ли проверки и их вывод.
 */
export function runChecks(checks: ProjectChecks, root: string, outputFile: string): ChecksRun {
  const output = openSync(outputFile, "w");

  try {
    const result = spawnSync(checks.command, {
      cwd: root,
      shell: true,
      stdio: ["ignore", output, output],
    });
    const printed = readFileSync(outputFile, "utf8");

    if (result.error !== undefined) {
      return { passed: false, output: `${printed}${result.error.message}\n` };
    }

    return { passed: result.status === 0, output: printed };
  } finally {
    closeSync(output);
    rmSync(outputFile, { force: true });
  }
}
