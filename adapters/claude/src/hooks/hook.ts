// Shared by Claude Code hooks: what a hook receives when called and what it returns.

import type { ClaudeMessages } from "../messages/claude-messages.ts";

/**
 * Hook call: the event payload, the project root, a directory for state between calls, and texts
 * in the chosen language.
 */
export interface HookContext {
  /** Claude Code event JSON from stdin. */
  payload: string;
  projectDirectory: string;
  tmpDir: string;
  messages: ClaudeMessages;
}

/** Claude Code hook result: the exit code and what it prints to stdout and stderr. */
export interface HookOutcome {
  exitCode: number;
  stdout: string;
  stderr: string;
}

/** Normal hook exit: Claude Code carries on as if nothing happened. */
export const SILENT_EXIT: HookOutcome = { exitCode: 0, stdout: "", stderr: "" };

const UNKNOWN_SESSION = "unknown";

/**
 * Session id from the hook payload.
 * @param {string} payload Claude Code event JSON.
 * @returns {string} `session_id`, or `unknown` if it is missing.
 * @throws {SyntaxError} If the payload is not JSON.
 */
export function sessionIdOf(payload: string): string {
  const parsed: unknown = JSON.parse(payload);
  const hasSessionId = typeof parsed === "object" && parsed !== null && "session_id" in parsed;
  const sessionId = hasSessionId ? parsed.session_id : undefined;

  return typeof sessionId === "string" && sessionId !== "" ? sessionId : UNKNOWN_SESSION;
}
