// Черновик записи из сырого журнала: `make recording-draft [RAW=recordings/raw/<сессия>.jsonl]`.
// Без аргумента берётся самый свежий журнал. Черновик кладётся в recordings/drafts/ (вне git);
// редактура из прошлого черновика той же сессии переносится, пустыми остаются новые промпты
// и реплики.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  carryOverEdits,
  orphanedEdits,
  parseDraft,
  type Draft,
  type DraftEvent,
  type EditableDraftEvent,
} from "../draft.ts";
import { parseRawLog } from "../raw-event.ts";
import {
  sessionTranscriptPath,
  stationTranscriptPaths,
  toDraft,
  transcriptPaths,
} from "../to-draft.ts";
import {
  agentAssignments,
  agentReports,
  assistantTexts,
  countTokens,
  modelReplies,
  type AgentAssignment,
  type AgentReport,
  type ModelReply,
  type TranscriptText,
} from "../transcript.ts";
import { fromProject, isNotFound, newestFile, RECORDINGS_DIRS } from "./paths.ts";

// Токены сессии и её сабагентов. Непрочитанный транскрипт — предупреждение, а не ошибка:
// черновик полезен и без счётчика токенов. Транскрипты служебных сабагентов Claude Code
// не сохраняет — о них одна строка, а не по строке на каждый.
async function tokensFromTranscripts(paths: string[]): Promise<number | undefined> {
  if (paths.length === 0) return undefined;
  let total = 0;
  let missing = 0;
  for (const transcriptPath of paths) {
    try {
      total += countTokens(await readFile(transcriptPath, "utf8"));
    } catch (err) {
      if (isNotFound(err)) missing++;
      else console.warn(`транскрипт ${transcriptPath} не прочитан: ${String(err)}`);
    }
  }
  if (missing > 0) console.warn(`транскриптов не найдено: ${missing}, их токены не посчитаны`);
  return total;
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

// Как назвать правку в предупреждении: у промпта — цель, у реплики — строка.
function titleOf(edit: EditableDraftEvent): string {
  return edit.type === "draft_prompt" ? edit.goal : edit.line;
}

// Битый прошлый черновик не перезаписывается молча: в нём может быть несохранённая редактура.
async function withEarlierEdits(fresh: Draft, draftPath: string): Promise<Draft> {
  let earlier: string;
  try {
    earlier = await readFile(draftPath, "utf8");
  } catch (err) {
    if (isNotFound(err)) return fresh;
    throw err;
  }
  let previous: Draft;
  try {
    previous = parseDraft(JSON.parse(earlier));
  } catch (err) {
    throw new Error(
      `прошлый черновик ${fromProject(draftPath)} не разобран — исправьте или удалите его`,
      { cause: err },
    );
  }
  for (const edit of orphanedEdits(previous, fresh)) {
    console.warn(`редактура «${titleOf(edit)}» не перенесена: такого события в журнале нет`);
  }
  return carryOverEdits(previous, fresh);
}

// Что ещё ждёт редактуры: промпт без чистовой версии (склеенный её не требует) и реплика,
// у которой не заполнена строка или текст: публикации нужны оба поля.
function awaitsEditing(event: DraftEvent): event is EditableDraftEvent {
  switch (event.type) {
    case "draft_prompt":
      return event.goal === "" && event.joined !== true;
    case "draft_message":
      return event.line === "" || event.text === "";
    default:
      return false;
  }
}

function describeWaiting(event: EditableDraftEvent): string {
  const said = event.said.replace(/\s+/g, " ");
  return event.type === "draft_prompt"
    ? said
    : `${event.from} → ${event.to} (${event.source}): ${said}`;
}

const rawPath = process.argv[2] ?? (await newestFile(RECORDINGS_DIRS.raw, ".jsonl"));
if (rawPath === undefined) {
  throw new Error(`журналов сборок ещё нет: хуки пишут их в ${RECORDINGS_DIRS.raw}`);
}
const rawEvents = parseRawLog(await readFile(rawPath, "utf8"));
const tokens = await tokensFromTranscripts(transcriptPaths(rawEvents));
const session = await textsFromSessionTranscript(sessionTranscriptPath(rawEvents));
const reports = await reportsFromStationTranscripts(stationTranscriptPaths(rawEvents));
const fresh = toDraft(rawEvents, {
  sessionId: path.basename(rawPath, ".jsonl"),
  tokens,
  ...session,
  reports,
});
const draftPath = path.join(RECORDINGS_DIRS.drafts, `${fresh.id}.json`);
const draft = await withEarlierEdits(fresh, draftPath);

await mkdir(RECORDINGS_DIRS.drafts, { recursive: true });
await writeFile(draftPath, `${JSON.stringify(draft, null, 2)}\n`);

const prompts = draft.events.filter((event) => event.type === "draft_prompt");
const messages = draft.events.filter((event) => event.type === "draft_message");
const waiting = draft.events.filter(awaitsEditing);
console.log(`черновик: ${fromProject(draftPath)}`);
console.log(
  `токенов: ${tokens ?? "неизвестно"}, промптов: ${prompts.length}, реплик: ${messages.length}`,
);
console.log(`ждут редактуры: ${waiting.length}${draft.title === "" ? ", и заголовок" : ""}`);
for (const event of waiting) console.log(`  • ${describeWaiting(event)}`);
