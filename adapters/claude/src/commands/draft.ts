// Черновик записи из сырого журнала сессии. Без пути журнала берётся самый свежий. Черновик
// кладётся в `capture/claude/drafts/` журнала проекта (вне git); редактура из прошлого черновика
// той же сессии переносится, включая сборки и их запуски, пустыми остаются новые промпты
// и реплики. Маршруты реплик пересчитываются по сборкам.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { eventBuilds, projectsWithoutBuild, unassignedRuns } from "../capture/builds.ts";
import {
  carryOverEdits,
  orphanedEdits,
  orphanedRuns,
  parseDraft,
  reroutedMessages,
  unfilledHeader,
  type Draft,
  type DraftEvent,
  type DraftRun,
  type EditableDraftEvent,
} from "../capture/draft.ts";
import { parseRawLog, type RawEvent } from "../capture/raw-event.ts";
import {
  directoriesOutsideProjects,
  routeMessages,
  runTranscriptPaths,
  sessionTranscriptPath,
  sessionTranscriptPaths,
  stationTranscriptPaths,
  toDraft,
  toolDirectories,
} from "../capture/to-draft.ts";
import {
  agentAssignments,
  agentReports,
  assistantTexts,
  countTokens,
  modelReplies,
  tokenUsages,
  type AgentAssignment,
  type AgentReport,
  type ModelReply,
  type TokenUsage,
  type TranscriptText,
} from "../capture/transcript.ts";
import { isNotFound } from "@cyberzavod/storage";
import { captureDirectories, findProjectId, newestFile, requireProject } from "../paths.ts";

// Транскрипты читаются по одному: непрочитанный — предупреждение, а не ошибка, черновик полезен
// и без счётчика токенов. Транскрипты служебных сабагентов Claude Code не сохраняет — о них
// одна строка, а не по строке на каждый.
async function readTranscripts(paths: Iterable<string>): Promise<Map<string, string>> {
  const transcripts = new Map<string, string>();
  let missing = 0;
  for (const transcriptPath of paths) {
    try {
      transcripts.set(transcriptPath, await readFile(transcriptPath, "utf8"));
    } catch (err) {
      if (isNotFound(err)) missing++;
      else console.warn(`транскрипт ${transcriptPath} не прочитан: ${String(err)}`);
    }
  }
  if (missing > 0) console.warn(`транскриптов не найдено: ${missing}, их токены не посчитаны`);
  return transcripts;
}

// Токены каждого запуска сабагента по его транскрипту.
async function tokensOfRuns(paths: ReadonlyMap<string, string>): Promise<Map<string, number>> {
  const transcripts = await readTranscripts(paths.values());
  const tokens = new Map<string, number>();
  for (const [agentId, transcriptPath] of paths) {
    const transcript = transcripts.get(transcriptPath);
    if (transcript !== undefined) tokens.set(agentId, countTokens(transcript));
  }
  return tokens;
}

// Токены основной сессии по сообщениям: так их можно разложить по сборкам.
async function usagesOfSession(paths: string[]): Promise<TokenUsage[]> {
  const transcripts = await readTranscripts(paths);
  return [...transcripts.values()].flatMap(tokenUsages);
}

// Что берётся из транскрипта сессии: модели промптов, ответы человеку и задания станциям.
interface SessionTexts {
  replies: ModelReply[];
  answers: TranscriptText[];
  assignments: AgentAssignment[];
}

// Без транскрипта черновик всё равно собирается — у промптов не будет модели, а реплик от
// сессии не будет вовсе.
async function textsFromSessionTranscript(
  transcriptPath: string | undefined,
): Promise<SessionTexts> {
  const none: SessionTexts = { replies: [], answers: [], assignments: [] };
  if (transcriptPath === undefined) return none;
  try {
    const transcript = await readFile(transcriptPath, "utf8");
    return {
      replies: modelReplies(transcript),
      answers: assistantTexts(transcript),
      assignments: agentAssignments(transcript),
    };
  } catch (err) {
    console.warn(
      `транскрипт сессии не прочитан, моделей промптов и реплик сессии не будет: ${String(err)}`,
    );
    return none;
  }
}

// Отчёты станций лежат в их транскриптах. Транскрипты, которых уже нет, — одно предупреждение.
async function reportsFromStationTranscripts(paths: string[]): Promise<AgentReport[]> {
  const reports: AgentReport[] = [];
  let missing = 0;
  for (const transcriptPath of paths) {
    try {
      reports.push(...agentReports(await readFile(transcriptPath, "utf8")));
    } catch (err) {
      if (isNotFound(err)) missing++;
      else console.warn(`транскрипт ${transcriptPath} не прочитан: ${String(err)}`);
    }
  }
  if (missing > 0) console.warn(`транскриптов станций не найдено: ${missing}, их отчётов не будет`);
  return reports;
}

