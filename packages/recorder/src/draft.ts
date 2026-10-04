// Черновик записи из сырого журнала: `make recording-draft [RAW=recordings/raw/<сессия>.jsonl]`.
// Без аргумента берётся самый свежий журнал. Черновик кладётся в recordings/drafts/ (вне git),
// а промпты печатаются, чтобы перед публикацией проверить их на ключи, адреса и личное.

import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseRawLog } from "./raw-event.ts";
import { recordingId, toRecording, transcriptPaths } from "./to-recording.ts";
import { countTokens } from "./transcript.ts";

const projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const RAW_DIR = path.join(projectDir, "recordings", "raw");
const DRAFTS_DIR = path.join(projectDir, "recordings", "drafts");

async function newestRawLog(): Promise<string> {
  const files = (await readdir(RAW_DIR).catch(() => [])).filter((name) => name.endsWith(".jsonl"));
  if (files.length === 0) {
    throw new Error(`журналов сборок ещё нет: хуки пишут их в ${RAW_DIR} во время работы агента`);
  }
  const withTimes = await Promise.all(
    files.map(async (name) => ({ name, mtime: (await stat(path.join(RAW_DIR, name))).mtimeMs })),
  );
  withTimes.sort((a, b) => b.mtime - a.mtime);
  return path.join(RAW_DIR, withTimes[0]!.name);
}

// Токены сессии и её сабагентов. Непрочитанный транскрипт — предупреждение, а не ошибка:
// черновик полезен и без счётчика токенов.
async function tokensFromTranscripts(paths: string[]): Promise<number | undefined> {
  if (paths.length === 0) return undefined;
  let total = 0;
  for (const transcriptPath of paths) {
    try {
      total += countTokens(await readFile(transcriptPath, "utf8"));
    } catch (err) {
      console.warn(`транскрипт ${transcriptPath} не прочитан, его токены не посчитаны: ${String(err)}`);
    }
  }
  return total;
}

const rawPath = process.argv[2] ?? (await newestRawLog());
const events = parseRawLog(await readFile(rawPath, "utf8"));
const tokens = await tokensFromTranscripts(transcriptPaths(events));
const id = recordingId(path.basename(rawPath, ".jsonl"), events[0]?.ts ?? Date.now());
const recording = toRecording(events, tokens === undefined ? { id } : { id, tokens });

await mkdir(DRAFTS_DIR, { recursive: true });
const draftPath = path.join(DRAFTS_DIR, `${id}.json`);
await writeFile(draftPath, `${JSON.stringify(recording, null, 2)}\n`);

console.log(`черновик: ${path.relative(projectDir, draftPath)}`);
console.log(`событий: ${recording.events.length}, токенов: ${tokens ?? "неизвестно"}`);
console.log("\nпромпты — проверьте перед публикацией:");
for (const event of recording.events) {
  if (event.type === "prompt") console.log(`  • ${event.text}`);
}
