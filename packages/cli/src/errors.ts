// Errors the CLI shows to the human as a message rather than a stack trace.

import { DEFAULT_INTERFACE_LANGUAGE, type LocalizedText } from "@cyberzavod/core";
import { CLI_MESSAGES } from "./messages/catalog.ts";
import type { CliMessages } from "./messages/cli-messages.ts";

/**
 * A command error: the human gets a message, not a stack trace. The text is stored as a function
 * of the message catalog, and whoever prints it picks the language; `message` is in English.
 */
export class CommandError extends Error {
  readonly describe: LocalizedText<CliMessages>;

  /**
   * An error with text in any interface language.
   * @param {LocalizedText<CliMessages>} describe Error text from a message set.
   * @param {ErrorOptions} [options] Cause of the error.
   */
  constructor(describe: LocalizedText<CliMessages>, options?: ErrorOptions) {
    super(describe(CLI_MESSAGES[DEFAULT_INTERFACE_LANGUAGE]), options);
    this.describe = describe;
  }
}
