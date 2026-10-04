// Сырой журнал Claude Code → запись сборки в формате ядра.
// Этапы выводятся из действий агента по таблицам ниже; новый признак этапа — новая строка в таблице.

import { parseRecording, type FactoryEvent, type Recording, type Stage } from "@cyberzavod/core";
import type { RawEvent } from "./raw-event.ts";

// Инструменты, по которым видно этап.
const TOOL_STAGES: Readonly<Record<string, Stage>> = {
  Edit: "code",
  Write: "code",
  MultiEdit: "code",
  NotebookEdit: "code",
  ExitPlanMode: "spec",
};

// Команды Bash, по которым видно этап.
const COMMAND_STAGES: ReadonlyArray<{ pattern: RegExp; stage: Stage }> = [
  { pattern: /\b(make check|pnpm (?:-r )?(?:run )?(?:check|test)|go test|node --test)\b/, stage: "test" },
  { pattern: /\bgit (commit|push)\b/, stage: "ship" },
];

// Сабагенты, по которым видно этап.
const AGENT_STAGES: Readonly<Record<string, Stage>> = {
  reviewer: "review",
  Plan: "spec",
};

// Среда Claude Code доставляет отчёты сабагентов и уведомления тем же событием, что и
// сообщения человека. По этим началам их отличаем: в записи — только промпты человека.
const SERVICE_MESSAGE_PREFIXES: readonly string[] = [
  "[Subagent hand-back]",
  "[SYSTEM NOTIFICATION",
  "<task-notification>",
  "<agent-message",
  "<system-reminder>",
];

const MAX_TITLE_LENGTH = 80;
const SHORT_SESSION_LENGTH = 8;
const UNTITLED = "Сборка без промпта";
const TEST_FAILURE_REASON = "проверки не прошли";

export interface RecordingMeta {
  id: string;
  tokens?: number;
}

function stageOfTool(event: Extract<RawEvent, { kind: "tool" }>): Stage | null {
  const byTool = TOOL_STAGES[event.tool];
  if (byTool !== undefined) return byTool;
  if (event.tool !== "Bash" || event.command === undefined) return null;
  const command = event.command;
  return COMMAND_STAGES.find((rule) => rule.pattern.test(command))?.stage ?? null;
}

export function isHumanPrompt(text: string): boolean {
  const start = text.trimStart();
  return !SERVICE_MESSAGE_PREFIXES.some((prefix) => start.startsWith(prefix));
}

// Заголовок обрезается по символам, а не по UTF-16: эмодзи не разрезается пополам.
function titleFrom(events: RawEvent[]): string {
  const firstPrompt = events.find((event) => event.kind === "prompt" && isHumanPrompt(event.text));
  if (firstPrompt?.kind !== "prompt") return UNTITLED;
  const characters = Array.from(firstPrompt.text.trim().replace(/\s+/g, " "));
  if (characters.length <= MAX_TITLE_LENGTH) return characters.join("");
  return `${characters.slice(0, MAX_TITLE_LENGTH - 1).join("")}…`;
}

function agentWindowKey(event: Extract<RawEvent, { kind: "subagent_start" | "subagent_stop" }>): string {
  return event.agentId ?? event.agent;
}

// Идентификатор записи: дата начала сессии (UTC) и начало id сессии.
export function recordingId(sessionId: string, startTs: number): string {
  const date = new Date(startTs).toISOString().slice(0, 10);
  return `${date}-${sessionId.slice(0, SHORT_SESSION_LENGTH)}`;
}

export function toRecording(rawEvents: RawEvent[], meta: RecordingMeta): Recording {
  const events = [...rawEvents].sort((a, b) => a.ts - b.ts);
  const startTs = events[0]?.ts ?? 0;
  const endTs = events.at(-1)?.ts ?? startTs;
  const at = (ts: number) => ts - startTs;
  const title = titleFrom(events);

  const factoryEvents: FactoryEvent[] = [{ t: 0, type: "build_start", title }];
  let currentStage: Stage | null = null;
  // Сборка считается успешной, если последний запуск проверок прошёл (или их не было).
  let lastChecksOk = true;
  // Инструменты сабагента приходят в той же сессии и ничем не помечены. Пока работает сабагент
  // со своим этапом, этап задаёт он: make check внутри ревьюера — часть ревью, а не возврат
  // к тестам. Окна ведутся по agent_id; остановка без парного старта (служебные сабагенты
  // Claude Code) ничего не закрывает.
  const stagedAgentWindows = new Set<string>();

  const enterStage = (stage: Stage, ts: number) => {
    if (stage === currentStage) return;
    factoryEvents.push({ t: at(ts), type: "stage_enter", stage });
    currentStage = stage;
  };

  for (const event of events) {
    switch (event.kind) {
      case "prompt":
        if (isHumanPrompt(event.text)) factoryEvents.push({ t: at(event.ts), type: "prompt", text: event.text });
        break;
      case "subagent_start": {
        const stage = AGENT_STAGES[event.agent];
        if (stage === undefined) break;
        stagedAgentWindows.add(agentWindowKey(event));
        enterStage(stage, event.ts);
        break;
      }
      case "subagent_stop":
        stagedAgentWindows.delete(agentWindowKey(event));
        break;
      case "tool": {
        if (stagedAgentWindows.size > 0) break;
        const stage = stageOfTool(event);
        if (stage === null) break;
        enterStage(stage, event.ts);
        if (stage === "test") {
          lastChecksOk = event.ok;
          if (!event.ok) {
            factoryEvents.push({ t: at(event.ts), type: "stage_fail", stage, reason: TEST_FAILURE_REASON });
          }
        }
        break;
      }
      case "session_start":
      case "stop":
        break;
      default:
        event satisfies never;
    }
  }

  if (meta.tokens !== undefined) {
    factoryEvents.push({ t: at(endTs), type: "usage", tokens: meta.tokens });
  }
  factoryEvents.push({ t: at(endTs), type: "build_end", ok: lastChecksOk });

  // Через ту же проверку, что и записи на сайте: собранное должно быть корректной записью.
  return parseRecording({ version: 1, id: meta.id, title, events: factoryEvents });
}

// Транскрипты сессии и её сабагентов: токены считаются по всем.
export function transcriptPaths(events: RawEvent[]): string[] {
  const paths = new Set<string>();
  for (const event of events) {
    if ((event.kind === "stop" || event.kind === "subagent_stop") && event.transcriptPath !== undefined) {
      paths.add(event.transcriptPath);
    }
  }
  return [...paths];
}
