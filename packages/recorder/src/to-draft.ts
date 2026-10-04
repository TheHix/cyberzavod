// Сырой журнал Claude Code → черновик записи сборки.
// Этапы выводятся из действий агента по таблицам ниже; новый признак этапа — новая строка в таблице.

import type { Stage } from "@cyberzavod/core";
import type { Draft, DraftEvent } from "./draft.ts";
import type { RawEvent } from "./raw-event.ts";
import type { ModelReply } from "./transcript.ts";

// Инструменты, по которым видно этап.
const TOOL_STAGES: Readonly<Record<string, Stage>> = {
  Edit: "code",
  Write: "code",
  MultiEdit: "code",
  NotebookEdit: "code",
  ExitPlanMode: "spec",
};

// Программы, по запуску которых видно этап. Сравнивается начало каждой команды в цепочке
// (`cd apps/api && go test ./...`), а не любая подстрока: `cat eslint.config.js`
// или `grep vitest` — не проверки.
const COMMAND_STAGES: readonly { pattern: RegExp; stage: Stage }[] = [
  { pattern: /^make check\b/, stage: "test" },
  { pattern: /^pnpm (?:-r |--filter \S+ )?(?:run )?(?:check|test|lint)\b/, stage: "test" },
  { pattern: /^(?:pnpm exec |npx )?(?:vitest|eslint|prettier --check)(?:\s|$)/, stage: "test" },
  { pattern: /^go test\b/, stage: "test" },
  { pattern: /^golangci-lint run\b/, stage: "test" },
  { pattern: /^node --test\b/, stage: "test" },
  { pattern: /^git (?:commit|push)\b/, stage: "ship" },
];

// Разделители команд в одном вызове Bash, включая перевод строки в многострочной команде.
const COMMAND_SEPARATOR = /\s*(?:&&|\|\||;|\||\n)\s*/;
// Присваивания переменных перед командой: `CI=1 pnpm test`.
const LEADING_ENV_ASSIGNMENTS = /^(?:\w+=\S*\s+)*/;

// Сабагенты, по которым видно этап: встроенный Plan и станции пайплайна /feature
// из .claude/agents/.
const AGENT_STAGES: Readonly<Record<string, Stage>> = {
  Plan: "spec",
  analyst: "spec",
  coder: "code",
  tester: "test",
  reviewer: "review",
};

