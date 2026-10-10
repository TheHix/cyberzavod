import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { KIT_MESSAGES } from "@cyberzavod/adapter-kit";
import { parseRecord } from "@cyberzavod/core";
import { PROJECT_CONFIG_FILE } from "@cyberzavod/storage";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { draftSession } from "./draft.ts";
import { CLAUDE_SOURCE, publishSessions } from "./publish.ts";

const JOURNAL = ".cyberzavod/journal";
const START = Date.UTC(2026, 9, 4, 10, 0, 0);

interface EditedDraft {
  builds: { title: string; language: string }[];
  events: { type: string; goal?: string; requirements?: string[] }[];
}

let root: string;

async function connectProject(): Promise<void> {
  const config = { projectId: "lab", harness: "0.4.0", workflow: "default", journal: JOURNAL };

  await mkdir(path.join(root, path.dirname(PROJECT_CONFIG_FILE)), { recursive: true });
  await writeFile(path.join(root, PROJECT_CONFIG_FILE), JSON.stringify(config));
}

// A draft of a one-prompt session with every field the editor fills in already filled.
async function editedDraft(): Promise<string> {
  const rawDirectory = path.join(root, JOURNAL, "capture", "claude", "raw");
  const events = [
    { ts: START, kind: "session_start", project: "lab", harness: "0.4.0", workflow: "default" },
    { ts: START + 1_000, kind: "prompt", text: "Add a counter" },
  ];

  await mkdir(rawDirectory, { recursive: true });
  await writeFile(
    path.join(rawDirectory, "0123456789abcdef.jsonl"),
    events.map((event) => JSON.stringify(event)).join("\n"),
  );

  const draftPath = await draftSession({ projectDirectory: root, messages: KIT_MESSAGES.en });
  const draft = JSON.parse(await readFile(draftPath, "utf8")) as EditedDraft;

  draft.builds[0] = { ...draft.builds[0], title: "Counter", language: "en" };

  for (const event of draft.events) {
    if (event.type === "draft_prompt") {
      Object.assign(event, { goal: "Add a counter", requirements: [] });
    }
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
    root = await mkdtemp(path.join(tmpdir(), "cyberzavod-claude-publish-"));
    await connectProject();
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(root, { recursive: true, force: true });
  });

  it("пишет запись сессии, которую принимает parseRecord, с источником Claude Code", async () => {
    const draftPath = await editedDraft();

    const isPublished = await publishSessions({
      projectDirectory: root,
      draftPath,
      messages: KIT_MESSAGES.en,
    });

    expect(isPublished).toBe(true);
    expect((await publishedRecord(draftPath)).source).toEqual(CLAUDE_SOURCE);
    expect(CLAUDE_SOURCE).toEqual({ type: "agent", provider: "anthropic", agent: "claude" });
  });
});
