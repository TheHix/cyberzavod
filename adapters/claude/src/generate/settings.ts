// Хуки адаптера в `.claude/settings.json` проекта. Настройки принадлежат проекту: адаптер
// заменяет только свои обработчики — их команда запускает CLI из проекта
// (`.cyberzavod/bin/cyberzavod.mjs`) — и дописывает свои запреты, остальное оставляет как есть.

import { TOOL_FILE } from "@cyberzavod/storage";
import type { HookName } from "../hooks/index.ts";

/** Обработчик хука Claude Code. */
export interface HookHandler {
  type: "command";
  command: string;
  async?: boolean;
  timeout?: number;
  statusMessage?: string;
}

/** Группа обработчиков одного события хука. */
export interface HookGroup {
  matcher?: string;
  hooks: HookHandler[];
}

/** Настройки Claude Code: разобранный JSON, адаптер читает из него только свои части. */
export type Settings = Record<string, unknown>;

/** Ошибка настроек: файл проекта не того вида, чтобы в него встроить хуки. */
export class SettingsError extends Error {}

/** Обработчики адаптера по событиям хуков. */
export type AdapterHooks = Readonly<Record<string, HookGroup[]>>;

const TURN_START_TIMEOUT_SECONDS = 30;
const STOP_GATE_TIMEOUT_SECONDS = 180;

/** Запреты адаптера: секреты не читаются и не правятся, сырые журналы сессий не правятся. */
export const ADAPTER_DENY = [
  "Read(**/.env)",
  "Read(**/.env.*)",
  "Edit(**/.env)",
  "Edit(**/.env.*)",
  "Edit(**/capture/claude/raw/**)",
] as const;

function isOwnHandler(handler: HookHandler): boolean {
  return handler.command.includes(TOOL_FILE);
}

// От $CLAUDE_PROJECT_DIR, а не от текущего каталога: сессия могла сделать cd. Кавычки — ради
// пробелов в пути; такую запись понимают и Git Bash, и PowerShell, которыми Claude Code
// запускает хуки на Windows.
function hookCommand(hook: HookName): string {
  return `node "$CLAUDE_PROJECT_DIR/${TOOL_FILE}" hook ${hook}`;
}

function adapterHooks(): AdapterHooks {
  const record: HookHandler = { type: "command", command: hookCommand("record"), async: true };
  const turnStart: HookHandler = {
    type: "command",
    command: hookCommand("turn-start"),
    timeout: TURN_START_TIMEOUT_SECONDS,
  };
  const stopGate: HookHandler = {
    type: "command",
    command: hookCommand("stop"),
    timeout: STOP_GATE_TIMEOUT_SECONDS,
    statusMessage: "Запускаю проверки проекта…",
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

/** Обработчики адаптера: запись сессии на каждом событии, начало хода и проверки при остановке. */
export const ADAPTER_HOOKS: AdapterHooks = adapterHooks();

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
    throw new SettingsError(`hooks.${event} должен быть списком групп с обработчиками`);
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
    throw new SettingsError("hooks должен быть объектом");
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
    throw new SettingsError("permissions должен быть объектом");
  }

  const { deny = [] } = existing ?? {};

  if (!Array.isArray(deny) || !deny.every((rule) => typeof rule === "string")) {
    throw new SettingsError("permissions.deny должен быть списком строк");
  }

  const missing = ADAPTER_DENY.filter((rule) => !deny.includes(rule));

  return { ...existing, deny: [...deny, ...missing] };
}

/**
 * Встраивает хуки и запреты адаптера в настройки проекта: прежние обработчики адаптера
 * заменяются, чужие обработчики, запреты и прочие настройки остаются.
 * @param {Settings} settings Настройки проекта; пустой объект, если файла нет.
 * @param {AdapterHooks} hooks Обработчики адаптера.
 * @returns {Settings} Новые настройки.
 * @throws {SettingsError} Если `hooks` или `permissions` в настройках не того вида.
 */
export function mergeSettings(settings: Settings, hooks: AdapterHooks): Settings {
  return {
    ...settings,
    permissions: mergedPermissions(settings.permissions),
    hooks: mergedHooks(settings.hooks, hooks),
  };
}
