// Черновик записи из сырого журнала: `make recording-draft [RAW=recordings/raw/<сессия>.jsonl]`.
// Без аргумента берётся самый свежий журнал. Черновик кладётся в recordings/drafts/ (вне git);
// редактура из прошлого черновика той же сессии переносится, пустыми остаются новые промпты.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { carryOverEdits, orphanedEdits, parseDraft, type Draft } from "../draft.ts";
import { parseRawLog } from "../raw-event.ts";
import { toDraft, transcriptPaths } from "../to-draft.ts";
import { countTokens } from "../transcript.ts";
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
  for (const prompt of orphanedEdits(previous, fresh)) {
    console.warn(`редактура «${prompt.goal}» не перенесена: такого промпта в журнале нет`);
  }
  return carryOverEdits(previous, fresh);
}

const rawPath = process.argv[2] ?? (await newestFile(RECORDINGS_DIRS.raw, ".jsonl"));
if (rawPath === undefined) {
  throw new Error(`журналов сборок ещё нет: хуки пишут их в ${RECORDINGS_DIRS.raw}`);
}
const rawEvents = parseRawLog(await readFile(rawPath, "utf8"));
const tokens = await tokensFromTranscripts(transcriptPaths(rawEvents));
const fresh = toDraft(rawEvents, { sessionId: path.basename(rawPath, ".jsonl"), tokens });
const draftPath = path.join(RECORDINGS_DIRS.drafts, `${fresh.id}.json`);
const draft = await withEarlierEdits(fresh, draftPath);

await mkdir(RECORDINGS_DIRS.drafts, { recursive: true });
await writeFile(draftPath, `${JSON.stringify(draft, null, 2)}\n`);

const prompts = draft.events.filter((event) => event.type === "draft_prompt");
const unedited = prompts.filter((prompt) => prompt.goal === "");
console.log(`черновик: ${fromProject(draftPath)}`);
console.log(`токенов: ${tokens ?? "неизвестно"}, промптов: ${prompts.length}`);
console.log(`ждут редактуры: ${unedited.length}${draft.title === "" ? ", и заголовок" : ""}`);
for (const prompt of unedited) console.log(`  • ${prompt.said.replace(/\s+/g, " ")}`);
