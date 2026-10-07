// Публикация записей: `make recording-publish [DRAFT=recordings/drafts/<id>.json] [BUILD=<id>]`.
// Без черновика берётся самый свежий. Без сборки публикуются все сборки черновика, и если
// хоть одна не готова, не пишется ничего; с BUILD — только она, остальные могут быть не готовы.
// Запись без исходных текстов промптов ложится в recordings/published/ — оттуда её берёт сайт
// при сборке.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { RecordingError, type Recording } from "@cyberzavod/core";
import { DraftError, parseDraft, publishBuild } from "../draft.ts";
import { fromFactoryHome, newestFile, RECORDINGS_DIRS } from "./paths.ts";

// Makefile всегда передаёт DRAFT (пустой, если не задан) и добавляет BUILD, только если он указан
// в командной строке: пустая строка значит «не задано», а отсутствие аргумента — тоже.
const draftPath = process.argv[2] || (await newestFile(RECORDINGS_DIRS.drafts, ".json"));
const buildId = process.argv[3] || undefined;
if (draftPath === undefined) {
  throw new Error("черновиков ещё нет: сначала make recording-draft");
}

try {
  const draft = parseDraft(JSON.parse(await readFile(draftPath, "utf8")));
  const selected = draft.builds.filter(({ id }) => buildId === undefined || id === buildId);
  if (selected.length === 0) throw new DraftError(`в черновике нет сборки ${buildId}`);

  // Сначала проверяются все выбранные сборки, чтобы не опубликовать часть записей.
  const recordings: Recording[] = [];
  const problems: string[] = [];
  for (const build of selected) {
    try {
      recordings.push(publishBuild(draft, build.id));
    } catch (err) {
      if (!(err instanceof DraftError || err instanceof RecordingError)) throw err;
      problems.push(`сборка ${build.id}: ${err.message}`);
    }
  }
  if (problems.length > 0) throw new DraftError(problems.join("\n"));

  await mkdir(RECORDINGS_DIRS.published, { recursive: true });
  for (const recording of recordings) {
    const publishedPath = path.join(RECORDINGS_DIRS.published, `${recording.id}.json`);
    await writeFile(publishedPath, `${JSON.stringify(recording, null, 2)}\n`);
    console.log(
      `опубликовано: ${fromFactoryHome(publishedPath)} — сайт покажет запись после выкатки`,
    );
  }
} catch (err) {
  if (!(err instanceof DraftError || err instanceof RecordingError)) throw err;
  console.error(`${fromFactoryHome(draftPath)} не готов к публикации:\n${err.message}`);
  process.exitCode = 1;
}
