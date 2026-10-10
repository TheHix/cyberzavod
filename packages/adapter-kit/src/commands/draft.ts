// Recording draft from a raw session log. Without a log path the most recent one is taken. The
// draft goes into the project journal's `capture/<agent>/drafts/` (outside git); edits from a
// previous draft of the same session carry over, builds and their runs included, and only new
// prompts and messages stay empty. Message routes are recomputed from the builds.

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
  toDraft,
  directoriesOutsideProjects,
  routeMessages,
  toolDirectories,
} from "../capture/to-draft.ts";
import type { SessionTranscripts } from "../capture/transcripts.ts";
import { isNotFound } from "@cyberzavod/storage";
import { KitError } from "../errors.ts";
import type { KitMessages } from "../messages/kit-messages.ts";
import { captureDirectories, findProjectId, newestFile, requireProject } from "../paths.ts";

// Project of each directory where commands ran. The project is looked up here rather than in the
// hook, so it is found even for old logs whose commands already hold the paths, and the hook stays
// light.
async function projectsOfDirectories(
  directories: string[],
  messages: KitMessages,
): Promise<Map<string, string>> {
  const projects = new Map<string, string>();

  for (const directory of directories) {
    const id = await findProjectId(directory, messages);

    if (id !== undefined) projects.set(directory, id);
  }

  return projects;
}

// How to name an edit in a warning: a prompt by its goal, a message by its line, an intervention by
// its reason and line.
function titleOf(edit: EditableDraftEvent, messages: KitMessages): string {
  switch (edit.type) {
    case "draft_prompt":
      return edit.goal;
    case "draft_message":
      return edit.line;
    case "draft_intervention":
      return messages.draft.intervention({ reason: edit.reason, text: edit.line });
    default:
      return edit satisfies never;
  }
}

// A broken previous draft is not silently overwritten: it may hold unsaved edits.
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
    throw new KitError((messages) => messages.errors.earlierDraftNotParsed(shown), {
      cause: err,
    });
  }
}

function withEarlierEdits(fresh: Draft, previous: Draft | undefined, messages: KitMessages): Draft {
  if (previous === undefined) return fresh;

  for (const edit of orphanedEdits(previous, fresh)) {
    console.warn(messages.draft.editNotCarried(titleOf(edit, messages)));
  }

  return carryOverEdits(previous, fresh);
}

// What still awaits editing: a prompt without a clean version (a merged one needs none), and a
// message or intervention with an empty line or text: publishing needs both fields.
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

function describeWaiting(event: EditableDraftEvent, messages: KitMessages): string {
  const said = event.said.replace(/\s+/g, " ");

  switch (event.type) {
    case "draft_prompt":
      return said;
    case "draft_message":
      return `${event.from} → ${event.to} (${event.source}): ${said}`;
    case "draft_intervention":
      return messages.draft.intervention({ reason: event.reason, text: said });
    default:
      return event satisfies never;
  }
}

const EMPTY_VALUE = "—";
const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const MAX_ASSIGNMENT_LINE = 100;

// Time since the start of the log as the human sees it: minutes and seconds.
function clockOf(t: number): string {
  const seconds = Math.floor(t / MS_PER_SECOND);
  const minutes = Math.floor(seconds / SECONDS_PER_MINUTE);

  return `${minutes}:${String(seconds % SECONDS_PER_MINUTE).padStart(2, "0")}`;
}

// The first line of the assignment tells the editor which task the run belongs to.
function assignmentLineOf(draft: Draft, run: DraftRun, messages: KitMessages): string {
  const assignment = draft.events.find(
    (event) =>
      event.type === "draft_message" && event.run === run.run && event.source === "assignment",
  );

  if (assignment?.type !== "draft_message") return messages.draft.assignmentNotFound;

  const line = assignment.said.split("\n").find((text) => text.trim() !== "") ?? "";

  return line.trim().slice(0, MAX_ASSIGNMENT_LINE);
}

type ProjectsReport = Pick<DraftReport, "draft" | "rawEvents" | "projectsByDirectory" | "messages">;

interface DraftReport {
  draft: Draft;
  previous: Draft | undefined;
  rawEvents: RawEvent[];
  projectsByDirectory: Map<string, string>;
  shownPath: string;
  messages: KitMessages;
}

function printCounts(draft: Draft, messages: KitMessages): void {
  const prompts = draft.events.filter((event) => event.type === "draft_prompt");
  const replies = draft.events.filter((event) => event.type === "draft_message");
  const interventions = draft.events.filter((event) => event.type === "draft_intervention");

  console.log(
    messages.draft.counts({
      prompts: prompts.length,
      messages: replies.length,
      interventions: interventions.length,
    }),
  );
}

function printBuilds(draft: Draft, messages: KitMessages): void {
  const owners = eventBuilds(draft);

  for (const build of draft.builds) {
    const eventCount = owners.filter((owner) => owner === build.id).length;

    console.log(
      messages.draft.build({
        id: build.id,
        project: build.project || EMPTY_VALUE,
        harness: build.harness || EMPTY_VALUE,
        workflow: build.workflow || EMPTY_VALUE,
        runs: build.runs.length,
        events: eventCount,
      }),
    );
  }

  for (const { buildId, fields } of unfilledHeader(draft)) {
    const names = fields.map((field) => messages.headerFields[field]).join(", ");

    console.log(`  ${messages.draft.unfilledHeader({ buildId, fields: names })}`);
  }
}

