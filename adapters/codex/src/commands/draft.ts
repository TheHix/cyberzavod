// Recording draft from a Codex session log: the shared draft command with this adapter's
// rollouts.

import {
  draftSession as draftAgentSession,
  type AgentDraftOptions,
  type KitError,
} from "@cyberzavod/adapter-kit";
import { codexTranscripts } from "../capture/transcripts.ts";
import { CODEX_AGENT } from "../generate/codex.ts";

/** What to build the draft from: the project and, if needed, a specific raw log. */
export type DraftSessionOptions = AgentDraftOptions;

/**
 * Builds a recording draft from a raw Codex session log and prints what still awaits editing.
 * @param {DraftSessionOptions} options Project and raw log.
 * @returns {Promise<string>} Path of the written draft.
 * @throws {KitError} If there is no project, no logs yet, or the previous draft is broken.
 */
export function draftSession(options: DraftSessionOptions): Promise<string> {
  return draftAgentSession({
    ...options,
    capture: { agent: CODEX_AGENT, transcripts: codexTranscripts },
  });
}
