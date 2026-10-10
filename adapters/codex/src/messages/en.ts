// English texts of the Codex adapter.

import type { CodexMessages } from "./codex-messages.ts";

/** Adapter texts in English. */
export const en: CodexMessages = {
  errors: {
    unsupportedAgent: ({ stage, requested, supported }) =>
      `stage ${stage}: ${requested} is not supported by the Codex adapter, it runs only ${supported}`,
    configNotParsed: ({ file, reason }) =>
      `${file} cannot be parsed as TOML: ${reason}. Nothing was written to it: fix the file, or trust the project and approve its hooks in Codex yourself`,
    configLayoutUnsupported: ({ file, lines }) =>
      `${file} describes projects or hook trust in a form that cannot be edited safely (an inline table or a dotted key). Nothing was written to it: add these lines yourself:\n${lines}`,
    configEditRejected: (file) =>
      `editing ${file} would change more than the trust entries, so nothing was written: add the entries yourself or trust the project in Codex`,
  },
};
