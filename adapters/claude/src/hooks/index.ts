// Хуки адаптера по именам: их вызывает `cyberzavod hook <имя>`, а настройки Claude Code
// называют те же имена.

import type { HookContext, HookOutcome } from "./hook.ts";
import { recordEvent } from "./record.ts";
import { gateStop } from "./stop-gate.ts";
import { startTurn } from "./turn-start.ts";

/** Имена хуков адаптера. */
export const HOOK_NAMES = ["record", "turn-start", "stop"] as const;

/** Имя хука адаптера. */
export type HookName = (typeof HOOK_NAMES)[number];

const HOOKS: Readonly<Record<HookName, (context: HookContext) => Promise<HookOutcome>>> = {
  record: recordEvent,
  "turn-start": startTurn,
  stop: gateStop,
};

/**
 * Проверяет, что строка — имя хука адаптера.
 * @param {string} name Имя из командной строки.
 * @returns {boolean} true, если такой хук есть.
 */
export function isHookName(name: string): name is HookName {
  return (HOOK_NAMES as readonly string[]).includes(name);
}

/**
 * Выполняет хук адаптера.
 * @param {HookName} name Имя хука.
 * @param {HookContext} context Вызов хука.
 * @returns {Promise<HookOutcome>} Код выхода и вывод хука.
 */
export async function runHook(name: HookName, context: HookContext): Promise<HookOutcome> {
  return HOOKS[name](context);
}

export type { HookContext, HookOutcome } from "./hook.ts";
