// Adapter errors that the CLI shows the human as a message rather than a stack trace.

import { DEFAULT_INTERFACE_LANGUAGE, type LocalizedText } from "@cyberzavod/core";
import { CLAUDE_MESSAGES } from "./messages/catalog.ts";
import type { ClaudeMessages } from "./messages/claude-messages.ts";

/**
 * Adapter error: the human gets a message, not a stack trace. The text is stored as a function of
 * the message catalog, whoever prints it picks the language; `message` is in English.
 */
export class ClaudeError extends Error {
  readonly describe: LocalizedText<ClaudeMessages>;

  /**
   * Error with text in any interface language.
   * @param {LocalizedText<ClaudeMessages>} describe Error text built from a message set.
   * @param {ErrorOptions} [options] Cause of the error.
   */
  constructor(describe: LocalizedText<ClaudeMessages>, options?: ErrorOptions) {
    super(describe(CLAUDE_MESSAGES[DEFAULT_INTERFACE_LANGUAGE]), options);
    this.describe = describe;
  }
}
