// Adapter hooks by name: `cyberzavod hook <name> --agent codex` calls them, and `.codex/hooks.json`
// uses the same names. Record, turn start and stop are shared with the other agents (see the
// adapter kit); here they are tied to Codex's payloads.

import {
  gateStop,
  isObject,
  recordEvent,
  SILENT_EXIT,
  startTurn,
  type HookOutcome,
  type RawEventSource,
} from "@cyberzavod/adapter-kit";
import { findProjectRoot } from "@cyberzavod/storage";
import { fromCodexHookPayload } from "../capture/hook-payload.ts";
import { CODEX_AGENT } from "../generate/codex.ts";
import type { CodexHookContext } from "./context.ts";
import { guardSecrets } from "./guard.ts";

/** Adapter hook names. */
export const CODEX_HOOK_NAMES = ["record", "turn-start", "stop", "guard"] as const;

/** Adapter hook name. */
export type CodexHookName = (typeof CODEX_HOOK_NAMES)[number];

const CODEX_EVENTS: RawEventSource = { agent: CODEX_AGENT, eventOf: fromCodexHookPayload };

// A subagent starts no turn of its own: its prompt is the assignment, not the human's message, and
// the turn belongs to the main session.
function isFromSubagent(payload: string): boolean {
  const parsed: unknown = JSON.parse(payload);

  return isObject(parsed) && typeof parsed.agent_id === "string";
}

async function startMainTurn(context: CodexHookContext): Promise<HookOutcome> {
  return isFromSubagent(context.payload) ? SILENT_EXIT : startTurn(context);
}

const HOOKS: Readonly<Record<CodexHookName, (context: CodexHookContext) => Promise<HookOutcome>>> =
  {
    record: (context) => recordEvent(context, CODEX_EVENTS),
    "turn-start": startMainTurn,
    stop: gateStop,
    guard: guardSecrets,
  };

/**
 * Checks that a string is a Codex hook name.
 * @param {string} name Name from the command line.
 * @returns {boolean} true if such a hook exists.
 */
export function isCodexHookName(name: string): name is CodexHookName {
  return (CODEX_HOOK_NAMES as readonly string[]).includes(name);
}

/**
 * Runs a Codex hook in the root of the project the call is in. The checks and the fingerprint of
 * the code work from the root, while the session directory may be a subdirectory of it.
 * @param {CodexHookName} name Hook name.
 * @param {CodexHookContext} context Hook call.
 * @returns {Promise<HookOutcome>} Exit code and output of the hook.
 */
export async function runCodexHook(
  name: CodexHookName,
  context: CodexHookContext,
): Promise<HookOutcome> {
  const root = await findProjectRoot(context.projectDirectory);

  return HOOKS[name]({ ...context, projectDirectory: root ?? context.projectDirectory });
}
