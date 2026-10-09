// Adapter hooks in the project's `.claude/settings.json`. The settings belong to the project: the
// adapter replaces only its own handlers (their command runs, via npx, the package version recorded
// in the config) and adds its own deny rules, leaving the rest as is.

import { LEGACY_TOOL_FILE } from "@cyberzavod/storage";
import { PACKAGE_NAME } from "../cli-command.ts";
import type { HookName } from "../hooks/index.ts";
import { GenerateError } from "./claude.ts";

/** Claude Code hook handler. */
export interface HookHandler {
  type: "command";
  command: string;
  async?: boolean;
  timeout?: number;
  statusMessage?: string;
}

/** Group of handlers for one hook event. */
export interface HookGroup {
  matcher?: string;
  hooks: HookHandler[];
}

/** Claude Code settings: parsed JSON; the adapter reads only its own parts of it. */
export type Settings = Record<string, unknown>;

/** Settings error: the project file has the wrong shape to install hooks into. */
export class SettingsError extends Error {}

/** Path of the Claude Code settings relative to the project root. */
export const SETTINGS_FILE = ".claude/settings.json";

/**
 * Adapter error from a diagnostic of malformed settings: the format text, framed by the catalog.
 * @param {SettingsError} err Diagnostic of malformed `hooks` or `permissions`.
 * @returns {GenerateError} Error the CLI prints as one line.
 */
export function unparsedSettings(err: SettingsError): GenerateError {
  const reason = err.message;

  return new GenerateError(
    (messages) => messages.errors.settingsNotParsed({ file: SETTINGS_FILE, reason }),
    { cause: err },
  );
}

function parseJson(text: string, file: string): unknown {
  try {
    return JSON.parse(text);
  } catch (err) {
    const reason = (err as Error).message;

    throw new GenerateError((messages) => messages.errors.settingsNotParsed({ file, reason }), {
      cause: err,
    });
  }
}

/**
 * Parses the project settings text.
 * @param {string | undefined} text File contents; undefined if there is no file.
 * @param {string} file File path for the error message.
 * @returns {Settings} The settings; an empty object if there is no file.
 * @throws {GenerateError} If the text is not JSON or not an object.
 */
export function parseSettings(text: string | undefined, file: string): Settings {
  if (text === undefined) return {};

  const parsed = parseJson(text, file);

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new GenerateError((messages) => messages.errors.settingsNotObject(file));
  }

  return parsed as Settings;
}

/** Adapter handlers by hook event. */
export type AdapterHooks = Readonly<Record<string, HookGroup[]>>;

const TURN_START_TIMEOUT_SECONDS = 30;
const STOP_GATE_TIMEOUT_SECONDS = 180;

/** Adapter deny rules: secrets are neither read nor edited, raw session logs are not edited. */
export const ADAPTER_DENY = [
  "Read(**/.env)",
  "Read(**/.env.*)",
  "Edit(**/.env)",
  "Edit(**/.env.*)",
  "Edit(**/capture/claude/raw/**)",
] as const;

// --prefer-offline and --fetch-retries=0: a package in the npm cache is taken without contacting
// the registry, and without network or cache npx fails at once rather than after minutes. --prefix
// is $CLAUDE_PROJECT_DIR, not the current directory (the session may have run cd), so the package
// in the project's node_modules is found from any subdirectory. The quotes allow spaces in the
// path.
const HOOK_RUNNER = 'npx -y --prefer-offline --fetch-retries=0 --prefix "$CLAUDE_PROJECT_DIR"';

// Without network, capture and turn start are silently skipped.
const SKIP_ON_FAILURE = "true";

// The fallback also fires when the stop hook failed internally, so the text does not promise a
// cause. No apostrophes: the command sits in single quotes.
const STOP_FAILURE_MESSAGE =
  "Cyberzavod: the stop hook failed or could not start (for example, npx without network). Project checks were skipped.";

function stopFailureCommand(): string {
  return `echo '${JSON.stringify({ systemMessage: STOP_FAILURE_MESSAGE })}'`;
}

// The npx flags between `npx` and the package may change in later versions: hooks of earlier
// versions are recognized by the package and hook name, not by the full command prefix.
const NPX_HANDLER_PATTERN = new RegExp(`^npx\\s.*\\s${PACKAGE_NAME}@(\\S+) hook `);

// Version referenced by an own handler; the former in-project CLI has no version and is recognized
// by file name. Someone else's handler gives undefined.
function ownVersionOf(handler: HookHandler): string | undefined {
  const [, npxVersion] = NPX_HANDLER_PATTERN.exec(handler.command) ?? [];

  if (npxVersion !== undefined) return npxVersion;

  return handler.command.includes(LEGACY_TOOL_FILE) ? LEGACY_TOOL_FILE : undefined;
}

function isOwnHandler(handler: HookHandler): boolean {
  return ownVersionOf(handler) !== undefined;
}

