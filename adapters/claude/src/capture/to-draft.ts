// Сырой журнал Claude Code → черновик записи сборки.
// Этапы выводятся из действий агента по таблицам ниже; новый признак этапа — новая строка в таблице.

import path from "node:path";
import {
  FOREMAN,
  STAGES,
  type InterventionReason,
  type Speaker,
  type Stage,
} from "@cyberzavod/core";
import { eventBuilds } from "./builds.ts";
import type {
  Draft,
  DraftBuild,
  DraftEvent,
  DraftIntervention,
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
  Edit: "implementation",
  Write: "implementation",
  MultiEdit: "implementation",
  NotebookEdit: "implementation",
  ExitPlanMode: "planning",
};

// Путь одним аргументом оболочки: в двойных кавычках, в простых или без них. Общая часть `cd X`
// и `git -C X`, чтобы путь с пробелом читался одинаково везде.
const PATH_ARGUMENT = String.raw`"[^"]*"|'[^']*'|\S+`;

// Программы, по запуску которых видно этап. Сравнивается начало каждой команды в цепочке
// (`cd apps/api && go test ./...`), а не любая подстрока: `cat eslint.config.js`
// или `grep vitest` — не проверки.
const COMMAND_STAGES: readonly { pattern: RegExp; stage: Stage }[] = [
  { pattern: /^make check\b/, stage: "verification" },
  { pattern: /^pnpm (?:-r |--filter \S+ )?(?:run )?(?:check|test|lint)\b/, stage: "verification" },
  {
    pattern: /^(?:pnpm exec |npx )?(?:vitest|eslint|prettier --check)(?:\s|$)/,
    stage: "verification",
  },
  { pattern: /^go test\b/, stage: "verification" },
  { pattern: /^golangci-lint run\b/, stage: "verification" },
  { pattern: /^node --test\b/, stage: "verification" },
  { pattern: new RegExp(`^git (?:-C (?:${PATH_ARGUMENT}) )?(?:commit|push)\\b`), stage: "record" },
];

