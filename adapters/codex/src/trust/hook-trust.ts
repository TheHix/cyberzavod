// Trust of Codex hooks. Codex runs a project hook only if the human's config holds the hash of its
// handler under a key made of the hooks file, the event and the handler's position. The key and the
// hash must be built exactly as Codex builds them, otherwise it ignores the hook; the end-to-end
// test against a pinned Codex version is what proves they match.

import { createHash } from "node:crypto";
import path from "node:path";
import {
  groupsOf,
  hookNameOf,
  isObject,
  isOwnHandler,
  parseSettings,
  type HookHandler,
  type KitError,
  SettingsError,
} from "@cyberzavod/adapter-kit";
import { HOOKS_FILE } from "../generate/hooks-config.ts";

/** Hook events of Codex and the lowercase names Codex builds keys and hashes from. */
export const EVENT_KEY_LABELS = {
  PreToolUse: "pre_tool_use",
  PermissionRequest: "permission_request",
  PostToolUse: "post_tool_use",
  PreCompact: "pre_compact",
  PostCompact: "post_compact",
  SessionStart: "session_start",
  SessionEnd: "session_end",
  UserPromptSubmit: "user_prompt_submit",
  SubagentStart: "subagent_start",
  SubagentStop: "subagent_stop",
  Stop: "stop",
  Interrupt: "interrupt",
} as const;

/** Hook event of Codex. */
export type HookEvent = keyof typeof EVENT_KEY_LABELS;

// Events whose groups have no matcher: Codex drops it from the hash.
const EVENTS_WITHOUT_MATCHER: ReadonlySet<HookEvent> = new Set([
  "UserPromptSubmit",
  "Stop",
  "Interrupt",
]);
const SHORT_EVENTS: ReadonlySet<HookEvent> = new Set(["SessionEnd", "Interrupt"]);

const DEFAULT_TIMEOUT_SECONDS = 600;
const SHORT_EVENT_DEFAULT_TIMEOUT_SECONDS = 1;
const SHORT_EVENT_MAX_TIMEOUT_SECONDS = 3;
const MIN_TIMEOUT_SECONDS = 1;
const HASH_ALGORITHM = "sha256";

/** Trust Codex asks for one handler: where it stands and what it looks like. */
export interface HookTrust {
  /** Key under `[hooks.state]` in the human's config. */
  key: string;
  /** Hash of the handler the human trusts: `sha256:<hex>`. */
  hash: string;
  event: HookEvent;
  /** The hook the handler runs: `record`, `stop` and so on. With the event it tells a handler of one version from the same handler of another. */
  name: string;
}

/**
 * Whether the text is a hook event Codex knows.
 * @param {string} name Event name from the hooks file.
 * @returns {boolean} true for a known event.
 */
export function isHookEvent(name: string): name is HookEvent {
  return Object.hasOwn(EVENT_KEY_LABELS, name);
}

/**
 * Timeout the way Codex normalizes it before hashing: ten minutes by default, at least a second;
 * the end-of-session events default to a second and are capped at three.
 * @param {HookEvent} event Hook event.
 * @param {number | undefined} timeout `timeout` of the handler in seconds.
 * @returns {number} Timeout in seconds.
 */
export function normalizedTimeout(event: HookEvent, timeout: number | undefined): number {
  if (SHORT_EVENTS.has(event)) {
    const requested = timeout ?? SHORT_EVENT_DEFAULT_TIMEOUT_SECONDS;

    return Math.min(Math.max(requested, MIN_TIMEOUT_SECONDS), SHORT_EVENT_MAX_TIMEOUT_SECONDS);
  }

  return Math.max(timeout ?? DEFAULT_TIMEOUT_SECONDS, MIN_TIMEOUT_SECONDS);
}

function sortedDeeply(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortedDeeply);

  if (!isObject(value)) return value;

  const entries = Object.keys(value)
    .sort()
    .map((key) => [key, sortedDeeply(value[key])] as const);

  return Object.fromEntries(entries);
}

/**
 * Hash of one handler the way Codex computes it: the SHA-256 of the compact JSON, with keys sorted,
 * of the event, the matcher and the handler with its timeout normalized.
 * @param {HookEvent} event Hook event.
 * @param {string | undefined} matcher `matcher` of the handler's group.
 * @param {HookHandler} handler The command handler.
 * @returns {string} Hash of the form `sha256:<hex>`.
 */
export function hookTrustHash(
  event: HookEvent,
  matcher: string | undefined,
  handler: HookHandler,
): string {
  const normalized = {
    type: handler.type,
    command: handler.command,
    timeout: normalizedTimeout(event, handler.timeout),
    async: handler.async ?? false,
    ...(handler.statusMessage === undefined ? {} : { statusMessage: handler.statusMessage }),
  };
  const isMatcherKept = matcher !== undefined && !EVENTS_WITHOUT_MATCHER.has(event);
  const identity = {
    event_name: EVENT_KEY_LABELS[event],
    ...(isMatcherKept ? { matcher } : {}),
    hooks: [normalized],
  };
  const digest = createHash(HASH_ALGORITHM)
    .update(JSON.stringify(sortedDeeply(identity)))
    .digest("hex");

  return `${HASH_ALGORITHM}:${digest}`;
}

/**
 * Key under `[hooks.state]` for a handler.
 * @param {string} hooksFilePath Absolute path of the hooks file, with symlinks resolved.
 * @param {HookEvent} event Hook event.
 * @param {{ group: number; handler: number }} position Index of the group in the event and of the
 *   handler in the group.
 * @param {number} position.group Index of the group among the event's groups.
 * @param {number} position.handler Index of the handler in its group.
 * @returns {string} Key of the form `<file>:<event>:<group>:<handler>`.
 */
export function hookTrustKey(
  hooksFilePath: string,
  event: HookEvent,
  position: { group: number; handler: number },
): string {
  return `${hooksFilePath}:${EVENT_KEY_LABELS[event]}:${position.group}:${position.handler}`;
}

function hooksOf(hooks: unknown): Record<string, unknown> {
  if (hooks === undefined) return {};

  if (!isObject(hooks)) throw new SettingsError("hooks must be an object");

  return hooks;
}

/**
 * The trust Codex needs for the adapter's own handlers in a hooks file. Positions count every
 * group and handler of the file, the human's included, because Codex counts them that way.
 * @param {string} root Project root with symlinks resolved.
 * @param {string} hooksText Contents of the project's hooks file.
 * @returns {HookTrust[]} Key and hash of each own handler, in file order.
 * @throws {KitError} If the text is not JSON or not an object.
 * @throws {SettingsError} If `hooks` has the wrong shape.
 */
export function ownHookTrust(root: string, hooksText: string): HookTrust[] {
  const hooksFilePath = path.join(root, ...HOOKS_FILE.split("/"));
  const settings = parseSettings(hooksText, HOOKS_FILE);
  const hooks = hooksOf(settings.hooks);
  const events = Object.keys(hooks).filter(isHookEvent);

  return events.flatMap((event) =>
    groupsOf(event, hooks[event]).flatMap((group, groupIndex) =>
      group.hooks.flatMap((handler, handlerIndex) => {
        if (!isOwnHandler(handler)) return [];

        const key = hookTrustKey(hooksFilePath, event, {
          group: groupIndex,
          handler: handlerIndex,
        });
        const hash = hookTrustHash(event, group.matcher, handler);

        // The former in-project CLI has no hook name: its command stands for itself.
        const name = hookNameOf(handler) ?? handler.command;

        return [{ key, hash, event, name }];
      }),
    ),
  );
}