// Вердикты станций /feature — первая строка ответа агента. Отказ возвращает деталь с этапа
// агента, а последний вердикт, как и последний запуск проверок, решает исход сборки.
type Verdict = { passed: true } | { passed: false; reason: string };
const VERDICTS: Readonly<Record<string, Verdict>> = {
  "ПРОВЕРКИ ПРОЙДЕНЫ": { passed: true },
  ПРИНЯТО: { passed: true },
  ДЕФЕКТ: { passed: false, reason: "тестировщик нашёл дефект" },
  "НА ДОРАБОТКУ": { passed: false, reason: "ревью вернуло на доработку" },
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

const SHORT_SESSION_LENGTH = 8;
// Длина дня `2026-10-04` в начале строки toISOString — по UTC, где бы ни собирали черновик.
const ISO_DATE_LENGTH = 10;
const TEST_FAILURE_REASON = "проверки не прошли";

/** Данные сборки, которых нет в журнале. */
export interface DraftMeta {
  sessionId: string;
  tokens?: number;
  /** Ответы моделей из транскрипта сессии: по ним промпт узнаёт свою модель. */
  replies?: readonly ModelReply[];
}

// Промпт получила модель, которая первой ответила после него.
function modelAnswering(replies: readonly ModelReply[], promptTs: number): string | undefined {
  return replies.find((reply) => reply.ts >= promptTs)?.model;
}

// Этапы распознанных команд цепочки по порядку: `make check && git commit` — проверки, затем выпуск.
function stagesOfCommand(command: string): Stage[] {
  return command.split(COMMAND_SEPARATOR).flatMap((segment) => {
    const program = segment.trim().replace(LEADING_ENV_ASSIGNMENTS, "");
    const rule = COMMAND_STAGES.find(({ pattern }) => pattern.test(program));
    return rule === undefined ? [] : [rule.stage];
  });
}

// Пройденные вызовом этапы. Успешная цепочка прошла все свои этапы. Упавшая — только первый:
// дальше первой распознанной команды выполнение, скорее всего, не дошло, и её падение —
// причина неудачи всей цепочки.
function stagesReachedByTool(event: Extract<RawEvent, { kind: "tool" }>): Stage[] {
  const byTool = TOOL_STAGES[event.tool];
  if (byTool !== undefined) return [byTool];
  if (event.tool !== "Bash" || event.command === undefined) return [];
  const stages = stagesOfCommand(event.command);
  return event.ok ? stages : stages.slice(0, 1);
}

/**
 * Отличает сообщение человека от служебного сообщения среды Claude Code.
 * @param {string} text Текст события UserPromptSubmit.
 * @returns {boolean} true, если сообщение написал человек.
 */
export function isHumanPrompt(text: string): boolean {
  const start = text.trimStart();
  return !SERVICE_MESSAGE_PREFIXES.some((prefix) => start.startsWith(prefix));
}

// Вердикт по строке из журнала; Object.hasOwn — чтобы «constructor» не нашёлся в прототипе.
function verdictFor(line: string | undefined): Verdict | undefined {
  return line !== undefined && Object.hasOwn(VERDICTS, line) ? VERDICTS[line] : undefined;
}

function agentWindowKey(
  event: Extract<RawEvent, { kind: "subagent_start" | "subagent_stop" }>,
): string {
  return event.agentId ?? event.agent;
}

/**
 * Собирает черновик записи из сырого журнала: промпты человека, этапы и итог.
 * Заголовок и чистовые версии промптов остаются пустыми — их заполняет редактор.
 * @param {RawEvent[]} rawEvents События журнала в любом порядке.
 * @param {DraftMeta} meta Данные сборки, которых нет в журнале.
 * @returns {Draft} Черновик с id вида `2026-10-04-744e7547`: день начала по UTC и начало
 *   id сессии.
 */
export function toDraft(rawEvents: RawEvent[], meta: DraftMeta): Draft {
  const events = [...rawEvents].sort((a, b) => a.ts - b.ts);
  const startTs = events[0]?.ts ?? 0;
  const endTs = events.at(-1)?.ts ?? startTs;
  const at = (ts: number) => ts - startTs;

  const draftEvents: DraftEvent[] = [{ t: 0, type: "build_start" }];
  let currentStage: Stage | null = null;
  // Сборка считается успешной, если последняя проверка прошла (или их не было): запуск
  // проверок или вердикт тестировщика и ревьюера.
  let lastChecksOk = true;
  // Инструменты сабагента приходят в той же сессии и ничем не помечены. Пока работает сабагент
  // со своим этапом, этап задаёт он: make check внутри ревьюера — часть ревью, а не возврат
  // к тестам. Окна ведутся по agent_id; остановка без парного старта (служебные сабагенты
  // Claude Code) ничего не закрывает.
  const stagedAgentWindows = new Set<string>();
  // Вердикт станции приходит с её остановкой (терминальный Claude Code) или отдельным
  // отчётом по agent_id (десктопное приложение). Каждый запуск судится один раз; повторный
  // запуск того же агента после SendMessage — новый запуск со своим вердиктом.
  const agentsById = new Map<string, string>();
  const judgedRuns = new Set<string>();

  const enterStage = (stage: Stage, ts: number) => {
    if (stage === currentStage) return;
    draftEvents.push({ t: at(ts), type: "stage_enter", stage });
    currentStage = stage;
  };

  const judge = (agent: string, run: string, line: string | undefined, ts: number) => {
    const stage = AGENT_STAGES[agent];
    const verdict = verdictFor(line);
    if (stage === undefined || verdict === undefined || judgedRuns.has(run)) return;
    judgedRuns.add(run);
    lastChecksOk = verdict.passed;
    if (!verdict.passed) {
      draftEvents.push({ t: at(ts), type: "stage_fail", stage, reason: verdict.reason });
    }
  };

  for (const event of events) {
    switch (event.kind) {
      case "prompt":
        if (isHumanPrompt(event.text)) {
          const model = modelAnswering(meta.replies ?? [], event.ts);
          draftEvents.push({
            t: at(event.ts),
            type: "draft_prompt",
            said: event.text,
            goal: "",
            requirements: [],
            ...(model === undefined ? {} : { model }),
          });
        }
        break;
      case "subagent_start": {
        if (event.agentId !== undefined) agentsById.set(event.agentId, event.agent);
        judgedRuns.delete(agentWindowKey(event));
        const stage = AGENT_STAGES[event.agent];
        if (stage === undefined) break;
        stagedAgentWindows.add(agentWindowKey(event));
        enterStage(stage, event.ts);
        break;
      }
      case "subagent_stop":
        stagedAgentWindows.delete(agentWindowKey(event));
        judge(event.agent, agentWindowKey(event), event.verdict, event.ts);
        break;
      case "subagent_report": {
        const agent = agentsById.get(event.agentId);
        if (agent !== undefined) judge(agent, event.agentId, event.verdict, event.ts);
        break;
      }
      case "tool": {
        if (stagedAgentWindows.size > 0) break;
        for (const stage of stagesReachedByTool(event)) {
          enterStage(stage, event.ts);
          if (stage !== "test") continue;
          lastChecksOk = event.ok;
          if (!event.ok) {
            draftEvents.push({
              t: at(event.ts),
              type: "stage_fail",
              stage,
              reason: TEST_FAILURE_REASON,
            });
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
    draftEvents.push({ t: at(endTs), type: "usage", tokens: meta.tokens });
  }
  draftEvents.push({ t: at(endTs), type: "build_end", ok: lastChecksOk });

  const startedAt = new Date(startTs).toISOString();
  return {
    id: `${startedAt.slice(0, ISO_DATE_LENGTH)}-${meta.sessionId.slice(0, SHORT_SESSION_LENGTH)}`,
    startedAt,
    title: "",
    events: draftEvents,
  };
}

/**
 * Собирает пути к транскриптам сессии и её сабагентов без повторов.
 * @param {RawEvent[]} events События журнала.
 * @returns {string[]} Пути к транскриптам, по которым считаются токены.
 */
export function transcriptPaths(events: RawEvent[]): string[] {
  const paths = new Set<string>();
  for (const event of events) {
    if (
      (event.kind === "stop" || event.kind === "subagent_stop") &&
      event.transcriptPath !== undefined
    ) {
      paths.add(event.transcriptPath);
    }
  }
  return [...paths];
}

/**
 * Находит транскрипт самой сессии, без сабагентов: промпты человека получает она.
 * @param {RawEvent[]} events События журнала.
 * @returns {string | undefined} Путь к транскрипту или undefined, если сессия ещё не
 *   останавливалась.
 */
export function sessionTranscriptPath(events: RawEvent[]): string | undefined {
  let transcriptPath: string | undefined;
  for (const event of events) {
    if (event.kind === "stop" && event.transcriptPath !== undefined) {
      transcriptPath = event.transcriptPath;
    }
  }
  return transcriptPath;
}
