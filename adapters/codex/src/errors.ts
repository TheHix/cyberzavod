// Adapter errors that the CLI shows the human as a message rather than a stack trace.

import { DEFAULT_INTERFACE_LANGUAGE, type LocalizedText } from "@cyberzavod/core";
import { CODEX_MESSAGES } from "./messages/catalog.ts";
import type { CodexMessages } from "./messages/codex-messages.ts";

/**
 * Adapter error: the human gets a message, not a stack trace. The text is stored as a function of
 * the message catalog, whoever prints it picks the language; `message` is in English.
 */
export class CodexError extends Error {
  readonly describe: LocalizedText<CodexMessages>;

  /**
   * Error with text in any interface language.
   * @param {LocalizedText<CodexMessages>} describe Error text built from a message set.
   * @param {ErrorOptions} [options] Cause of the error.
   */
  constructor(describe: LocalizedText<CodexMessages>, options?: ErrorOptions) {
    super(describe(CODEX_MESSAGES[DEFAULT_INTERFACE_LANGUAGE]), options);
    this.describe = describe;
  }
}
