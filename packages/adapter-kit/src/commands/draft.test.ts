import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { PROJECT_CONFIG_FILE } from "@cyberzavod/storage";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KitError } from "../errors.ts";
import { KIT_MESSAGES } from "../messages/catalog.ts";
import type { RawEvent } from "../capture/raw-event.ts";
import type { SessionTranscripts } from "../capture/transcripts.ts";
import { draftSession } from "./draft.ts";

const JOURNAL = ".cyberzavod/journal";
const AGENT = "codex";
const SESSION_ID = "0123456789abcdef";
const START = Date.UTC(2026, 9, 4, 10, 0, 0);

let root: string;

async function connectProject(): Promise<void> {
  const config = { projectId: "lab", harness: "0.4.0", workflow: "default", journal: JOURNAL };

  await mkdir(path.join(root, path.dirname(PROJECT_CONFIG_FILE)), { recursive: true });
  await writeFile(path.join(root, PROJECT_CONFIG_FILE), JSON.stringify(config));
}

async function writeRawLog(events: RawEvent[]): Promise<string> {
  const directory = path.join(root, JOURNAL, "capture", AGENT, "raw");
  const file = path.join(directory, `${SESSION_ID}.jsonl`);

  await mkdir(directory, { recursive: true });
  await writeFile(file, events.map((event) => JSON.stringify(event)).join("\n"));

  return file;
}

function promptedSession(): RawEvent[] {
  return [
    { ts: START, kind: "session_start", project: "lab", harness: "0.4.0", workflow: "default" },
    { ts: START + 1_000, kind: "prompt", text: "Добавь счётчик" },
    {
      ts: START + 5_000,
      kind: "tool",
      tool: "Bash",
      ok: true,
      command: "make check",
      callId: "c1",
    },
  ];
}

// Transcripts that know the model and mark the call `c1` as failed.
function fakeTranscripts(): SessionTranscripts {
  return {
    inputsOf: (events) =>
      Promise.resolve({
        events: events.map((event) =>
          event.kind === "tool" && event.callId === "c1" ? { ...event, ok: false } : event,
        ),
        meta: {
          runTokens: new Map(),
          runModels: new Map(),
          sessionUsages: [],
          replies: [{ ts: START + 2_000, model: "gpt-x" }],
          answers: [],
          assignments: [],
          reports: [],
        },
      }),
  };
}

async function readDraft(file: string): Promise<{ events: { type: string; model?: string }[] }> {
  return JSON.parse(await readFile(file, "utf8")) as { events: { type: string; model?: string }[] };
}

// The draft the command builds from the written raw log.
async function drafted(): Promise<{ events: { type: string; model?: string }[] }> {
  const draftPath = await draftSession({
    projectDirectory: root,
    messages: KIT_MESSAGES.en,
    capture: { agent: AGENT, transcripts: fakeTranscripts() },
  });

  return readDraft(draftPath);
}

describe("draftSession", () => {
  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), "cyberzavod-draft-"));
    await connectProject();
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(root, { recursive: true, force: true });
  });

  it("собирает черновик из сырого журнала агента и кладёт в его каталог черновиков", async () => {
    await writeRawLog(promptedSession());

    const draftPath = await draftSession({
      projectDirectory: root,
      messages: KIT_MESSAGES.en,
      capture: { agent: AGENT, transcripts: fakeTranscripts() },
    });

    expect(draftPath).toBe(
      path.join(root, JOURNAL, "capture", AGENT, "drafts", "2026-10-04-01234567.json"),
    );
  });

  it("берёт модель промпта и исход проверки из транскриптов", async () => {
    await writeRawLog(promptedSession());

    const { events } = await drafted();

    expect(events.filter((event) => ["draft_prompt", "draft_check"].includes(event.type))).toEqual([
      expect.objectContaining({ type: "draft_prompt", model: "gpt-x" }) as unknown,
      expect.objectContaining({ type: "draft_check", ok: false }) as unknown,
    ]);
  });

  it("называет в сводке черновик и что ждёт редактуры", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

    await writeRawLog(promptedSession());

    await draftSession({
      projectDirectory: root,
      messages: KIT_MESSAGES.en,
      capture: { agent: AGENT, transcripts: fakeTranscripts() },
    });

    expect(log.mock.calls.map(([text]) => text)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("capture/codex/drafts/2026-10-04-01234567.json") as string,
        "awaiting editing: 1",
      ]),
    );
  });

  it("без сырых журналов агента — ошибка с каталогом, где их ждут", async () => {
    const act = () =>
      draftSession({
        projectDirectory: root,
        messages: KIT_MESSAGES.en,
        capture: { agent: AGENT, transcripts: fakeTranscripts() },
      });

    await expect(act()).rejects.toBeInstanceOf(KitError);
    await expect(act()).rejects.toThrow("capture/codex/raw");
  });
});
