// Hook state between calls: files in the temporary directory, one per session and kind: the code
// fingerprint at the start of a turn, the stop hook's refusal counter, the checks output, and the
// "called the human" marker.

import { unlink } from "node:fs/promises";
import path from "node:path";
import { isNotFound } from "@cyberzavod/storage";
import type { ClaudeMessages } from "../messages/claude-messages.ts";

/** Kind of hook state. */
export type HookStateName = "turn-start" | "stop-blocks" | "checks-output" | "human-call";

const STATE_PREFIX = "cyberzavod";
const UNSAFE_SESSION_CHARACTERS = /[^A-Za-z0-9_-]/g;
const UNKNOWN_SESSION = "unknown";

/**
 * Path of a hook state file. The session id is sanitized because it goes into the file name.
 * @param {string} tmpDir Temporary files directory.
 * @param {string} sessionId Session id from the hook payload.
 * @param {HookStateName} name Kind of state.
 * @returns {string} File path.
 */
export function hookStatePath(tmpDir: string, sessionId: string, name: HookStateName): string {
  const safeSession = sessionId.replace(UNSAFE_SESSION_CHARACTERS, "") || UNKNOWN_SESSION;

  return path.join(tmpDir, `${STATE_PREFIX}-${name}-${safeSession}`);
}

/**
 * Claims the "stop hook gave up and called the human" marker by deleting its file. Success means
 * the marker existed and the prompt after it answers the stop hook's call. No file means there was
 * no marker. Any other error does not crash the capture hook but becomes a warning: the prompt is
 * written as an ordinary one.
 * @param {string} sessionId Session id from the hook payload.
 * @param {string} tmpDir Temporary files directory.
 * @param {ClaudeMessages} messages Messages in the chosen language.
 * @returns {Promise<boolean>} true if the marker existed and was deleted.
 */
export async function claimHumanCallMarker(
  sessionId: string,
  tmpDir: string,
  messages: ClaudeMessages,
): Promise<boolean> {
  const markerPath = hookStatePath(tmpDir, sessionId, "human-call");

  try {
    await unlink(markerPath);

    return true;
  } catch (err) {
    if (!isNotFound(err)) {
      console.warn(messages.record.markerNotClaimed({ file: markerPath, reason: String(err) }));
    }

    return false;
  }
}
