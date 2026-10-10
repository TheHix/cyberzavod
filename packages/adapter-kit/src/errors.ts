// Errors of the shared adapter code that the CLI shows the human as a message, not a stack trace.

import { DEFAULT_INTERFACE_LANGUAGE, type LocalizedText } from "@cyberzavod/core";
import { KIT_MESSAGES } from "./messages/catalog.ts";
import type { KitMessages } from "./messages/kit-messages.ts";

/**
 * Error of the shared adapter code: the human gets a message, not a stack trace. The text is
 * stored as a function of the message catalog, whoever prints it picks the language; `message` is
 * in English.
 */
export class KitError extends Error {
  readonly describe: LocalizedText<KitMessages>;

  /**
   * Error with text in any interface language.
   * @param {LocalizedText<KitMessages>} describe Error text built from a message set.
   * @param {ErrorOptions} [options] Cause of the error.
   */
  constructor(describe: LocalizedText<KitMessages>, options?: ErrorOptions) {
    super(describe(KIT_MESSAGES[DEFAULT_INTERFACE_LANGUAGE]), options);
    this.describe = describe;
  }
}
