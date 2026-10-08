// Общий исход обеих проверок команд: в конфиге нет ни одной команды проверки.

import { PROJECT_CONFIG_FILE } from "@cyberzavod/storage";
import type { CliMessages } from "../messages/cli-messages.ts";
import { failed, type CheckResult } from "./check.ts";

/**
 * Ошибка «команды проверок не заданы».
 * @param {CliMessages} messages Сообщения на выбранном языке.
 * @returns {CheckResult} Результат `failed` с подсказкой.
 */
export function noCommandsResult(messages: CliMessages): CheckResult {
  return failed({
    problem: messages.doctor.commands.noneSet(PROJECT_CONFIG_FILE),
    fix: messages.doctor.commands.setUp(PROJECT_CONFIG_FILE),
  });
}