// Проект каждого каталога, где шли команды. Проект ищется здесь, а не в хуке: так он находится
// и для старых журналов, где пути уже лежат в командах, а хук остаётся лёгким.
async function projectsOfDirectories(directories: string[]): Promise<Map<string, string>> {
  const projects = new Map<string, string>();
  for (const directory of directories) {
    const id = await findProjectId(directory);
    if (id !== undefined) projects.set(directory, id);
  }
  return projects;
}

// Как назвать правку в предупреждении: у промпта — цель, у реплики — строка, у вмешательства —
// причина и строка.
function titleOf(edit: EditableDraftEvent): string {
  switch (edit.type) {
    case "draft_prompt":
      return edit.goal;
    case "draft_message":
      return edit.line;
    case "draft_intervention":
      return `вмешательство (${edit.reason}): ${edit.line}`;
    default:
      return edit satisfies never;
  }
}

// Битый прошлый черновик не перезаписывается молча: в нём может быть несохранённая редактура.
async function readEarlierDraft(draftPath: string, shown: string): Promise<Draft | undefined> {
  let earlier: string;
  try {
    earlier = await readFile(draftPath, "utf8");
  } catch (err) {
    if (isNotFound(err)) return undefined;
    throw err;
  }
  try {
    return parseDraft(JSON.parse(earlier));
  } catch (err) {
    throw new Error(`прошлый черновик ${shown} не разобран — исправьте или удалите его`, {
      cause: err,
    });
  }
}

function withEarlierEdits(fresh: Draft, previous: Draft | undefined): Draft {
  if (previous === undefined) return fresh;
  for (const edit of orphanedEdits(previous, fresh)) {
    console.warn(`редактура «${titleOf(edit)}» не перенесена: такого события в журнале нет`);
  }
  return carryOverEdits(previous, fresh);
}

// Что ещё ждёт редактуры: промпт без чистовой версии (склеенный её не требует), реплика
// и вмешательство, у которых не заполнена строка или текст: публикации нужны оба поля.
function awaitsEditing(event: DraftEvent): event is EditableDraftEvent {
  switch (event.type) {
    case "draft_prompt":
      return event.goal === "" && event.joined !== true;
    case "draft_message":
    case "draft_intervention":
      return event.line === "" || event.text === "";
    default:
      return false;
  }
}

function describeWaiting(event: EditableDraftEvent): string {
  const said = event.said.replace(/\s+/g, " ");
  switch (event.type) {
    case "draft_prompt":
      return said;
    case "draft_message":
      return `${event.from} → ${event.to} (${event.source}): ${said}`;
    case "draft_intervention":
      return `вмешательство (${event.reason}): ${said}`;
    default:
      return event satisfies never;
  }
}

const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const MAX_ASSIGNMENT_LINE = 100;

// Время от начала журнала, как его видит человек: минуты и секунды.
function clockOf(t: number): string {
  const seconds = Math.floor(t / MS_PER_SECOND);
  const minutes = Math.floor(seconds / SECONDS_PER_MINUTE);
  return `${minutes}:${String(seconds % SECONDS_PER_MINUTE).padStart(2, "0")}`;
}

// По первой строке задания редактор узнаёт, к какой задаче относится запуск.
function assignmentLineOf(draft: Draft, run: DraftRun): string {
  const assignment = draft.events.find(
    (event) =>
      event.type === "draft_message" && event.run === run.run && event.source === "assignment",
  );
  if (assignment?.type !== "draft_message") return "задание не найдено";
  const line = assignment.said.split("\n").find((text) => text.trim() !== "") ?? "";
  return line.trim().slice(0, MAX_ASSIGNMENT_LINE);
}

// Черновик только из журнала и транскриптов, ещё без редактуры прошлого черновика.
async function freshDraftOf(
  rawPath: string,
  rawEvents: RawEvent[],
  projectsByDirectory: Map<string, string>,
): Promise<Draft> {
  return toDraft(rawEvents, {
    sessionId: path.basename(rawPath, ".jsonl"),
    runTokens: await tokensOfRuns(runTranscriptPaths(rawEvents)),
    sessionUsages: await usagesOfSession(sessionTranscriptPaths(rawEvents)),
    ...(await textsFromSessionTranscript(sessionTranscriptPath(rawEvents))),
    reports: await reportsFromStationTranscripts(stationTranscriptPaths(rawEvents)),
    projectsByDirectory,
  });
}

