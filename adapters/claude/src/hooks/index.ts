// Adapter hooks by name: `cyberzavod hook <name>` calls them, and the Claude Code settings use the
// same names.

import type { HookContext, HookOutcome } from "./hook.ts";
import { recordEvent } from "./record.ts";
import { gateStop } from "./stop-gate.ts";
import { startTurn } from "./turn-start.ts";

/** Adapter hook names. */
export const HOOK_NAMES = ["record", "turn-start", "stop"] as const;

/** Adapter hook name. */
export type HookName = (typeof HOOK_NAMES)[number];

const HOOKS: Readonly<Record<HookName, (context: HookContext) => Promise<HookOutcome>>> = {
  record: recordEvent,
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

export type { HookContext, HookOutcome } from "./hook.ts";
