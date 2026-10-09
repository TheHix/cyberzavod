// Хуки адаптера в `.claude/settings.json` проекта. Настройки принадлежат проекту: адаптер
// заменяет только свои обработчики — их команда запускает пакет через npx той версии, что
// записана в конфиге, — и дописывает свои запреты, остальное оставляет как есть.

import { LEGACY_TOOL_FILE } from "@cyberzavod/storage";
import { PACKAGE_NAME } from "../cli-command.ts";
import type { HookName } from "../hooks/index.ts";
import { GenerateError } from "./claude.ts";

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

/** Путь настроек Claude Code относительно корня проекта. */
export const SETTINGS_FILE = ".claude/settings.json";

/**
 * Ошибка адаптера из диагностики настроек не того вида: текст формата, рамку даёт каталог.
 * @param {SettingsError} err Диагностика `hooks` или `permissions` не того вида.
 * @returns {GenerateError} Ошибка, которую CLI печатает одной строкой.
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
 * Разбирает текст настроек проекта.
 * @param {string | undefined} text Содержимое файла; undefined, если файла нет.
 * @param {string} file Путь файла для сообщения об ошибке.
 * @returns {Settings} Настройки; пустой объект, если файла нет.
 * @throws {GenerateError} Если текст не JSON или это не объект.
 */
export function parseSettings(text: string | undefined, file: string): Settings {
  if (text === undefined) return {};

  const parsed = parseJson(text, file);

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new GenerateError((messages) => messages.errors.settingsNotObject(file));
  }

  return parsed as Settings;
}

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

// --prefer-offline и --fetch-retries=0: пакет в кэше npm берётся без обращения к registry, а без
// сети и кэша npx падает сразу, а не через минуты. --prefix от $CLAUDE_PROJECT_DIR, а не от
// текущего каталога (сессия могла сделать cd): пакет из node_modules проекта найдётся из любого
// подкаталога. Кавычки — ради пробелов в пути.
const HOOK_RUNNER = 'npx -y --prefer-offline --fetch-retries=0 --prefix "$CLAUDE_PROJECT_DIR"';

// Запись и начало хода без сети молча пропускаются.
const SKIP_ON_FAILURE = "true";

// Запасной путь срабатывает и когда хук остановки упал внутри, поэтому текст не обещает причину.
// Без апострофов: команда лежит в одинарных кавычках.
const STOP_FAILURE_MESSAGE =
  "Cyberzavod: the stop hook failed or could not start (for example, npx without network). Project checks were skipped.";

function stopFailureCommand(): string {
  return `echo '${JSON.stringify({ systemMessage: STOP_FAILURE_MESSAGE })}'`;
}

// Флаги npx между `npx` и пакетом в следующих версиях могут измениться: хуки прежних версий
// узнаются по пакету и имени хука, а не по полному началу команды.
const NPX_HANDLER_PATTERN = new RegExp(`^npx\\s.*\\s${PACKAGE_NAME}@(\\S+) hook `);

// Версия, на которую ссылается свой обработчик; у прежнего CLI в проекте версии нет, он узнаётся
// по имени файла. Чужой обработчик — undefined.
function ownVersionOf(handler: HookHandler): string | undefined {
  const [, npxVersion] = NPX_HANDLER_PATTERN.exec(handler.command) ?? [];

  if (npxVersion !== undefined) return npxVersion;

  return handler.command.includes(LEGACY_TOOL_FILE) ? LEGACY_TOOL_FILE : undefined;
}

function isOwnHandler(handler: HookHandler): boolean {
  return ownVersionOf(handler) !== undefined;
}

// `|| …` срабатывает на любой ненулевой код, поэтому запасной путь — только для «npx не
// запустился»: остановка блокирует JSON-решением с кодом 0, а не кодом 2. Синтаксис POSIX: на
// Windows Claude Code запускает хуки через Git Bash, PowerShell не поддерживается.
function hookCommand(version: string, hook: HookName, onFailure: string): string {
  return `${HOOK_RUNNER} ${PACKAGE_NAME}@${version} hook ${hook} || ${onFailure}`;
}

/**
 * Обработчики адаптера для версии Cyberzavod из конфига проекта: запись сессии на каждом событии,
 * начало хода и проверки при остановке.
 * @param {string} version Версия Cyberzavod из конфига проекта.
 * @returns {AdapterHooks} Обработчики по событиям.
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

/**
 * Хуки адаптера в настройках проекта: все на месте (`installed`), своих нет (`missing`), свои
 * ссылаются на другие версии (`otherVersion`; прежний CLI в проекте называется как
 * `LEGACY_TOOL_FILE`) или у событий `events` нет какого-то обработчика этой версии (`incomplete`).
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
 * Сверяет хуки в настройках проекта с теми, что адаптер ставит для версии из конфига. Чужие
 * обработчики и прочие настройки в расчёт не идут.
 * @param {Settings} settings Настройки проекта; пустой объект, если файла нет.
 * @param {string} version Версия Cyberzavod из конфига проекта.
 * @returns {HooksInspection} Состояние хуков.
 * @throws {SettingsError} Если `hooks` в настройках не того вида.
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
 * Запреты адаптера, которых в настройках проекта ещё нет: их допишет sync.
 * @param {Settings} settings Настройки проекта; пустой объект, если файла нет.
 * @returns {string[]} Недостающие запреты по порядку `ADAPTER_DENY`.
 * @throws {SettingsError} Если `permissions` в настройках не того вида.
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
 * Убирает из настроек проекта то, что поставил адаптер: свои обработчики хуков и перечисленные
 * запреты. Чужие обработчики, запреты и прочие настройки остаются; опустевшие `hooks` и
 * `permissions` убираются.
 * @param {Settings} settings Настройки проекта.
 * @param {readonly string[]} deny Запреты, которые дописал адаптер.
 * @returns {Settings} Настройки без адаптера; пустой объект, если в них больше ничего нет.
 * @throws {SettingsError} Если `hooks` или `permissions` в настройках не того вида.
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
