// Publishing recordings from a draft. Without a draft the most recent one is taken. Without a build
// all builds of the draft are published, and if even one is not ready nothing is written; with a
// build only that one is, and the rest may be unready. The recording, without the original prompt
// texts, goes into the project journal, where the site picks it up at build time.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { RecordError, type SessionRecord } from "@cyberzavod/core";
import { DirectoryRecordStore } from "@cyberzavod/storage";
import { DraftError, parseDraft, publishBuild, type Draft } from "../capture/draft.ts";
import { ClaudeError } from "../errors.ts";
import type { ClaudeMessages } from "../messages/claude-messages.ts";
import { requireProject } from "@cyberzavod/adapter-kit";
import { captureDirectories, newestFile } from "../paths.ts";

/** What to publish: the project and, if needed, a specific draft and build. */
export interface PublishSessionsOptions {
  /** Directory inside the project. */
  projectDirectory: string;
  /** Draft; without it the most recent one is taken. */
  draftPath?: string;
  /** Build of the draft; without it all are published. */
  buildId?: string;
  /** Messages in the chosen language. */
  messages: ClaudeMessages;
}

type PublishProblem = DraftError | RecordError | ClaudeError;

function isPublishProblem(err: unknown): err is PublishProblem {
  return err instanceof DraftError || err instanceof RecordError || err instanceof ClaudeError;
}

// Format errors (`DraftError`, `RecordError`) are not translated: their text is a file diagnostic.
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

// All selected builds are checked first so as not to publish only some of the recordings.
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
 * Publishes the draft's builds as recordings into the project journal. An unready draft yields an
 * error message, not an exception: the human fixes it.
 * @param {PublishSessionsOptions} options Project, draft, build and messages.
 * @returns {Promise<boolean>} true if the recordings were published.
 * @throws {ClaudeError} If there is no project or no drafts.
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
