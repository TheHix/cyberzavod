// Ошибки адаптера, которые CLI показывает человеку сообщением, а не трассой стека.

import { DEFAULT_INTERFACE_LANGUAGE, type LocalizedText } from "@cyberzavod/core";
import { CLAUDE_MESSAGES } from "./messages/catalog.ts";
import type { ClaudeMessages } from "./messages/claude-messages.ts";

/**
 * Ошибка адаптера: человек получает сообщение, а не трассу стека. Текст хранится функцией от
 * каталога сообщений, язык выбирает тот, кто печатает; `message` — на английском.
 */
export class ClaudeError extends Error {
  readonly describe: LocalizedText<ClaudeMessages>;

  /**
   * Ошибка с текстом на любом языке интерфейса.
   * @param {LocalizedText<ClaudeMessages>} describe Текст ошибки по набору сообщений.
   * @param {ErrorOptions} [options] Причина ошибки.
   */
  constructor(describe: LocalizedText<ClaudeMessages>, options?: ErrorOptions) {
    super(describe(CLAUDE_MESSAGES[DEFAULT_INTERFACE_LANGUAGE]), options);
    this.describe = describe;
  }
}
