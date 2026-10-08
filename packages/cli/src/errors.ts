// Ошибки, которые CLI показывает человеку сообщением, а не трассой стека.

import { DEFAULT_INTERFACE_LANGUAGE, type LocalizedText } from "@cyberzavod/core";
import { CLI_MESSAGES } from "./messages/catalog.ts";
import type { CliMessages } from "./messages/cli-messages.ts";

/**
 * Ошибка команды: человек получает сообщение, а не трассу стека. Текст хранится функцией от
 * каталога сообщений, язык выбирает тот, кто печатает; `message` — на английском.
 */
export class CommandError extends Error {
  readonly describe: LocalizedText<CliMessages>;

  /**
   * Ошибка с текстом на любом языке интерфейса.
   * @param {LocalizedText<CliMessages>} describe Текст ошибки по набору сообщений.
   * @param {ErrorOptions} [options] Причина ошибки.
   */
  constructor(describe: LocalizedText<CliMessages>, options?: ErrorOptions) {
    super(describe(CLI_MESSAGES[DEFAULT_INTERFACE_LANGUAGE]), options);
    this.describe = describe;
  }
}
