// Publishing recordings of Codex sessions: the shared publish command with this adapter's agent and
// the source of its recordings.

import {
  publishSessions as publishAgentSessions,
  type AgentPublishOptions,
  type KitError,
} from "@cyberzavod/adapter-kit";
import type { RecordSource } from "@cyberzavod/core";
import { CODEX_AGENT, CODEX_PROVIDER } from "../generate/codex.ts";

/** The source of the recordings this adapter writes: Codex, OpenAI's agent. */
export const CODEX_SOURCE: RecordSource = {
  type: "agent",
  provider: CODEX_PROVIDER,
  agent: CODEX_AGENT,
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
  return publishAgentSessions({ ...options, agent: CODEX_AGENT, source: CODEX_SOURCE });
}
