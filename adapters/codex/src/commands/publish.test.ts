import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { KIT_MESSAGES } from "@cyberzavod/adapter-kit";
import { parseRecord } from "@cyberzavod/core";
import { PROJECT_CONFIG_FILE } from "@cyberzavod/storage";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_ID, SUBAGENT_ID } from "../capture/hook-payload.fixtures.ts";
import {
  finishedReviewerRollout,
  SESSION_START_MS,
  sessionRollout,
} from "../capture/rollout.fixtures.ts";
import { draftSession } from "./draft.ts";
import { CODEX_SOURCE, publishSessions } from "./publish.ts";

const JOURNAL = ".cyberzavod/journal";

interface EditedDraft {
  builds: { title: string; language: string }[];
  events: { type: string; goal?: string; requirements?: string[]; line?: string; text?: string }[];
}

let root: string;

async function connectProject(): Promise<void> {
  const config = { projectId: "lab", harness: "0.4.0", workflow: "default", journal: JOURNAL };

  await mkdir(path.join(root, path.dirname(PROJECT_CONFIG_FILE)), { recursive: true });
  await writeFile(path.join(root, PROJECT_CONFIG_FILE), JSON.stringify(config));
}

// A draft of the live review session, as the recording editor would leave it: every field filled.
async function editedDraft(): Promise<string> {
  const session = path.join(root, "rollout-session.jsonl");
  const reviewer = path.join(root, "rollout-reviewer.jsonl");
  const rawDirectory = path.join(root, JOURNAL, "capture", "codex", "raw");
  const at = (ms: number) => SESSION_START_MS + ms;
  const events = [
    { ts: at(0), kind: "session_start", project: "lab", harness: "0.4.0", workflow: "default" },
    { ts: at(80), kind: "prompt", text: "do review" },
    { ts: at(300), kind: "subagent_start", agent: "reviewer", agentId: SUBAGENT_ID },
    {
      ts: at(450),
      kind: "subagent_stop",
      agent: "reviewer",
      agentId: SUBAGENT_ID,
      transcriptPath: reviewer,
      verdict: "APPROVED",
    },
    { ts: at(500), kind: "stop", transcriptPath: session },
  ];

  await mkdir(rawDirectory, { recursive: true });
  await writeFile(session, sessionRollout());
  await writeFile(reviewer, finishedReviewerRollout());
  await writeFile(
    path.join(rawDirectory, `${SESSION_ID}.jsonl`),
    events.map((event) => JSON.stringify(event)).join("\n"),
  );

  const draftPath = await draftSession({ projectDirectory: root, messages: KIT_MESSAGES.en });
  const draft = JSON.parse(await readFile(draftPath, "utf8")) as EditedDraft;

  draft.builds[0] = { ...draft.builds[0], title: "Review", language: "en" };

  for (const event of draft.events) {
    if (event.type === "draft_prompt") Object.assign(event, { goal: "Review", requirements: [] });
    if (event.type === "draft_message") Object.assign(event, { line: "Done", text: "Done." });
  }

  await writeFile(draftPath, JSON.stringify(draft));

  return draftPath;
}

// The recording the publication wrote for the draft.
async function publishedRecord(draftPath: string) {
  const recordPath = path.join(root, JOURNAL, "sessions", path.basename(draftPath));

  return parseRecord(JSON.parse(await readFile(recordPath, "utf8")));
}

describe("publishSessions", () => {
  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), "cyberzavod-codex-publish-"));
    await connectProject();
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(root, { recursive: true, force: true });
  });

  it("пишет запись сессии, которую принимает parseRecord, с источником Codex", async () => {
    const draftPath = await editedDraft();

    const isPublished = await publishSessions({
      projectDirectory: root,
      draftPath,
      messages: KIT_MESSAGES.en,
    });

    expect(isPublished).toBe(true);
    expect((await publishedRecord(draftPath)).source).toEqual(CODEX_SOURCE);
    expect(CODEX_SOURCE).toEqual({ type: "agent", provider: "openai", agent: "codex" });
  });
});
