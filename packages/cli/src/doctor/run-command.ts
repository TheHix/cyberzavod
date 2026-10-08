// Настоящий запуск команд проверок для `doctor --run-checks`.

import { spawnSync } from "node:child_process";
import type { CommandRun, CommandRunner } from "./check.ts";

/**
 * Запускает команду оболочкой системы в корне проекта, вывод отбрасывает.
 * @param {string} command Команда проверки из конфига.
 * @param {string} root Корень проекта.
 * @returns {CommandRun} Код выхода или причина, по которой команда не запустилась.
 */
export const runCommandInShell: CommandRunner = (command, root) => {
  const result = spawnSync(command, { cwd: root, shell: true, stdio: "ignore" });

  if (result.error !== undefined) return { kind: "notStarted", reason: result.error.message };

  if (result.status === null) return { kind: "notStarted", reason: String(result.signal) };

  return { kind: "exited", code: result.status };
};
