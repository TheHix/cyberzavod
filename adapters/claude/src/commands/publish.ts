// Публикация записей из черновика. Без черновика берётся самый свежий. Без сборки публикуются
// все сборки черновика, и если хоть одна не готова, не пишется ничего; со сборкой — только она,
// остальные могут быть не готовы. Запись без исходных текстов промптов ложится в журнал
// проекта — оттуда её берёт сайт при сборке.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { RecordError, type SessionRecord } from "@cyberzavod/core";
import { DirectoryRecordStore } from "@cyberzavod/storage";
import { DraftError, parseDraft, publishBuild, type Draft } from "../capture/draft.ts";
import { captureDirectories, newestFile, requireProject } from "../paths.ts";

/** Что опубликовать: проект и, если нужно, конкретные черновик и сборку. */
export interface PublishSessionsOptions {
  /** Каталог внутри проекта. */
  projectDirectory: string;
  /** Черновик; без него берётся самый свежий. */
  draftPath?: string;
  /** Сборка черновика; без неё публикуются все. */
  buildId?: string;
}

function isPublishProblem(err: unknown): err is DraftError | RecordError {
  return err instanceof DraftError || err instanceof RecordError;
}

function publishBuildOrProblem(draft: Draft, buildId: string): SessionRecord | string {
  try {
    return publishBuild(draft, buildId);
  } catch (err) {
    if (!isPublishProblem(err)) throw err;

    return `сборка ${buildId}: ${err.message}`;
  }
}

// Сначала проверяются все выбранные сборки, чтобы не опубликовать часть записей.
function publishSelected(draft: Draft, buildId: string | undefined): SessionRecord[] {
  const selected = draft.builds.filter(({ id }) => buildId === undefined || id === buildId);

  if (selected.length === 0) throw new DraftError(`в черновике нет сборки ${buildId}`);

  const records: SessionRecord[] = [];
  const problems: string[] = [];

  for (const build of selected) {
    const published = publishBuildOrProblem(draft, build.id);

    if (typeof published === "string") problems.push(published);
    else records.push(published);
  }

  if (problems.length > 0) throw new DraftError(problems.join("\n"));

  return records;
}

/**
 * Публикует сборки черновика записями в журнал проекта. Неготовый черновик — сообщение об
 * ошибке, а не исключение: его исправляет человек.
 * @param {PublishSessionsOptions} options Проект, черновик и сборка.
 * @returns {Promise<boolean>} true, если записи опубликованы.
 * @throws {Error} Если проекта или черновиков нет.
 */
export async function publishSessions(options: PublishSessionsOptions): Promise<boolean> {
  const project = await requireProject(options.projectDirectory);
  const shown = (file: string) => path.relative(project.root, file) || ".";
  const draftPath =
    options.draftPath ?? (await newestFile(captureDirectories(project.journal).drafts, ".json"));

  if (draftPath === undefined) throw new Error("черновиков ещё нет: сначала cyberzavod draft");

  const store = new DirectoryRecordStore(project.journal);

  try {
    const draftJson: unknown = JSON.parse(await readFile(draftPath, "utf8"));
    const draft = parseDraft(draftJson);

    for (const record of publishSelected(draft, options.buildId)) {
      await store.write(record);
      console.log(`опубликовано: ${shown(store.pathOf(record))}`);
    }

    return true;
  } catch (err) {
    if (!isPublishProblem(err)) throw err;

    console.error(`${shown(draftPath)} не готов к публикации:\n${err.message}`);

    return false;
  }
}
