// Сырой журнал сборки: компактное событие на каждый хук Claude Code.
// Из полезной нагрузки хука берётся только то, что нужно для записи, — без содержимого
// файлов и ответов инструментов, чтобы в журнал не попадало лишнее.

import type { ProjectConfig } from "./project.ts";

/** Событие сырого журнала сборки; `ts` — время по часам машины в миллисекундах. */
export type RawEvent =
  | {
      ts: number;
      kind: "session_start";
      /** Идентификатор проекта из `.cyberzavod/project.json`; приходит вместе с `factory`. */
      project?: string;
      /** Версия завода из `.cyberzavod/project.json`; приходит вместе с `project`. */
      factory?: string;
    }
  | { ts: number; kind: "prompt"; text: string }
  | {
      ts: number;
      kind: "tool";
      tool: string;
      ok: boolean;
      command?: string;
      file?: string;
      /** Каталог, в котором шла сессия или сабагент в момент вызова инструмента. */
      cwd?: string;
      /** Сабагент, вызвавший инструмент; у вызова основной сессии поля нет. */
      agentId?: string;
    }
  | { ts: number; kind: "subagent_start"; agent: string; agentId?: string }
  | {
      ts: number;
      kind: "subagent_stop";
      agent: string;
      agentId?: string;
      transcriptPath?: string;
      /** Первая строка ответа сабагента: у станций пайплайна /feature это вердикт. */
      verdict?: string;
    }
  | { ts: number; kind: "subagent_report"; agentId: string; verdict?: string }
  | { ts: number; kind: "stop"; transcriptPath?: string };

/** Начало сессии в журнале сборки. */
export type SessionStartEvent = Extract<RawEvent, { kind: "session_start" }>;

/** Ошибка формата журнала: разобранная строка не похожа на событие. */
export class RawLogError extends Error {}