interface DraftReport {
  draft: Draft;
  previous: Draft | undefined;
  rawEvents: RawEvent[];
  projectsByDirectory: Map<string, string>;
  shownPath: string;
}

// Сводка для редактора: что в черновике и что ещё ждёт редактуры.
function reportDraft({ draft, previous, rawEvents, projectsByDirectory, shownPath }: DraftReport) {
  const prompts = draft.events.filter((event) => event.type === "draft_prompt");
  const messages = draft.events.filter((event) => event.type === "draft_message");
  const interventions = draft.events.filter((event) => event.type === "draft_intervention");
  const waiting = draft.events.filter(awaitsEditing);
  const owners = eventBuilds(draft);
  console.log(`черновик: ${shownPath}`);
  console.log(
    `промптов: ${prompts.length}, реплик: ${messages.length}, вмешательств: ${interventions.length}`,
  );
  for (const build of draft.builds) {
    const eventCount = owners.filter((owner) => owner === build.id).length;
    console.log(
      `сборка ${build.id}: проект ${build.project || "—"}, harness ${build.harness || "—"}, процесс ${build.workflow || "—"}, ` +
        `запусков: ${build.runs.length}, событий: ${eventCount}`,
    );
  }
  for (const line of unfilledHeader(draft)) console.log(`  не заполнено: ${line}`);
  for (const project of projectsWithoutBuild(draft)) {
    console.warn(`команды проекта ${project} без сборки: достанутся сборке по времени`);
  }
  for (const directory of directoriesOutsideProjects(rawEvents, projectsByDirectory)) {
    console.warn(
      `каталог ${directory} не принадлежит проекту Cyberzavod: его этапы и проверки не попали в черновик`,
    );
  }
  console.log(`ждут редактуры: ${waiting.length}`);
  for (const event of waiting) console.log(`  • ${describeWaiting(event)}`);

  const unassigned = unassignedRuns(draft);
  if (unassigned.length > 0) {
    console.log(`запуски станций без сборки (достанутся первой): ${unassigned.length}`);
    for (const run of unassigned) {
      console.log(`  • ${run.agent} ${run.run} ${clockOf(run.t)}: ${assignmentLineOf(draft, run)}`);
    }
  }
  for (const run of orphanedRuns(draft)) {
    console.warn(`запуск ${run} указан в сборке, но в журнале его нет`);
  }
  for (const message of previous === undefined ? [] : reroutedMessages(previous, draft)) {
    console.warn(
      `у реплики «${message.line}» поменялся маршрут: ${message.from} → ${message.to}, перечитайте строку`,
    );
  }
}

/** Что собрать в черновик: проект и, если нужно, конкретный сырой журнал. */
export interface DraftSessionOptions {
  /** Каталог внутри проекта. */
  projectDirectory: string;
  /** Сырой журнал сессии; без него берётся самый свежий. */
  rawPath?: string;
}

/**
 * Собирает черновик записи из сырого журнала сессии и печатает, что ещё ждёт редактуры.
 * @param {DraftSessionOptions} options Проект и сырой журнал.
 * @returns {Promise<string>} Путь записанного черновика.
 * @throws {Error} Если проекта нет, журналов ещё нет или прошлый черновик битый.
 */
export async function draftSession(options: DraftSessionOptions): Promise<string> {
  const project = await requireProject(options.projectDirectory);
  const directories = captureDirectories(project.journal);
  const shown = (file: string) => path.relative(project.root, file) || ".";
  const rawPath = options.rawPath ?? (await newestFile(directories.raw, ".jsonl"));
  if (rawPath === undefined) {
    throw new Error(`журналов сессий ещё нет: хуки пишут их в ${shown(directories.raw)}`);
  }
  const rawEvents = parseRawLog(await readFile(rawPath, "utf8"));
  const projectsByDirectory = await projectsOfDirectories(toolDirectories(rawEvents));
  const fresh = await freshDraftOf(rawPath, rawEvents, projectsByDirectory);
  const draftPath = path.join(directories.drafts, `${fresh.id}.json`);
  const previous = await readEarlierDraft(draftPath, shown(draftPath));
  const draft = routeMessages(withEarlierEdits(fresh, previous));

  await mkdir(directories.drafts, { recursive: true });
  await writeFile(draftPath, `${JSON.stringify(draft, null, 2)}\n`);

  reportDraft({ draft, previous, rawEvents, projectsByDirectory, shownPath: shown(draftPath) });
  return draftPath;
}
