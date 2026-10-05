// Сырой журнал Claude Code → черновик записи сборки.
// Этапы выводятся из действий агента по таблицам ниже; новый признак этапа — новая строка в таблице.

import { FOREMAN, STAGES, type Speaker, type Stage } from "@cyberzavod/core";
import { eventBuilds } from "./builds.ts";
import type {
  Draft,
  DraftBuild,
  DraftEvent,
  DraftMessage,
  DraftRun,
  MessageSource,
} from "./draft.ts";
import type { RawEvent } from "./raw-event.ts";
import type {
  AgentAssignment,
  AgentReport,
  ModelReply,
  TokenUsage,
  TranscriptText,
} from "./transcript.ts";

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

// Вердикты станций /feature — первая строка ответа агента, по агенту: чужое слово вердиктом
// не считается (`НА ДОРАБОТКУ` у тестировщика), а у агентов без таблицы (analyst, coder) первая
// строка — просто начало отчёта. Отказ возвращает деталь с этапа агента, а последний вердикт,
// как и последний запуск проверок, решает исход сборки.
type Verdict = { passed: true } | { passed: false; reason: string };
const VERDICTS: Readonly<Record<string, Readonly<Record<string, Verdict>>>> = {
  tester: {
    "ПРОВЕРКИ ПРОЙДЕНЫ": { passed: true },
    ГОТОВО: { passed: true },
    ДЕФЕКТ: { passed: false, reason: "тестировщик нашёл дефект" },
  },
  reviewer: {
    ПРИНЯТО: { passed: true },
    "НА ДОРАБОТКУ": { passed: false, reason: "ревью вернуло на доработку" },
  },
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
// Участок токенов до первой привязки сборки: ему нет события, после которого его вставить.
const BEFORE_FIRST_ANCHOR = -1;

/** Данные сборки, которых нет в журнале. */
export interface DraftMeta {
  sessionId: string;
  /** Токены запусков сабагентов по `agentId`: каждый запуск несёт свой транскрипт. */
  runTokens?: ReadonlyMap<string, number>;
  /** Токены сообщений основной сессии: по ним они раскладываются между сборками. */
  sessionUsages?: readonly TokenUsage[];
  /** Ответы моделей из транскрипта сессии: по ним промпт узнаёт свою модель. */
  replies?: readonly ModelReply[];
  /** Ответы модели из транскрипта сессии: из них берутся итоговые ответы человеку. */
  answers?: readonly TranscriptText[];
  /** Задания сабагентам из транскрипта сессии. */
  assignments?: readonly AgentAssignment[];
  /** Отчёты запусков сабагентов из их транскриптов. */
  reports?: readonly AgentReport[];
}

// Этап станции по имени агента; Object.hasOwn — чтобы «constructor» не нашёлся в прототипе.
function stageOfAgent(agent: string | undefined): Stage | undefined {
  return agent !== undefined && Object.hasOwn(AGENT_STAGES, agent)
    ? AGENT_STAGES[agent]
    : undefined;
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

// Вердикт агента по строке из журнала; Object.hasOwn на обоих уровнях — чтобы «constructor»
// не нашёлся в прототипе.
function verdictFor(agent: string, line: string | undefined): Verdict | undefined {
  if (line === undefined || !Object.hasOwn(VERDICTS, agent)) return undefined;
  const verdicts = VERDICTS[agent];
  return verdicts !== undefined && Object.hasOwn(verdicts, line) ? verdicts[line] : undefined;
}

function agentWindowKey(
  event: Extract<RawEvent, { kind: "subagent_start" | "subagent_stop" }>,
): string {
  return event.agentId ?? event.agent;
}

// Этап в момент t — этап последнего входа на станцию; до первого входа деталь у постановки.
function stageAt(events: readonly DraftEvent[], t: number): Stage {
  let stage: Stage = STAGES[0];
  for (const event of events) {
    if (event.t > t) break;
    if (event.type === "stage_enter") stage = event.stage;
  }
  return stage;
}

function draftMessage(
  t: number,
  from: Speaker,
  to: Speaker,
  source: MessageSource,
  said: string,
  run: string | undefined,
): DraftMessage {
  return {
    t,
    type: "draft_message",
    from,
    to,
    source,
    said,
    line: "",
    text: "",
    ...(run === undefined ? {} : { run }),
  };
}

// Агенты запусков по id: из старта сабагента видно, чей отчёт или чьё сообщение это было.
function agentsByIdOf(events: readonly RawEvent[]): Map<string, string> {
  const agents = new Map<string, string>();
  for (const event of events) {
    if (event.kind === "subagent_start" && event.agentId !== undefined) {
      agents.set(event.agentId, event.agent);
    }
  }
  return agents;
}

// Ремарка — всё, что прозвучало в сессии, ещё без адресата: его даёт ход, в котором она стоит.
// `stage` — станция, чьё слово это: у задания и отчёта — станция агента, у ответа — этап
// в момент ответа. `run` — запуск станции, о котором речь.
interface Remark {
  kind: MessageSource;
  t: number;
  stage: Stage;
  said: string;
  run?: string;
}

function runMark(run: string | undefined): { run?: string } {
  return run === undefined ? {} : { run };
}

// Задание станции: рабочий агента принимает его. Агенты не из AGENT_STAGES пропускаются.
function assignmentRemarks(
  assignments: readonly AgentAssignment[],
  agentsById: ReadonlyMap<string, string>,
  at: (ts: number) => number,
): Remark[] {
  return assignments.flatMap((assignment): Remark[] => {
    const agent =
      assignment.via === "spawn" ? assignment.agentType : agentsById.get(assignment.agentId);
    const stage = stageOfAgent(agent);
    return stage === undefined
      ? []
      : [
          {
            kind: "assignment",
            t: at(assignment.ts),
            stage,
            said: assignment.text,
            ...runMark(assignment.agentId),
          },
        ];
  });
}

// Отчёт станции: рабочий этапа сдаёт работу.
function reportRemarks(
  reports: readonly AgentReport[],
  agentsById: ReadonlyMap<string, string>,
  at: (ts: number) => number,
): Remark[] {
  return reports.flatMap((report): Remark[] => {
    const stage = stageOfAgent(agentsById.get(report.agentId));
    return stage === undefined
      ? []
      : [{ kind: "report", t: at(report.ts), stage, said: report.text, run: report.agentId }];
  });
}

// Ход — от промпта человека до следующего промпта человека (или до конца журнала).
interface Turn {
  from: number;
  to: number;
}

function turnsOf(events: readonly RawEvent[]): Turn[] {
  const starts = events
    .filter((event) => event.kind === "prompt" && isHumanPrompt(event.text))
    .map((event) => event.ts);
  return starts.map((from, index) => ({ from, to: starts[index + 1] ?? Number.POSITIVE_INFINITY }));
}

// Итоговый ответ хода — последний текст модели в нём; говорит его рабочий этапа в момент ответа.
function answerRemarks(
  events: readonly RawEvent[],
  answers: readonly TranscriptText[],
  stageOnTime: (t: number) => Stage,
  at: (ts: number) => number,
): Remark[] {
  return turnsOf(events).flatMap((turn): Remark[] => {
    const answer = answers.findLast(({ ts }) => ts >= turn.from && ts < turn.to);
    if (answer === undefined) return [];
    const t = at(answer.ts);
    return [{ kind: "answer", t, stage: stageOnTime(t), said: answer.text }];
  });
}

// С кем говорит рабочий, сдавая работу или отвечая: следующему по заданию, а если после него
// никого — мастеру. Задание той же станции не в счёт: это дополнение к её же работе.
function recipientOfReport(remarks: readonly Remark[], index: number, stage: Stage): Speaker {
  for (const next of remarks.slice(index + 1)) {
    if (next.kind === "answer") return FOREMAN;
    if (next.kind === "assignment" && next.stage !== stage) return next.stage;
  }
  return FOREMAN;
}

// От кого рабочий получил задание: от станции, сдавшей работу последней (не его самого),
// а если такой нет — от мастера, который только что поставил задачу.
function giverOfAssignment(remarks: readonly Remark[], index: number, stage: Stage): Speaker {
  const report = remarks
    .slice(0, index)
    .findLast((previous) => previous.kind === "report" && previous.stage !== stage);
  return report?.stage ?? FOREMAN;
}

// Маршрут ремарки: говорит рабочий станции. Задание принимает принимающий («Принял, изучу»),
// отчёт говорит сдающий («Держи»), ответ — мастеру.
function routeOf(
  remark: Remark,
  remarks: readonly Remark[],
  index: number,
): Pick<DraftMessage, "from" | "to"> {
  const { kind, stage } = remark;
  switch (kind) {
    case "assignment":
      return { from: stage, to: giverOfAssignment(remarks, index, stage) };
    case "report":
      return { from: stage, to: recipientOfReport(remarks, index, stage) };
    case "answer":
      return { from: stage, to: FOREMAN };
    default:
      return kind satisfies never;
  }
}

// Ремарки делятся на ходы по промптам человека: ход длится от промпта до следующего, а то,
// что прозвучало до первого промпта, образует свой ход.
function splitIntoTurns<T extends { remark: Remark }>(
  items: readonly T[],
  promptTimes: readonly number[],
): T[][] {
  const turns: T[][] = [[], ...promptTimes.map((): T[] => [])];
  for (const item of items) {
    const turn = promptTimes.filter((promptTime) => promptTime <= item.remark.t).length;
    turns[turn]?.push(item);
  }
  return turns;
}

// Реплики встают после событий с тем же t: сначала происходит событие, потом о нём говорят.
function mergeMessages(events: readonly DraftEvent[], messages: readonly DraftMessage[]) {
  const merged: DraftEvent[] = [];
  let pending = [...messages].sort((a, b) => a.t - b.t);
  for (const event of events) {
    const earlier = pending.filter((message) => message.t < event.t);
    merged.push(...earlier, event);
    pending = pending.slice(earlier.length);
  }
  return [...merged, ...pending];
}

// Ремарка реплики черновика: у ответа этап — этап сборки в момент ответа, у остальных — тот,
// кто говорит.
function remarkOfMessage(message: DraftMessage, buildEvents: readonly DraftEvent[]): Remark {
  const { source, t, from, said } = message;
  return {
    kind: source,
    t,
    said,
    stage: source === "answer" ? stageAt(buildEvents, t) : stageOfSpeaker(from),
  };
}

// Говорящий в реплике станции — всегда рабочий этапа: мастер сам ремарок не даёт.
function stageOfSpeaker(speaker: Speaker): Stage {
  return speaker === FOREMAN ? STAGES[0] : speaker;
}

/**
 * Пересчитывает маршруты реплик: кому говорит каждая и от чьего этапа звучит ответ. Каждая
 * сборка считается отдельно: ходы делят только её промпты, этап берётся из её событий, поэтому
 * отчёт станции одной задачи не адресуется станции другой.
 * Задание станции X говорит X тому, кто сдал работу последним (отчёт другой станции раньше
 * в ходе), а если такого нет — мастеру. Отчёт станции X говорит X тому, чьё задание идёт
 * следом (другая станция), а если раньше ответ человеку или ход кончился — мастеру. Ответ
 * говорит рабочий этапа в момент ответа мастеру.
 * @param {Draft} draft Черновик с репликами и расставленными сборками.
 * @returns {Draft} Тот же черновик, у реплик которого пересчитаны `from` и `to`.
 */
export function routeMessages(draft: Draft): Draft {
  const owners = eventBuilds(draft);
  const events = [...draft.events];
  for (const build of draft.builds) {
    const own = draft.events.flatMap((event, index) =>
      owners[index] === build.id ? [{ event, index }] : [],
    );
    const buildEvents = own.map(({ event }) => event);
    const promptTimes = buildEvents.flatMap((event) =>
      event.type === "draft_prompt" ? [event.t] : [],
    );
    const spoken = own.flatMap(({ event, index }) =>
      event.type === "draft_message"
        ? [{ message: event, index, remark: remarkOfMessage(event, buildEvents) }]
        : [],
    );
    for (const turn of splitIntoTurns(spoken, promptTimes)) {
      const remarks = turn.map(({ remark }) => remark);
      turn.forEach(({ message, index, remark }, position) => {
        events[index] = { ...message, ...routeOf(remark, remarks, position) };
      });
    }
  }
  return { ...draft, events };
}

// Проект и версия завода — из первого начала сессии, где есть оба: сессию могли подключить
// к хукам посреди работы, и тогда первое начало без проекта.
function projectOf(events: readonly RawEvent[]): Pick<DraftBuild, "project" | "factory"> {
  for (const event of events) {
    if (
      event.kind === "session_start" &&
      event.project !== undefined &&
      event.factory !== undefined
    ) {
      return { project: event.project, factory: event.factory };
    }
  }
  return { project: "", factory: "" };
}

// Событие привязывает сборку к своему месту в черновике: промпт человека или событие запуска.
function isBuildAnchor(event: DraftEvent): boolean {
  return event.type === "draft_prompt" || event.run !== undefined;
}

// Токены основной сессии ложатся в черновик по участкам между соседними привязками сборки:
// сообщения участка суммируются в одно `usage` на время первой привязки, а значит, достаются
// той же сборке. Сообщения до первой привязки идут в начало черновика, к первой сборке.
function withSessionUsages(
  events: readonly DraftEvent[],
  usages: readonly TokenUsage[],
): DraftEvent[] {
  const anchors = events.flatMap((event, index) =>
    isBuildAnchor(event) ? [{ t: event.t, index }] : [],
  );
  const sums = new Map<number, { t: number; tokens: number }>();
  for (const { ts, tokens } of usages) {
    const anchorTime = anchors.findLast((anchor) => anchor.t <= ts)?.t;
    const anchor = anchors.find(({ t }) => t === anchorTime);
    const key = anchor?.index ?? BEFORE_FIRST_ANCHOR;
    const sum = sums.get(key);
    sums.set(key, { t: anchorTime ?? 0, tokens: (sum?.tokens ?? 0) + tokens });
  }
  const toEvent = (sum: { t: number; tokens: number } | undefined): DraftEvent[] =>
    sum === undefined ? [] : [{ t: sum.t, type: "usage", tokens: sum.tokens }];
  return [
    ...toEvent(sums.get(BEFORE_FIRST_ANCHOR)),
    ...events.flatMap((event, index) => [event, ...toEvent(sums.get(index))]),
  ];
}

/**
 * Собирает черновик записи из сырого журнала: промпты человека, реплики (задания, отчёты и
 * итоговые ответы, если переданы их тексты), этапы, окна запусков станций, исходы проверок
 * и токены. Заголовок, чистовые версии промптов и `line` с `text` у реплик остаются пустыми —
 * их заполняет редактор. В черновике одна сборка с `id` черновика; проект и версия завода
 * берутся из первого начала сессии, где они есть, без них остаются пустыми. Другие сборки
 * добавляет редактор.
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
  // Время из транскрипта может выйти за журнал: реплика не должна оказаться после конца сборки.
  const atWithinBuild = (ts: number) => Math.min(Math.max(at(ts), 0), at(endTs));

  const draftEvents: DraftEvent[] = [];
  let currentStage: Stage | null = null;
  // Инструменты сабагента приходят в той же сессии и ничем не помечены. Пока работает сабагент
  // со своим этапом, этап задаёт он: make check внутри ревьюера — часть ревью, а не возврат
  // к тестам. Окна ведутся по agent_id; остановка без парного старта (служебные сабагенты
  // Claude Code) ничего не закрывает.
  const stagedAgentWindows = new Set<string>();
  // Окно запуска станции тянется до конца журнала, пока не пришла остановка.
  const openRuns = new Map<string, DraftRun>();
  // Вердикт станции приходит с её остановкой (терминальный Claude Code) или отдельным
  // отчётом по agent_id (десктопное приложение). Каждый запуск судится один раз; повторный
  // запуск того же агента после SendMessage — новый запуск со своим вердиктом.
  const agentsStarted = new Map<string, string>();
  const judgedRuns = new Set<string>();
  // Токены запуска ставятся на его последнюю остановку: транскрипт один на все его старты.
  const lastStops = new Map<string, RawEvent>();
  for (const event of events) {
    if (event.kind === "subagent_stop" && event.agentId !== undefined) {
      lastStops.set(event.agentId, event);
    }
  }

  const enterStage = (stage: Stage, ts: number, run?: string) => {
    draftEvents.push({ t: at(ts), type: "stage_enter", stage, ...runMark(run) });
    currentStage = stage;
  };

  // Инструмент не должен повторять этап, на котором сборка уже стоит: правок много, а этап один.
  const enterStageByTool = (stage: Stage, ts: number) => {
    if (stage !== currentStage) enterStage(stage, ts);
  };

  const judge = (agent: string, run: string, line: string | undefined, ts: number) => {
    const stage = stageOfAgent(agent);
    const verdict = verdictFor(agent, line);
    if (stage === undefined || verdict === undefined || judgedRuns.has(run)) return;
    judgedRuns.add(run);
    draftEvents.push({ t: at(ts), type: "draft_check", ok: verdict.passed, run });
    if (!verdict.passed) {
      draftEvents.push({ t: at(ts), type: "stage_fail", stage, reason: verdict.reason, run });
    }
  };

  const countRunTokens = (event: Extract<RawEvent, { kind: "subagent_stop" }>) => {
    const { agentId } = event;
    const tokens = agentId === undefined ? undefined : meta.runTokens?.get(agentId);
    if (agentId === undefined || tokens === undefined || lastStops.get(agentId) !== event) return;
    const run = stageOfAgent(event.agent) === undefined ? undefined : agentId;
    draftEvents.push({ t: at(event.ts), type: "usage", tokens, ...runMark(run) });
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
        if (event.agentId !== undefined) agentsStarted.set(event.agentId, event.agent);
        const run = agentWindowKey(event);
        judgedRuns.delete(run);
        const stage = stageOfAgent(event.agent);
        if (stage === undefined) break;
        stagedAgentWindows.add(run);
        enterStage(stage, event.ts, run);
        const window: DraftRun = {
          t: at(event.ts),
          type: "draft_run",
          run,
          agent: event.agent,
          until: at(endTs),
        };
        draftEvents.push(window);
        openRuns.set(run, window);
        break;
      }
      case "subagent_stop": {
        const run = agentWindowKey(event);
        stagedAgentWindows.delete(run);
        const window = openRuns.get(run);
        if (window !== undefined) window.until = at(event.ts);
        openRuns.delete(run);
        judge(event.agent, run, event.verdict, event.ts);
        countRunTokens(event);
        break;
      }
      case "subagent_report": {
        const agent = agentsStarted.get(event.agentId);
        if (agent !== undefined) judge(agent, event.agentId, event.verdict, event.ts);
        break;
      }
      case "tool": {
        if (stagedAgentWindows.size > 0) break;
        for (const stage of stagesReachedByTool(event)) {
          enterStageByTool(stage, event.ts);
          if (stage !== "test") continue;
          draftEvents.push({ t: at(event.ts), type: "draft_check", ok: event.ok });
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

  const agentsById = agentsByIdOf(events);
  const remarks = [
    ...assignmentRemarks(meta.assignments ?? [], agentsById, atWithinBuild),
    ...reportRemarks(meta.reports ?? [], agentsById, atWithinBuild),
    ...answerRemarks(events, meta.answers ?? [], (t) => stageAt(draftEvents, t), atWithinBuild),
  ];
  // Адресатов расставит routeMessages: ему нужны события уже собранного черновика.
  const messages = remarks
    .sort((a, b) => a.t - b.t)
    .map(({ kind, t, stage, said, run }) => draftMessage(t, stage, FOREMAN, kind, said, run));
  const sessionUsages = (meta.sessionUsages ?? [])
    .map(({ ts, tokens }) => ({ ts: at(ts), tokens }))
    .filter(({ ts }) => ts >= 0 && ts <= at(endTs));

  const startedAt = new Date(startTs).toISOString();
  const id = `${startedAt.slice(0, ISO_DATE_LENGTH)}-${meta.sessionId.slice(0, SHORT_SESSION_LENGTH)}`;
  return routeMessages({
    id,
    startedAt,
    builds: [{ id, ...projectOf(events), title: "", runs: [] }],
    events: withSessionUsages(mergeMessages(draftEvents, messages), sessionUsages),
  });
}

/**
 * Собирает пути к транскриптам самой сессии без повторов: по ним считаются токены основной
 * сессии.
 * @param {RawEvent[]} events События журнала.
 * @returns {string[]} Пути к транскриптам остановок сессии, без сабагентов.
 */
export function sessionTranscriptPaths(events: RawEvent[]): string[] {
  const paths = new Set<string>();
  for (const event of events) {
    if (event.kind === "stop" && event.transcriptPath !== undefined) {
      paths.add(event.transcriptPath);
    }
  }
  return [...paths];
}

/**
 * Находит транскрипты запусков сабагентов: по ним считаются токены каждого запуска.
 * @param {RawEvent[]} events События журнала.
 * @returns {Map<string, string>} Путь к транскрипту по `agentId` запуска; у запуска, который
 *   останавливался не раз, последний.
 */
export function runTranscriptPaths(events: RawEvent[]): Map<string, string> {
  const paths = new Map<string, string>();
  for (const event of events) {
    if (
      event.kind === "subagent_stop" &&
      event.agentId !== undefined &&
      event.transcriptPath !== undefined
    ) {
      paths.set(event.agentId, event.transcriptPath);
    }
  }
  return paths;
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

/**
 * Находит транскрипты станций пайплайна /feature: из них берутся отчёты.
 * @param {RawEvent[]} events События журнала.
 * @returns {string[]} Пути к транскриптам остановленных станций без повторов; служебные
 *   сабагенты, которых нет среди станций, не попадают.
 */
export function stationTranscriptPaths(events: RawEvent[]): string[] {
  const paths = new Set<string>();
  for (const event of events) {
    if (
      event.kind === "subagent_stop" &&
      event.transcriptPath !== undefined &&
      stageOfAgent(event.agent) !== undefined
    ) {
      paths.add(event.transcriptPath);
    }
  }
  return [...paths];
}