// `|| …` fires on any non-zero code, so the fallback is only for "npx did not start": the stop hook
// blocks with a JSON decision and code 0, not code 2. POSIX syntax: on Windows Claude Code runs
// hooks through Git Bash; PowerShell is not supported.
function hookCommand(version: string, hook: HookName, onFailure: string): string {
  return `${HOOK_RUNNER} ${PACKAGE_NAME}@${version} hook ${hook} || ${onFailure}`;
}

/**
 * Adapter handlers for the Cyberzavod version from the project config: session capture on every
 * event, turn start, and checks on stop.
 * @param {string} version Cyberzavod version from the project config.
 * @returns {AdapterHooks} Handlers by event.
 */
export function adapterHooks(version: string): AdapterHooks {
  const record: HookHandler = {
    type: "command",
    command: hookCommand(version, "record", SKIP_ON_FAILURE),
    async: true,
  };
  const turnStart: HookHandler = {
    type: "command",
    command: hookCommand(version, "turn-start", SKIP_ON_FAILURE),
    timeout: TURN_START_TIMEOUT_SECONDS,
  };
  const stopGate: HookHandler = {
    type: "command",
    command: hookCommand(version, "stop", stopFailureCommand()),
    timeout: STOP_GATE_TIMEOUT_SECONDS,
    statusMessage: "Running project checks…",
  };
  const recordOnly = [{ hooks: [record] }];

  return {
    SessionStart: recordOnly,
    UserPromptSubmit: [{ hooks: [record, turnStart] }],
    PostToolUse: recordOnly,
    PostToolUseFailure: recordOnly,
    SubagentStart: recordOnly,
    SubagentStop: recordOnly,
    Stop: [{ hooks: [record, stopGate] }],
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isHookGroup(value: unknown): value is HookGroup {
  return (
    isObject(value) &&
    Array.isArray(value.hooks) &&
    value.hooks.every((handler) => isObject(handler) && typeof handler.command === "string")
  );
}

function groupsOf(event: string, value: unknown): HookGroup[] {
  if (!Array.isArray(value) || !value.every(isHookGroup)) {
    throw new SettingsError(`hooks.${event} must be a list of groups with handlers`);
  }

  return value;
}

function withoutOwnHandlers(groups: HookGroup[]): HookGroup[] {
  return groups
    .map((group) => ({ ...group, hooks: group.hooks.filter((handler) => !isOwnHandler(handler)) }))
    .filter((group) => group.hooks.length > 0);
}

function mergedHooks(existing: unknown, own: AdapterHooks): Record<string, HookGroup[]> {
  if (existing !== undefined && !isObject(existing)) {
    throw new SettingsError("hooks must be an object");
  }

  const merged: Record<string, HookGroup[]> = {};

  for (const [event, groups] of Object.entries(existing ?? {})) {
    merged[event] = withoutOwnHandlers(groupsOf(event, groups));
  }

  for (const [event, groups] of Object.entries(own)) {
    merged[event] = [...(merged[event] ?? []), ...groups];
  }

  const nonEmpty = Object.entries(merged).filter(([, groups]) => groups.length > 0);

  return Object.fromEntries(nonEmpty);
}

function mergedPermissions(existing: unknown): Record<string, unknown> {
  if (existing !== undefined && !isObject(existing)) {
    throw new SettingsError("permissions must be an object");
  }

  const { deny = [] } = existing ?? {};

  if (!Array.isArray(deny) || !deny.every((rule) => typeof rule === "string")) {
    throw new SettingsError("permissions.deny must be a list of strings");
  }

  const missing = ADAPTER_DENY.filter((rule) => !deny.includes(rule));

  return { ...existing, deny: [...deny, ...missing] };
}

/**
 * Installs the adapter hooks and deny rules into the project settings: earlier adapter handlers are
 * replaced; other handlers, deny rules and other settings stay.
 * @param {Settings} settings Project settings; an empty object if there is no file.
 * @param {AdapterHooks} hooks Adapter handlers.
 * @returns {Settings} The new settings.
 * @throws {SettingsError} If `hooks` or `permissions` in the settings have the wrong shape.
 */
export function mergeSettings(settings: Settings, hooks: AdapterHooks): Settings {
  return {
    ...settings,
    permissions: mergedPermissions(settings.permissions),
    hooks: mergedHooks(settings.hooks, hooks),
  };
}

/**
 * Adapter hooks in the project settings: all in place (`installed`), none of its own (`missing`),
 * its own refer to other versions (`otherVersion`; the former in-project CLI is named as
 * `LEGACY_TOOL_FILE`), or the `events` lack some handler of this version (`incomplete`).
 */
export type HooksInspection =
  | { kind: "installed" }
  | { kind: "missing" }
  | { kind: "otherVersion"; found: string[] }
  | { kind: "incomplete"; events: string[] };

interface OwnHandler {
  event: string;
  command: string;
  version: string;
}

function ownHandlersOf(hooks: Record<string, unknown>): OwnHandler[] {
  return Object.entries(hooks).flatMap(([event, value]) => {
    const handlers = groupsOf(event, value).flatMap((group) => group.hooks);

    return handlers.flatMap((handler) => {
      const version = ownVersionOf(handler);

      return version === undefined ? [] : [{ event, command: handler.command, version }];
    });
  });
}

function isEventComplete(event: string, groups: HookGroup[], own: OwnHandler[]): boolean {
  const present = own.filter((handler) => handler.event === event).map(({ command }) => command);
  const expected = groups.flatMap((group) => group.hooks.map(({ command }) => command));

  return expected.every((command) => present.includes(command));
}

/**
 * Compares the hooks in the project settings with those the adapter installs for the config
 * version. Other handlers and other settings are not taken into account.
 * @param {Settings} settings Project settings; an empty object if there is no file.
 * @param {string} version Cyberzavod version from the project config.
 * @returns {HooksInspection} Hook state.
 * @throws {SettingsError} If `hooks` in the settings has the wrong shape.
 */
export function inspectHooks(settings: Settings, version: string): HooksInspection {
  if (settings.hooks !== undefined && !isObject(settings.hooks)) {
    throw new SettingsError("hooks must be an object");
  }

  const own = ownHandlersOf(settings.hooks ?? {});

  if (own.length === 0) return { kind: "missing" };

  const otherVersions = own.map((handler) => handler.version).filter((found) => found !== version);

  if (otherVersions.length > 0) return { kind: "otherVersion", found: [...new Set(otherVersions)] };

  const expected = Object.entries(adapterHooks(version));
  const events = expected
    .filter(([event, groups]) => !isEventComplete(event, groups, own))
    .map(([event]) => event);

  return events.length === 0 ? { kind: "installed" } : { kind: "incomplete", events };
}

function denyOf(permissions: unknown): string[] {
  if (permissions !== undefined && !isObject(permissions)) {
    throw new SettingsError("permissions must be an object");
  }

  const { deny = [] } = permissions ?? {};

  if (!Array.isArray(deny) || !deny.every((rule) => typeof rule === "string")) {
    throw new SettingsError("permissions.deny must be a list of strings");
  }

  return deny;
}

/**
 * Adapter deny rules not yet in the project settings: sync will add them.
 * @param {Settings} settings Project settings; an empty object if there is no file.
 * @returns {string[]} Missing deny rules in `ADAPTER_DENY` order.
 * @throws {SettingsError} If `permissions` in the settings has the wrong shape.
 */
export function missingAdapterDeny(settings: Settings): string[] {
  const deny = denyOf(settings.permissions);

  return ADAPTER_DENY.filter((rule) => !deny.includes(rule));
}

function withoutOwnHooks(hooks: unknown): Record<string, HookGroup[]> {
  if (hooks !== undefined && !isObject(hooks)) {
    throw new SettingsError("hooks must be an object");
  }

  const entries = Object.entries(hooks ?? {}).map(
    ([event, groups]) => [event, withoutOwnHandlers(groupsOf(event, groups))] as const,
  );
  const nonEmpty = entries.filter(([, groups]) => groups.length > 0);

  return Object.fromEntries(nonEmpty);
}

function withoutRules(permissions: unknown, rules: readonly string[]): Record<string, unknown> {
  const deny = denyOf(permissions).filter((rule) => !rules.includes(rule));
  const others = Object.entries(isObject(permissions) ? permissions : {}).filter(
    ([key]) => key !== "deny",
  );
  const rest = Object.fromEntries(others);

  return deny.length === 0 ? rest : { ...rest, deny };
}

function isEmptyObject(value: unknown): boolean {
  return isObject(value) && Object.keys(value).length === 0;
}

/**
 * Removes from the project settings what the adapter installed: its own hook handlers and the
 * listed deny rules. Other handlers, deny rules and other settings stay; emptied `hooks` and
 * `permissions` are removed.
 * @param {Settings} settings Project settings.
 * @param {readonly string[]} deny Deny rules the adapter added.
 * @returns {Settings} Settings without the adapter; an empty object if nothing else remains.
 * @throws {SettingsError} If `hooks` or `permissions` in the settings have the wrong shape.
 */
export function withoutAdapterSettings(settings: Settings, deny: readonly string[]): Settings {
  const { hooks, permissions, ...rest } = settings;
  const remainingHooks = withoutOwnHooks(hooks);
  const remainingPermissions = withoutRules(permissions, deny);

  return {
    ...rest,
    ...(isEmptyObject(remainingPermissions) ? {} : { permissions: remainingPermissions }),
    ...(isEmptyObject(remainingHooks) ? {} : { hooks: remainingHooks }),
  };
}
