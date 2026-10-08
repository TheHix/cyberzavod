// Публикация записей из черновика. Без черновика берётся самый свежий. Без сборки публикуются
// все сборки черновика, и если хоть одна не готова, не пишется ничего; со сборкой — только она,
// остальные могут быть не готовы. Запись без исходных текстов промптов ложится в журнал
// проекта — оттуда её берёт сайт при сборке.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { RecordError, type SessionRecord } from "@cyberzavod/core";
import { DirectoryRecordStore } from "@cyberzavod/storage";
import { DraftError, parseDraft, publishBuild, type Draft } from "../capture/draft.ts";
import { ClaudeError } from "../errors.ts";
import type { ClaudeMessages } from "../messages/claude-messages.ts";
import { captureDirectories, newestFile, requireProject } from "../paths.ts";

/** Что опубликовать: проект и, если нужно, конкретные черновик и сборку. */
export interface PublishSessionsOptions {
  /** Каталог внутри проекта. */
  projectDirectory: string;
  /** Черновик; без него берётся самый свежий. */
  draftPath?: string;
  /** Сборка черновика; без неё публикуются все. */
  buildId?: string;
  /** Сообщения на выбранном языке. */
  messages: ClaudeMessages;
}

type PublishProblem = DraftError | RecordError | ClaudeError;

function isPublishProblem(err: unknown): err is PublishProblem {
  return err instanceof DraftError || err instanceof RecordError || err instanceof ClaudeError;
}

// Ошибки формата (`DraftError`, `RecordError`) не переводятся: их текст — диагностика файла.
function problemText(err: PublishProblem, messages: ClaudeMessages): string {
  return err instanceof ClaudeError ? err.describe(messages) : err.message;
}

function publishBuildOrProblem(
  draft: Draft,
  buildId: string,
  messages: ClaudeMessages,
): SessionRecord | string {
  try {
    return publishBuild(draft, buildId);
  } catch (err) {
    if (!isPublishProblem(err)) throw err;

    return messages.publish.buildProblem({ buildId, reason: problemText(err, messages) });
  }
}

// Сначала проверяются все выбранные сборки, чтобы не опубликовать часть записей.
function publishSelected(
  draft: Draft,
  buildId: string | undefined,
  messages: ClaudeMessages,
): SessionRecord[] {
  const selected = draft.builds.filter(({ id }) => buildId === undefined || id === buildId);

  if (selected.length === 0) {
    throw new ClaudeError((m) => m.errors.noBuild(buildId ?? ""));
  }

  const records: SessionRecord[] = [];
  const problems: string[] = [];

  for (const build of selected) {
    const published = publishBuildOrProblem(draft, build.id, messages);

    if (typeof published === "string") problems.push(published);
    else records.push(published);
  }

  if (problems.length > 0) throw new DraftError(problems.join("\n"));

  return records;
}

/**
 * Публикует сборки черновика записями в журнал проекта. Неготовый черновик — сообщение об
 * ошибке, а не исключение: его исправляет человек.
 * @param {PublishSessionsOptions} options Проект, черновик, сборка и сообщения.
 * @returns {Promise<boolean>} true, если записи опубликованы.
 * @throws {ClaudeError} Если проекта или черновиков нет.
 */
export async function publishSessions(options: PublishSessionsOptions): Promise<boolean> {
  const { messages } = options;
  const project = await requireProject(options.projectDirectory);
  const shown = (file: string) => path.relative(project.root, file) || ".";
  const draftPath =
    options.draftPath ?? (await newestFile(captureDirectories(project.journal).drafts, ".json"));

  if (draftPath === undefined) throw new ClaudeError((m) => m.errors.noDrafts);

  const store = new DirectoryRecordStore(project.journal);

  try {
    const draftJson: unknown = JSON.parse(await readFile(draftPath, "utf8"));
    const draft = parseDraft(draftJson);

    for (const record of publishSelected(draft, options.buildId, messages)) {
      await store.write(record);
      console.log(messages.publish.published(shown(store.pathOf(record))));
    }

    return true;
  } catch (err) {
    if (!isPublishProblem(err)) throw err;

    const problems = problemText(err, messages);

    console.error(messages.publish.notReady({ file: shown(draftPath), problems }));

    return false;
  }
}