function warnAboutProjects(report: ProjectsReport) {
  const { draft, rawEvents, projectsByDirectory, messages } = report;

  for (const project of projectsWithoutBuild(draft)) {
    console.warn(messages.draft.projectWithoutBuild(project));
  }

  for (const directory of directoriesOutsideProjects(rawEvents, projectsByDirectory)) {
    console.warn(messages.draft.directoryOutsideProject(directory));
  }
}

function printWaiting(draft: Draft, messages: KitMessages): void {
  const waiting = draft.events.filter(awaitsEditing);

  console.log(messages.draft.waiting(waiting.length));
  for (const event of waiting) console.log(`  • ${describeWaiting(event, messages)}`);
}

function printUnassignedRuns(draft: Draft, messages: KitMessages): void {
  const unassigned = unassignedRuns(draft);

  if (unassigned.length === 0) return;

  console.log(messages.draft.unassignedRuns(unassigned.length));

  for (const run of unassigned) {
    const line = messages.draft.unassignedRun({
      agent: run.agent,
      run: run.run,
      clock: clockOf(run.t),
      line: assignmentLineOf(draft, run, messages),
    });

    console.log(`  • ${line}`);
  }
}

function warnAboutEarlierDraft(
  draft: Draft,
  previous: Draft | undefined,
  messages: KitMessages,
): void {
  for (const run of orphanedRuns(draft)) {
    console.warn(messages.draft.orphanedRun(run));
  }

  for (const message of previous === undefined ? [] : reroutedMessages(previous, draft)) {
    console.warn(messages.draft.reroutedMessage(message));
  }
}

// Summary for the editor: what is in the draft and what still awaits editing.
function reportDraft(report: DraftReport) {
  const { draft, previous, rawEvents, projectsByDirectory, shownPath, messages } = report;

  console.log(messages.draft.draftFile(shownPath));
  printCounts(draft, messages);
  printBuilds(draft, messages);
  warnAboutProjects({ draft, rawEvents, projectsByDirectory, messages });
  printWaiting(draft, messages);
  printUnassignedRuns(draft, messages);
  warnAboutEarlierDraft(draft, previous, messages);
}

/** What the draft is built from besides the project: where the agent keeps its files. */
export interface SessionCapture {
  /** Agent name: its raw logs and drafts live in `capture/<agent>/`. */
  agent: string;
  /** Reads the agent's transcripts. */
  transcripts: SessionTranscripts;
}

/** What to build the draft from: the project and, if needed, a specific raw log. */
export interface DraftSessionOptions {
  /** Directory inside the project. */
  projectDirectory: string;
  /** Raw session log; without it the most recent one is taken. */
  rawPath?: string;
  /** Messages in the chosen language. */
  messages: KitMessages;
  /** The agent whose session it is. */
  capture: SessionCapture;
}

/** What an adapter's draft command takes: the options without the agent, which it knows itself. */
export type AgentDraftOptions = Omit<DraftSessionOptions, "capture">;

/**
 * Builds a recording draft from a raw session log and prints what still awaits editing.
 * @param {DraftSessionOptions} options Project, raw log and the agent.
 * @returns {Promise<string>} Path of the written draft.
 * @throws {KitError} If there is no project, no logs yet, or the previous draft is broken.
 */
export async function draftSession(options: DraftSessionOptions): Promise<string> {
  const { messages, capture } = options;
  const project = await requireProject(options.projectDirectory);
  const directories = captureDirectories(project.journal, capture.agent);
  const shown = (file: string) => path.relative(project.root, file) || ".";
  const rawPath = options.rawPath ?? (await newestFile(directories.raw, ".jsonl"));

  if (rawPath === undefined) {
    throw new KitError((m) => m.errors.noRawLogs(shown(directories.raw)));
  }

  const loggedEvents = parseRawLog(await readFile(rawPath, "utf8"));
  const { events: rawEvents, meta } = await capture.transcripts.inputsOf(loggedEvents, messages);
  const projectsByDirectory = await projectsOfDirectories(toolDirectories(rawEvents), messages);
  const fresh = toDraft(rawEvents, {
    sessionId: path.basename(rawPath, ".jsonl"),
    ...meta,
    projectsByDirectory,
  });
  const draftPath = path.join(directories.drafts, `${fresh.id}.json`);
  const previous = await readEarlierDraft(draftPath, shown(draftPath));
  const draft = routeMessages(withEarlierEdits(fresh, previous, messages));

  await mkdir(directories.drafts, { recursive: true });
  await writeFile(draftPath, `${JSON.stringify(draft, null, 2)}\n`);

  reportDraft({
    draft,
    previous,
    rawEvents,
    projectsByDirectory,
    shownPath: shown(draftPath),
    messages,
  });

  return draftPath;
}
