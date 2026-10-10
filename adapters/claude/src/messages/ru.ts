// Russian texts of the Claude Code adapter.

import type { ClaudeMessages } from "./claude-messages.ts";

/** Adapter texts in Russian. */
export const ru: ClaudeMessages = {
  errors: {
    unsupportedAgent: ({ stage, requested, supported }) =>
      `этап ${stage}: ${requested} не поддерживается адаптером Claude Code, он ведёт только ${supported}`,
  },
};
