// Publishing recordings of Claude Code sessions: the shared publish command with this adapter's
// agent and the source of its recordings.

import {
  publishSessions as publishAgentSessions,
  type AgentPublishOptions,
  type KitError,
} from "@cyberzavod/adapter-kit";
import type { RecordSource } from "@cyberzavod/core";
import { CLAUDE_AGENT, CLAUDE_PROVIDER } from "../generate/claude.ts";

/** The source of the recordings this adapter writes: Claude Code, Anthropic's agent. */
export const CLAUDE_SOURCE: RecordSource = {
  type: "agent",
  provider: CLAUDE_PROVIDER,
  agent: CLAUDE_AGENT,
};

/** What to publish: the project and, if needed, a specific draft and build. */
export type PublishSessionsOptions = AgentPublishOptions;

/**
 * Publishes the draft's builds as recordings into the project journal. An unready draft yields an
 * error message, not an exception: the human fixes it.
 * @param {PublishSessionsOptions} options Project, draft, build and messages.
 * @returns {Promise<boolean>} true if the recordings were published.
 * @throws {KitError} If there is no project or no drafts.
 */
export function publishSessions(options: PublishSessionsOptions): Promise<boolean> {
  return publishAgentSessions({ ...options, agent: CLAUDE_AGENT, source: CLAUDE_SOURCE });
}
