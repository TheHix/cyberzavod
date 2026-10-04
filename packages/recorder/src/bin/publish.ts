// Публикация записи: `make recording-publish [DRAFT=recordings/drafts/<id>.json]`.
// Без аргумента берётся самый свежий черновик. Запись без исходных текстов промптов ложится
// в recordings/published/ — оттуда её берёт сайт при сборке.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { RecordingError } from "@cyberzavod/core";
import { DraftError, parseDraft, publishDraft } from "../draft.ts";
import { fromProject, newestFile, RECORDINGS_DIRS } from "./paths.ts";

const draftPath = process.argv[2] ?? (await newestFile(RECORDINGS_DIRS.drafts, ".json"));
if (draftPath === undefined) {
  throw new Error("черновиков ещё нет: сначала make recording-draft");
}

try {
  const recording = publishDraft(parseDraft(JSON.parse(await readFile(draftPath, "utf8"))));
  const publishedPath = path.join(RECORDINGS_DIRS.published, `${recording.id}.json`);
  await mkdir(RECORDINGS_DIRS.published, { recursive: true });
  await writeFile(publishedPath, `${JSON.stringify(recording, null, 2)}\n`);
  console.log(`опубликовано: ${fromProject(publishedPath)} — сайт покажет запись после выкатки`);
} catch (err) {
  if (!(err instanceof DraftError || err instanceof RecordingError)) throw err;
  console.error(`${fromProject(draftPath)} не готов к публикации: ${err.message}`);
  process.exitCode = 1;
}