// Разделители команд в одном вызове Bash, включая перевод строки в многострочной команде.
const COMMAND_SEPARATOR = /\s*(?:&&|\|\||;|\||\n)\s*/;
// Присваивания переменных перед командой: `CI=1 pnpm test`.
const LEADING_ENV_ASSIGNMENTS = /^(?:\w+=\S*\s+)*/;
// Смена каталога в цепочке: `cd X`, где X — единственный аргумент.
const CHANGE_DIRECTORY = /^cd(?:\s|$)/;
const CHANGE_DIRECTORY_TARGET = new RegExp(`^cd\\s+(${PATH_ARGUMENT})$`);
// Подоболочка, `pushd` и составные команды меняют каталог так, что по тексту команды его не
// проследить: `{ cd /b; }`, `if …; then cd /b; fi`, `do cd /b`, `command cd /b`. Слова
// составных команд (`{`, `then`, `do`, `else`) и `command cd` стоят перед настоящей командой
// сегмента, поэтому он целиком получает неизвестное место. Другие `command` (`command -v jq`)
// каталог не меняют и место не трогают.
const UNTRACKABLE_DIRECTORY_CHANGE = /^(?:\(|(?:pushd|\{|then|do|else|command\s+cd)(?:\s|$))/;
// Каталог одной команды git: `git -C X commit`.
const GIT_DIRECTORY_TARGET = new RegExp(`^git -C (${PATH_ARGUMENT})\\s`);
// Каталог, который не вычислить без оболочки: домашний (`~`), переменная, подстановка команды.
const UNRESOLVABLE_DIRECTORY = /[~$`]/;
// Кавычки и обратная косая в пути после снятия внешних кавычек (`"/p/a"/sub`, `/a\ b`): оболочка
// склеит или экранирует их по-своему, и путь, как он записан, уже не настоящий.
const LEFTOVER_QUOTING = /["'\\]/;
// Текст в кавычках на одной строке: `'…'`, `"…"` и экранированный символ вне кавычек (`\"`).
// Подстановка `$(…)` в двойных кавычках — часть текста, если закрыта на этой же строке и без
// скобок и двойных кавычек внутри (`"$(pwd)"`). Незакрытая `$(` текстом не считается:
// в `"$(cat <<'EOF'` оболочка начинает настоящий heredoc, и пропустить его значило бы разбирать
// тело коммита как команды.
const QUOTED_TEXT = String.raw`'[^']*'|"(?:[^"\\$]|\\.|\$\([^()"]*\)|\$(?!\())*"|\\.`;
// Начало heredoc: `<<EOF`, `<<-EOF`, `<<'EOF'`, `<<"EOF"`; `<<<` — строка, а не heredoc.
// Строка читается слева направо за один проход, и текст в кавычках съедается целиком раньше, чем
// в нём найдётся `<<`: `echo "a << b"` heredoc не начинает. У такого совпадения групп нет.
const HEREDOC_START_OR_QUOTED_TEXT = new RegExp(
  String.raw`(?<!<)<<(?!<)(-?)\s*(?:'([A-Za-z_]\w*)'|"([A-Za-z_]\w*)"|\\?([A-Za-z_]\w*))|${QUOTED_TEXT}`,
  "g",
);
const LEADING_TABS = /^\t+/;
const PREVIOUS_DIRECTORY = "-";
const PARENT_SEGMENT = "..";
const SURROUNDING_QUOTES = /^(["'])(.*)\1$/;

// Сабагенты, по которым видно этап: встроенный Plan и станции пайплайна /feature
// из .claude/agents/.
const AGENT_STAGES: Readonly<Record<string, Stage>> = {
  Plan: "planning",
  analyst: "planning",
  coder: "implementation",
  tester: "verification",
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

// Станции, после которых автоматика ждёт человека, а не зовёт следующую: постановка уходит
// на одобрение. Возврат станции (вердикт-отказ) тоже ждёт человека, но он берётся из `VERDICTS`.
// По таблице видно причину вызова, текст промпта для этого не разбирается.
const AGENT_HUMAN_CALLS: Readonly<Record<string, InterventionReason>> = {
  analyst: "plan_review",
};
const REWORK_CALL: InterventionReason = "rework_limit";
const ANSWER_CALL: InterventionReason = "question";
const STOP_GATE_CALL: InterventionReason = "stop_gate";

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
  /** Идентификатор проекта по каталогу, где выполнялась команда: из конфига проекта. */
  projectsByDirectory?: ReadonlyMap<string, string>;
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

// Место, где выполнялся инструмент: от него зависит, к какому проекту относится вызов.
// `session` — старый журнал без `cwd`: каталог сессии, а значит, проект из `session_start`.
type ToolPlace = { in: "directory"; directory: string } | { in: "session" } | { in: "unknown" };

const SESSION_PLACE: ToolPlace = { in: "session" };
const UNKNOWN_PLACE: ToolPlace = { in: "unknown" };

// Этап с местом, где он пройден.
interface PlacedStage {
  stage: Stage;
  place: ToolPlace;
}

function withoutQuotes(word: string): string {
  return SURROUNDING_QUOTES.exec(word)?.[2] ?? word;
}

// Место после перехода в `directory`. Относительный путь от каталога сессии остаётся каталогом
// сессии, пока не выходит за её пределы: выше неё проект уже не угадать.
function placeAfterMove(place: ToolPlace, directory: string): ToolPlace {
  const isUnresolvable =
    directory === "" || directory === PREVIOUS_DIRECTORY || UNRESOLVABLE_DIRECTORY.test(directory);

  if (isUnresolvable) return UNKNOWN_PLACE;
  if (path.posix.isAbsolute(directory)) {
    return { in: "directory", directory: path.posix.resolve(directory) };
  }

  switch (place.in) {
    case "directory":
      return { in: "directory", directory: path.posix.resolve(place.directory, directory) };
    case "session":
      return directory.split("/").includes(PARENT_SEGMENT) ? UNKNOWN_PLACE : SESSION_PLACE;
    case "unknown":
      return UNKNOWN_PLACE;
    default:
      return place satisfies never;
  }
}

// Место после перехода в каталог, записанный словом оболочки: внешние кавычки снимаются, а путь,
// в котором после этого остались кавычки или обратная косая, не вычислить.
function placeAfterShellMove(place: ToolPlace, word: string): ToolPlace {
  const directory = withoutQuotes(word);

  return LEFTOVER_QUOTING.test(directory) ? UNKNOWN_PLACE : placeAfterMove(place, directory);
}

// Начальное место вызова: каталог из `cwd` хука, а без него (старый журнал) — каталог сессии.
function startPlaceOf(cwd: string | undefined): ToolPlace {
  return cwd === undefined ? SESSION_PLACE : placeAfterMove(UNKNOWN_PLACE, cwd);
}

// Место команды `cd`: без аргумента или с лишними ключами оболочка идёт туда, куда не угадать.
function placeAfterChangeDirectory(program: string, place: ToolPlace): ToolPlace {
  const target = CHANGE_DIRECTORY_TARGET.exec(program)?.[1];

  return target === undefined ? UNKNOWN_PLACE : placeAfterShellMove(place, target);
}

// `git -C X` задаёт каталог только своей команде, а не всей цепочке.
function placeOfProgram(program: string, place: ToolPlace): ToolPlace {
  const target = GIT_DIRECTORY_TARGET.exec(program)?.[1];

  return target === undefined ? place : placeAfterShellMove(place, target);
}

// Конец heredoc, которого ждёт оболочка: строка из одного ограничителя, у `<<-` — с отступом
// из табуляций.
interface HeredocEnd {
  delimiter: string;
  indented: boolean;
}

function heredocsStartedBy(line: string): HeredocEnd[] {
  return [...line.matchAll(HEREDOC_START_OR_QUOTED_TEXT)].flatMap(
    ([, dash, single, double, bare]) => {
      const delimiter = single ?? double ?? bare;

      return delimiter === undefined ? [] : [{ delimiter, indented: dash === "-" }];
    },
  );
}

function endsHeredoc(line: string, end: HeredocEnd): boolean {
  return (end.indented ? line.replace(LEADING_TABS, "") : line) === end.delimiter;
}

// Тело heredoc — данные для команды, а не команды цепочки: `cat <<'EOF'` с `make check` внутри
// проверок не запускает. Строка с `<<EOF` остаётся: она сама команда.
function withoutHeredocBodies(command: string): string {
  const kept: string[] = [];
  const awaited: HeredocEnd[] = [];

  for (const line of command.split("\n")) {
    const [end] = awaited;
    const isHeredocBody = end !== undefined;

    if (end !== undefined && endsHeredoc(line, end)) awaited.shift();
    if (isHeredocBody) continue;

    kept.push(line);
    awaited.push(...heredocsStartedBy(line));
  }

  return kept.join("\n");
}

// Этапы распознанных команд цепочки по порядку, каждый — с местом: `make check && git commit` —
// проверки, затем выпуск. Место сегмента — по последнему `cd` перед ним.
function stagesOfCommand(command: string, start: ToolPlace): PlacedStage[] {
  const placed: PlacedStage[] = [];
  let place = start;

  for (const segment of withoutHeredocBodies(command).split(COMMAND_SEPARATOR)) {
    const program = segment.trim().replace(LEADING_ENV_ASSIGNMENTS, "");

    if (UNTRACKABLE_DIRECTORY_CHANGE.test(program)) {
      place = UNKNOWN_PLACE;
      continue;
    }
    if (CHANGE_DIRECTORY.test(program)) {
      place = placeAfterChangeDirectory(program, place);
      continue;
    }

    const rule = COMMAND_STAGES.find(({ pattern }) => pattern.test(program));

    if (rule !== undefined) {
      placed.push({ stage: rule.stage, place: placeOfProgram(program, place) });
    }
  }

  return placed;
}

type ToolEvent = Extract<RawEvent, { kind: "tool" }>;

// Пройденные вызовом этапы с местами. Успешная цепочка прошла все свои этапы. Упавшая — только
// первый: дальше первой распознанной команды выполнение, скорее всего, не дошло, и её падение —
// причина неудачи всей цепочки. Файл есть только у инструментов правки: их место — каталог
// файла, у остальных — каталог запуска.
function stagesReachedByTool(event: ToolEvent): PlacedStage[] {
  const start = startPlaceOf(event.cwd);
  const byTool = TOOL_STAGES[event.tool];

  if (byTool !== undefined) {
    const place =
      event.file === undefined ? start : placeAfterMove(start, path.posix.dirname(event.file));

    return [{ stage: byTool, place }];
  }
  if (event.tool !== "Bash" || event.command === undefined) return [];

  const stages = stagesOfCommand(event.command, start);

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

// Причина вызова человека после остановки станции; Object.hasOwn — как в stageOfAgent.
function humanCallOfAgent(agent: string): InterventionReason | undefined {
  return Object.hasOwn(AGENT_HUMAN_CALLS, agent) ? AGENT_HUMAN_CALLS[agent] : undefined;
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

// Окна станций с этапом. Инструменты сабагента приходят в той же сессии; пока работает сабагент
// со своим этапом, этап задаёт он: make check внутри ревьюера — часть ревью, а не возврат
// к тестам. Окна ведутся по agentId; остановка без парного старта (служебные сабагенты
// Claude Code) ничего не закрывает.
interface StationWindows {
  // Учитывает старт или остановку станции; true, если набор работающих станций изменился.
  observe(event: RawEvent): boolean;
  // Вызов сабагента со станцией приходит с его agentId, вызов основной сессии — без agentId, но
  // с cwd. В старом журнале нет ни того, ни другого, и отличить их нельзя: пока работает
  // станция, все вызовы считаются её.
  isStationCall(event: ToolEvent): boolean;
}

function stationWindows(): StationWindows {
  const running = new Set<string>();

  return {
    observe(event) {
      switch (event.kind) {
        case "subagent_start":
          if (stageOfAgent(event.agent) === undefined) return false;

          running.add(agentWindowKey(event));

          return true;
        case "subagent_stop":
          return running.delete(agentWindowKey(event));
        default:
          return false;
      }
    },
    isStationCall(event) {
      if (event.agentId !== undefined) return running.has(event.agentId);
      if (event.cwd !== undefined) return false;

      return running.size > 0;
    },
  };
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

// Адресата расставит routeMessages: ему нужны события уже собранного черновика.
function messageOfRemark({ kind, t, stage, said, run }: Remark): DraftMessage {
  return {
    t,
    type: "draft_message",
    from: stage,
    to: FOREMAN,
    source: kind,
    said,
    line: "",
    text: "",
    ...runMark(run),
  };
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

// Ход — от промпта человека (в том числе ставшего вмешательством) до следующего промпта человека
// или до конца журнала. Ответ на вопрос модели ход не начинает: вопрос задан внутри хода, и модель
// продолжает его. То же правило у `startsTurn` для черновика.
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

// Ход начинает промпт человека, в том числе ставший вмешательством, кроме ответа на вопрос
// модели: тот же ход, что у `turnsOf` по сырому журналу.
function startsTurn(event: DraftEvent): boolean {
  return (
    event.type === "draft_prompt" ||
    (event.type === "draft_intervention" && event.reason !== ANSWER_CALL)
  );
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
    for (const { index, message } of routedMessagesOfBuild(draft, owners, build.id)) {
      events[index] = message;
    }
  }

  return { ...draft, events };
}

// Реплики одной сборки с пересчитанным маршрутом и их места в событиях черновика.
function routedMessagesOfBuild(
  draft: Draft,
  owners: readonly string[],
  buildId: string,
): { index: number; message: DraftMessage }[] {
  const own = draft.events.flatMap((event, index) =>
    owners[index] === buildId ? [{ event, index }] : [],
  );
  const buildEvents = own.map(({ event }) => event);
  const promptTimes = buildEvents.flatMap((event) => (startsTurn(event) ? [event.t] : []));
  const spoken = own.flatMap(({ event, index }) =>
    event.type === "draft_message"
      ? [{ message: event, index, remark: remarkOfMessage(event, buildEvents) }]
      : [],
  );

  return splitIntoTurns(spoken, promptTimes).flatMap((turn) => {
    const remarks = turn.map(({ remark }) => remark);

    return turn.map(({ message, index, remark }, position) => ({
      index,
      message: { ...message, ...routeOf(remark, remarks, position) },
    }));
  });
}

// Проект, версия harness и процесс — из первого начала сессии, где они есть: сессию могли
// подключить к хукам посреди работы, и тогда первое начало без проекта.
function projectOf(
  events: readonly RawEvent[],
): Pick<DraftBuild, "project" | "harness" | "workflow"> {
  for (const event of events) {
    if (event.kind !== "session_start") continue;

    const { project, harness, workflow } = event;

    if (project !== undefined && harness !== undefined && workflow !== undefined) {
      return { project, harness, workflow };
    }
  }

  return { project: "", harness: "", workflow: "" };
}

// Проект места: у каталога — по карте, у сессии — проект из `session_start`, а где место
// неизвестно или проект не нашёлся, пометки нет и событие достаётся сборке по времени.
function projectOfPlace(
  place: ToolPlace,
  sessionProject: string,
  projectsByDirectory: ReadonlyMap<string, string> | undefined,
): string | undefined {
  switch (place.in) {
    case "directory":
      return projectsByDirectory?.get(place.directory);
    case "session":
      return sessionProject === "" ? undefined : sessionProject;
    case "unknown":
      return undefined;
    default:
      return place satisfies never;
  }
}

// Каталог вызова, который известен, но не принадлежит ни одному проекту (черновики в /tmp):
// его этап ничей, и по времени он достался бы чужой сборке. Без карты проектов судить не о чем.
function directoryOutsideProjects(
  place: ToolPlace,
  projectsByDirectory: ReadonlyMap<string, string> | undefined,
): string | undefined {
  if (place.in !== "directory" || projectsByDirectory === undefined) return undefined;

  return projectsByDirectory.has(place.directory) ? undefined : place.directory;
}

function projectMark(project: string | undefined): { project?: string } {
  return project === undefined ? {} : { project };
}

// Событие привязывает сборку к своему месту в черновике: промпт или вмешательство человека
// или событие запуска.
function isBuildAnchor(event: DraftEvent): boolean {
  return (
    event.type === "draft_prompt" || event.type === "draft_intervention" || event.run !== undefined
  );
}

function draftIntervention(t: number, reason: InterventionReason, said: string): DraftIntervention {
  return { t, type: "draft_intervention", reason, said, line: "", text: "" };
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
    const anchor = anchors.findLast((candidate) => candidate.t <= ts);
    const key = anchor?.index ?? BEFORE_FIRST_ANCHOR;
    const sum = sums.get(key);

    sums.set(key, { t: anchor?.t ?? 0, tokens: (sum?.tokens ?? 0) + tokens });
  }

  const toEvent = (sum: { t: number; tokens: number } | undefined): DraftEvent[] =>
    sum === undefined ? [] : [{ t: sum.t, type: "usage", tokens: sum.tokens }];

  return [
    ...toEvent(sums.get(BEFORE_FIRST_ANCHOR)),
    ...events.flatMap((event, index) => [event, ...toEvent(sums.get(index))]),
  ];
}

type SubagentStopEvent = Extract<RawEvent, { kind: "subagent_stop" }>;

// Вердикт станции по строке ответа агента.
interface Judgement {
  agent: string;
  run: string;
  line: string | undefined;
  ts: number;
}

// Идёт по событиям журнала и накапливает события черновика: промпты, вмешательства, этапы, окна
// запусков, исходы проверок и токены станций. Реплики и токены основной сессии добавляет toDraft.
class DraftEventCollector {
  private readonly draftEvents: DraftEvent[] = [];
  private readonly windows = stationWindows();
  // Этап, на котором инструменты основной сессии оставили сборку каждого проекта: правок много,
  // а этап один. Проект без пометки — тоже ключ. Станция сбрасывает этапы: после неё первая
  // команда снова входит на свой этап.
  private readonly stagesByProject = new Map<string | undefined, Stage>();
  // Окно запуска станции тянется до конца журнала, пока не пришла остановка.
  private readonly openRuns = new Map<string, DraftRun>();
  // Вердикт станции приходит с её остановкой (терминальный Claude Code) или отдельным
  // отчётом по agent_id (десктопное приложение). Каждый запуск судится один раз; повторный
  // запуск того же агента после SendMessage — новый запуск со своим вердиктом.
  private readonly agentsStarted = new Map<string, string>();
  private readonly judgedRuns = new Set<string>();
  // Токены запуска ставятся на его последнюю остановку: транскрипт один на все его старты.
  private readonly lastStops = new Map<string, RawEvent>();
  private readonly sessionProject: string;
  // Что остановило автоматику (`pendingCall`) и чего она теперь ждёт от человека
  // (`awaitingHuman`): остановка основной сессии делает первое вторым, старт станции сбрасывает
  // оба, промпт человека забирает.
  private pendingCall: InterventionReason | undefined;
  private awaitingHuman: InterventionReason | undefined;

  private readonly events: readonly RawEvent[];
  private readonly meta: DraftMeta;
  private readonly at: (ts: number) => number;
  private readonly endTs: number;

  constructor(
    events: readonly RawEvent[],
    meta: DraftMeta,
    at: (ts: number) => number,
    endTs: number,
  ) {
    this.events = events;
    this.meta = meta;
    this.at = at;
    this.endTs = endTs;
    this.sessionProject = projectOf(events).project;

    for (const event of events) {
      if (event.kind === "subagent_stop" && event.agentId !== undefined) {
        this.lastStops.set(event.agentId, event);
      }
    }
  }

  collect(): DraftEvent[] {
    for (const event of this.events) this.collectEvent(event);

    return this.draftEvents;
  }

  private collectEvent(event: RawEvent): void {
    switch (event.kind) {
      case "prompt":
        return this.collectPrompt(event.ts, event.text, event.afterStopGate === true);
      case "subagent_start":
        return this.collectSubagentStart(event);
      case "subagent_stop":
        return this.collectSubagentStop(event);

      case "subagent_report": {
        const agent = this.agentsStarted.get(event.agentId);

        if (agent !== undefined) {
          this.judge({ agent, run: event.agentId, line: event.verdict, ts: event.ts });
        }

        return;
      }

      case "tool":
        return this.collectTool(event);
      case "question_answer":
        this.draftEvents.push(draftIntervention(this.at(event.ts), ANSWER_CALL, event.text));

        return;
      case "stop":
        this.awaitingHuman = this.pendingCall;

        return;
      case "session_start":
        return;
      default:
        return event satisfies never;
    }
  }

  private collectPrompt(ts: number, text: string, isAfterStopGate: boolean): void {
    if (!isHumanPrompt(text)) return;

    const reason = isAfterStopGate ? STOP_GATE_CALL : this.awaitingHuman;

    this.pendingCall = undefined;
    this.awaitingHuman = undefined;

    if (reason !== undefined) {
      this.draftEvents.push(draftIntervention(this.at(ts), reason, text));

      return;
    }

    const model = modelAnswering(this.meta.replies ?? [], ts);

    this.draftEvents.push({
      t: this.at(ts),
      type: "draft_prompt",
      said: text,
      goal: "",
      requirements: [],
      ...(model === undefined ? {} : { model }),
    });
  }

  private collectSubagentStart(event: Extract<RawEvent, { kind: "subagent_start" }>): void {
    if (event.agentId !== undefined) this.agentsStarted.set(event.agentId, event.agent);

    const run = agentWindowKey(event);

    this.judgedRuns.delete(run);

    const stage = stageOfAgent(event.agent);

    if (stage === undefined) return;

    this.pendingCall = undefined;
    this.awaitingHuman = undefined;
    this.windows.observe(event);
    this.stagesByProject.clear();
    this.draftEvents.push({ t: this.at(event.ts), type: "stage_enter", stage, run });

    const window: DraftRun = {
      t: this.at(event.ts),
      type: "draft_run",
      run,
      agent: event.agent,
      until: this.at(this.endTs),
    };

    this.draftEvents.push(window);
    this.openRuns.set(run, window);
  }

  private collectSubagentStop(event: SubagentStopEvent): void {
    const run = agentWindowKey(event);

    if (this.windows.observe(event)) this.stagesByProject.clear();

    const window = this.openRuns.get(run);

    if (window !== undefined) window.until = this.at(event.ts);

    this.openRuns.delete(run);

    if (stageOfAgent(event.agent) !== undefined) this.pendingCall = humanCallOfAgent(event.agent);

    this.judge({ agent: event.agent, run, line: event.verdict, ts: event.ts });
    this.countRunTokens(event);
  }

  private collectTool(event: ToolEvent): void {
    if (this.windows.isStationCall(event)) return;

    for (const { stage, place } of stagesReachedByTool(event)) {
      const { projectsByDirectory } = this.meta;

      if (directoryOutsideProjects(place, projectsByDirectory) !== undefined) continue;

      const mark = projectMark(projectOfPlace(place, this.sessionProject, projectsByDirectory));

      this.enterStageByTool(stage, mark.project, event.ts);

      if (stage === "verification") this.collectVerification(event, mark);
    }
  }

  private collectVerification(event: ToolEvent, mark: { project?: string }): void {
    const t = this.at(event.ts);

    this.draftEvents.push({ t, type: "draft_check", ok: event.ok, ...mark });

    if (!event.ok) {
      this.draftEvents.push({
        t,
        type: "stage_fail",
        stage: "verification",
        reason: TEST_FAILURE_REASON,
        ...mark,
      });
    }
  }

  private enterStageByTool(stage: Stage, project: string | undefined, ts: number): void {
    if (this.stagesByProject.get(project) === stage) return;

    this.stagesByProject.set(project, stage);
    this.draftEvents.push({
      t: this.at(ts),
      type: "stage_enter",
      stage,
      ...projectMark(project),
    });
  }

  private judge({ agent, run, line, ts }: Judgement): void {
    const stage = stageOfAgent(agent);
    const verdict = verdictFor(agent, line);

    if (stage === undefined || verdict === undefined || this.judgedRuns.has(run)) return;

    this.judgedRuns.add(run);
    this.draftEvents.push({ t: this.at(ts), type: "draft_check", ok: verdict.passed, run });

    if (!verdict.passed) {
      this.pendingCall = REWORK_CALL;
      this.draftEvents.push({
        t: this.at(ts),
        type: "stage_fail",
        stage,
        reason: verdict.reason,
        run,
      });
    }
  }

  private countRunTokens(event: SubagentStopEvent): void {
    const { agentId } = event;
    const tokens = agentId === undefined ? undefined : this.meta.runTokens?.get(agentId);
    const isLastStop = agentId !== undefined && this.lastStops.get(agentId) === event;

    if (agentId === undefined || tokens === undefined || !isLastStop) return;

    const run = stageOfAgent(event.agent) === undefined ? undefined : agentId;

    this.draftEvents.push({ t: this.at(event.ts), type: "usage", tokens, ...runMark(run) });
  }
}

// Реплики станций и ответы человеку, ещё без `line` и `text`: их заполняет редактор.
function messagesOf(
  events: readonly RawEvent[],
  meta: DraftMeta,
  draftEvents: readonly DraftEvent[],
  atWithinBuild: (ts: number) => number,
): DraftMessage[] {
  const agentsById = agentsByIdOf(events);
  const stageOnTime = (t: number) => stageAt(draftEvents, t);
  const remarks = [
    ...assignmentRemarks(meta.assignments ?? [], agentsById, atWithinBuild),
    ...reportRemarks(meta.reports ?? [], agentsById, atWithinBuild),
    ...answerRemarks(events, meta.answers ?? [], stageOnTime, atWithinBuild),
  ];

  return remarks.sort((a, b) => a.t - b.t).map(messageOfRemark);
}

/**
 * Собирает черновик записи из сырого журнала: промпты человека, реплики (задания, отчёты и
 * итоговые ответы, если переданы их тексты), этапы, окна запусков станций, исходы проверок
 * и токены. Заголовок, чистовые версии промптов и `line` с `text` у реплик остаются пустыми —
 * их заполняет редактор. В черновике одна сборка с `id` черновика; проект и версия harness
 * берутся из первого начала сессии, где они есть, без них остаются пустыми. Другие сборки
 * добавляет редактор. События основной сессии из инструментов получают пометку `project`
 * по каталогу команды, если он есть в `meta.projectsByDirectory`. Этап вызова из известного
 * каталога, которого в этой карте нет (вне любого проекта), в черновик не попадает, в том числе
 * проверки: они не влияют на исход сборки. Какие каталоги отброшены, говорит
 * `directoriesOutsideProjects`. Без карты проектов этапы не отбрасываются.
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
  const draftEvents = new DraftEventCollector(events, meta, at, endTs).collect();
  const messages = messagesOf(events, meta, draftEvents, atWithinBuild);
  const sessionUsages = (meta.sessionUsages ?? [])
    .map(({ ts, tokens }) => ({ ts: at(ts), tokens }))
    .filter(({ ts }) => ts >= 0 && ts <= at(endTs));
  const startedAt = new Date(startTs).toISOString();
  const day = startedAt.slice(0, ISO_DATE_LENGTH);
  const id = `${day}-${meta.sessionId.slice(0, SHORT_SESSION_LENGTH)}`;

  return routeMessages({
    id,
    startedAt,
    builds: [{ id, ...projectOf(events), title: "", language: "", runs: [] }],
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
 * Собирает каталоги, где выполнялись инструменты с этапом: по ним находятся проекты команд.
 * Каталог выводится из `cwd`, `cd` и `git -C` в команде и пути правимого файла.
 * @param {RawEvent[]} events События журнала.
 * @returns {string[]} Каталоги без повторов по порядку журнала; места, которых не определить,
 *   не попадают.
 */
export function toolDirectories(events: RawEvent[]): string[] {
  const directories = events
    .filter((event) => event.kind === "tool")
    .flatMap((event) => stagesReachedByTool(event))
    .flatMap(({ place }) => (place.in === "directory" ? [place.directory] : []));

  return [...new Set(directories)];
}

/**
 * Находит каталоги, этапы вызовов из которых `toDraft` отбрасывает: каталог известен, но не
 * принадлежит проекту (другой путь, dev-контейнер, битый или отсутствующий конфиг). Вместе
 * с этапом пропадают и проверки, а они решают исход сборки, поэтому о таких каталогах
 * предупреждают. Вызовы станций не учитываются: их `toDraft` пропускает по другой причине.
 * @param {RawEvent[]} rawEvents События журнала в любом порядке.
 * @param {ReadonlyMap<string, string>} projectsByDirectory Проект по каталогу, как его получает
 *   `toDraft`.
 * @returns {string[]} Каталоги без повторов по порядку журнала.
 */
export function directoriesOutsideProjects(
  rawEvents: RawEvent[],
  projectsByDirectory: ReadonlyMap<string, string>,
): string[] {
  const windows = stationWindows();
  const directories = new Set<string>();

  for (const event of [...rawEvents].sort((a, b) => a.ts - b.ts)) {
    if (event.kind !== "tool") {
      windows.observe(event);
      continue;
    }
    if (windows.isStationCall(event)) continue;

    const outside = stagesReachedByTool(event).flatMap(({ place }) => {
      const directory = directoryOutsideProjects(place, projectsByDirectory);

      return directory === undefined ? [] : [directory];
    });

    for (const directory of outside) directories.add(directory);
  }

  return [...directories];
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
