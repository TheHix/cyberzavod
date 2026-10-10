// English texts of the Claude Code adapter.

import type { ClaudeMessages } from "./claude-messages.ts";

/** Adapter texts in English. */
export const en: ClaudeMessages = {
  errors: {
    unsupportedAgent: ({ stage, requested, supported }) =>
      `stage ${stage}: ${requested} is not supported by the Claude Code adapter, it runs only ${supported}`,
  },
};