// Команды Bash обрезаются: для записи важно, что запускалось, а не полный текст.
const MAX_COMMAND_LENGTH = 200;
const UNKNOWN = "unknown";
// Вердикт — короткая строка вроде «НА ДОРАБОТКУ»; длинная первая строка — уже сам отчёт.
const MAX_VERDICT_LENGTH = 40;
// Оформление вокруг вердикта: **ПРИНЯТО**, `ДЕФЕКТ`, # ПРИНЯТО, «НА ДОРАБОТКУ.».
const VERDICT_MARKUP = /[*_`#]/g;
const TRAILING_PUNCTUATION = /[.:!]+$/;
// Пометки среды Claude Code перед отчётом сабагента — в квадратных скобках, это не вердикт.
const HARNESS_NOTE_START = "[";
// В десктопном приложении сабагент сдаёт работу инструментом SubagentHandback без текста
// ответа, и отчёт приходит в сессию сообщением: <agent-message from="<agent_id>">
// [Subagent hand-back] … The report follows: <отчёт с отступом>.
const SUBAGENT_REPORT = /^<agent-message from="([^"]+)">\s*\[Subagent hand-back\]/;
const REPORT_START = "The report follows:";
// session_id уходит в имя файла журнала — пропускаются только безопасные символы.
const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

type HookPayload = Record<string, unknown>;

function isPayload(value: unknown): value is HookPayload {
  return typeof value === "object" && value !== null;
}

function stringField(payload: HookPayload, key: string): string | undefined {
  const value = payload[key];
  return typeof value === "string" ? value : undefined;
}

// Инструменты сабагентов приходят в той же сессии: по `agentId` вызов сабагента отличается
// от вызова основной сессии, а по `cwd` находится проект, в котором шла команда.
function toolEvent(payload: HookPayload, ts: number, ok: boolean): RawEvent {
  const input = isPayload(payload.tool_input) ? payload.tool_input : {};
  const command = stringField(input, "command");
  return withOptional<Extract<RawEvent, { kind: "tool" }>>(
    {
      ts,
      kind: "tool",
      tool: stringField(payload, "tool_name") ?? UNKNOWN,
      ok,
    },
    {
      command: command?.slice(0, MAX_COMMAND_LENGTH),
      file: stringField(input, "file_path") ?? stringField(input, "notebook_path"),
      cwd: stringField(payload, "cwd"),
      agentId: stringField(payload, "agent_id"),
    },
  );
}

// Из ответа сабагента в журнал идёт только первая строка: станции пайплайна начинают
// с неё вердикт, а остальной отчёт для записи не нужен.
function verdictOf(reply: string | undefined): string | undefined {
  const firstLine = reply
    ?.split("\n")
    .map((line) => line.replace(VERDICT_MARKUP, "").trim().replace(TRAILING_PUNCTUATION, ""))
    .find((line) => line !== "" && !line.startsWith(HARNESS_NOTE_START));
  return firstLine !== undefined && firstLine.length <= MAX_VERDICT_LENGTH ? firstLine : undefined;
}

// Служебные сабагенты Claude Code приходят с пустым agent_type.
function agentName(payload: HookPayload): string {
  return stringField(payload, "agent_type") || UNKNOWN;
}

// Необязательные поля добавляются, только если они есть: в журнале не копятся undefined.
// Partial<T> — опечатка в имени поля не скомпилируется.
function withOptional<T extends object>(event: T, fields: Partial<T>): T {
  const present = Object.entries(fields).filter(([, value]) => value !== undefined);
  return { ...event, ...Object.fromEntries(present) };
}

// Отчёт сабагента, пришедший сообщением в сессию, — не промпт человека: из него в журнал
// идут только id агента и вердикт.
function subagentReport(text: string, ts: number): RawEvent | undefined {
  const agentId = SUBAGENT_REPORT.exec(text)?.[1];
  if (agentId === undefined) return undefined;
  const reportStart = text.indexOf(REPORT_START);
  const report = reportStart === -1 ? undefined : text.slice(reportStart + REPORT_START.length);
  return withOptional<Extract<RawEvent, { kind: "subagent_report" }>>(
    { ts, kind: "subagent_report", agentId },
    { verdict: verdictOf(report) },
  );
}

/**
 * Превращает полезную нагрузку хука Claude Code в событие журнала.
 * @param {unknown} payload JSON, который хук получил на stdin.
 * @param {number} ts Время события в миллисекундах.
 * @returns {RawEvent | null} Событие журнала или null, если хук для записи не нужен.
 */
export function fromHookPayload(payload: unknown, ts: number): RawEvent | null {
  if (!isPayload(payload)) return null;

  switch (stringField(payload, "hook_event_name")) {
    case "SessionStart":
      return { ts, kind: "session_start" };
    case "UserPromptSubmit": {
      const text = stringField(payload, "prompt");
      if (text === undefined) return null;
      return subagentReport(text, ts) ?? { ts, kind: "prompt", text };
    }
    case "PostToolUse":
      return toolEvent(payload, ts, true);
    case "PostToolUseFailure":
      return toolEvent(payload, ts, false);
    case "SubagentStart":
      return withOptional<Extract<RawEvent, { kind: "subagent_start" }>>(
        { ts, kind: "subagent_start", agent: agentName(payload) },
        { agentId: stringField(payload, "agent_id") },
      );
    case "SubagentStop":
      return withOptional<Extract<RawEvent, { kind: "subagent_stop" }>>(
        { ts, kind: "subagent_stop", agent: agentName(payload) },
        {
          agentId: stringField(payload, "agent_id"),
          transcriptPath: stringField(payload, "agent_transcript_path"),
          verdict: verdictOf(stringField(payload, "last_assistant_message")),
        },
      );
    case "Stop":
      return withOptional<Extract<RawEvent, { kind: "stop" }>>(
        { ts, kind: "stop" },
        { transcriptPath: stringField(payload, "transcript_path") },
      );
    default:
      return null;
  }
}

/**
 * Помечает начало сессии проектом и версией завода из конфига проекта.
 * @param {SessionStartEvent} event Начало сессии.
 * @param {ProjectConfig} project Конфиг проекта, в котором идёт сессия.
 * @returns {SessionStartEvent} Новое событие с `project` и `factory`.
 */
export function stampProject(event: SessionStartEvent, project: ProjectConfig): SessionStartEvent {
  return { ...event, project: project.id, factory: project.factory };
}

/**
 * Проверяет, что id сессии можно использовать в имени файла журнала.
 * @param {unknown} value Значение session_id из полезной нагрузки хука.
 * @returns {value is string} true, если id можно подставить в имя файла журнала.
 */
export function isSafeSessionId(value: unknown): value is string {
  return typeof value === "string" && SESSION_ID_PATTERN.test(value);
}

// Проверка обязательных полей каждого вида события. Тип требует запись для каждого вида:
// новый вид в RawEvent не скомпилируется, пока здесь не опишут его проверку.
const RAW_EVENT_SHAPES: Record<RawEvent["kind"], (value: HookPayload) => boolean> = {
  session_start: (value) =>
    (value.project === undefined && value.factory === undefined) ||
    (typeof value.project === "string" && typeof value.factory === "string"),
  prompt: (value) => typeof value.text === "string",
  tool: (value) => typeof value.tool === "string" && typeof value.ok === "boolean",
  subagent_start: (value) => typeof value.agent === "string",
  subagent_stop: (value) => typeof value.agent === "string",
  subagent_report: (value) => typeof value.agentId === "string",
  stop: () => true,
};

function isRawEventKind(kind: string): kind is RawEvent["kind"] {
  return Object.hasOwn(RAW_EVENT_SHAPES, kind);
}

function isRawEvent(value: unknown): value is RawEvent {
  if (!isPayload(value) || typeof value.ts !== "number" || typeof value.kind !== "string") {
    return false;
  }
  return isRawEventKind(value.kind) && RAW_EVENT_SHAPES[value.kind](value);
}

/**
 * Читает журнал сборки. Строка, которая не разбирается как JSON, — оборванная асинхронная
 * запись, она пропускается.
 * @param {string} content Содержимое журнала в формате JSONL.
 * @returns {RawEvent[]} События журнала по порядку строк.
 * @throws {RawLogError} Если разобранная строка не является событием журнала.
 */
export function parseRawLog(content: string): RawEvent[] {
  const events: RawEvent[] = [];
  content.split("\n").forEach((line, index) => {
    if (line.trim() === "") return;
    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch {
      return;
    }
    if (!isRawEvent(value)) throw new RawLogError(`строка ${index + 1}: не событие журнала`);
    events.push(value);
  });
  return events;
}
