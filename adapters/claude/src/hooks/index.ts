// Adapter hooks by name: `cyberzavod hook <name>` calls them, and the Claude Code settings use the
// same names. The hooks themselves are shared with the other agents (see the adapter kit); here
// they are tied to Claude Code's payloads.

import {
  gateStop,
  recordEvent,
  startTurn,
  type HookContext,
  type HookOutcome,
  type RawEventSource,
} from "@cyberzavod/adapter-kit";
import { fromHookPayload } from "../capture/hook-payload.ts";
import { CLAUDE_AGENT } from "../generate/claude.ts";

/** Adapter hook names. */
export const HOOK_NAMES = ["record", "turn-start", "stop"] as const;

/** Adapter hook name. */
export type HookName = (typeof HOOK_NAMES)[number];

const CLAUDE_EVENTS: RawEventSource = { agent: CLAUDE_AGENT, eventOf: fromHookPayload };

const HOOKS: Readonly<Record<HookName, (context: HookContext) => Promise<HookOutcome>>> = {
  record: (context) => recordEvent(context, CLAUDE_EVENTS),
  "turn-start": startTurn,
  stop: gateStop,
};

/**
 * Checks that a string is an adapter hook name.
 * @param {string} name Name from the command line.
 * @returns {boolean} true if such a hook exists.
 */
export function isHookName(name: string): name is HookName {
  return (HOOK_NAMES as readonly string[]).includes(name);
}

/**
 * Runs an adapter hook.
 * @param {HookName} name Hook name.
 * @param {HookContext} context Hook call.
 * @returns {Promise<HookOutcome>} Exit code and output of the hook.
 */
export async function runHook(name: HookName, context: HookContext): Promise<HookOutcome> {
  return HOOKS[name](context);
}
