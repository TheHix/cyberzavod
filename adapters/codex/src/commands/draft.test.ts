import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { KIT_MESSAGES, type RawEvent } from "@cyberzavod/adapter-kit";
import { PROJECT_CONFIG_FILE } from "@cyberzavod/storage";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_ID, SUBAGENT_ID } from "../capture/hook-payload.fixtures.ts";
import {
  finishedReviewerRollout,
  REVIEWER_REPORT,
  SESSION_START_MS,
  sessionRollout,
} from "../capture/rollout.fixtures.ts";
import { draftSession } from "./draft.ts";

const JOURNAL = ".cyberzavod/journal";
const COMMAND_CALL_ID = "call-red";

let root: string;

async function connectProject(): Promise<void> {
  const config = { projectId: "lab", harness: "0.4.0", workflow: "default", journal: JOURNAL };

  await mkdir(path.join(root, path.dirname(PROJECT_CONFIG_FILE)), { recursive: true });
  await writeFile(path.join(root, PROJECT_CONFIG_FILE), JSON.stringify(config));
}

async function writeRollouts(): Promise<{ session: string; reviewer: string }> {
  const session = path.join(root, "rollout-session.jsonl");
  const reviewer = path.join(root, "rollout-reviewer.jsonl");

  await writeFile(session, sessionRollout());
  await writeFile(reviewer, finishedReviewerRollout());

  return { session, reviewer };
}

async function writeRawLog(events: RawEvent[]): Promise<string> {
  const directory = path.join(root, JOURNAL, "capture", "codex", "raw");
  const file = path.join(directory, `${SESSION_ID}.jsonl`);

  await mkdir(directory, { recursive: true });
  await writeFile(file, events.map((event) => JSON.stringify(event)).join("\n"));

  return file;
}

// What the hooks recorded for the live session: the prompt, the reviewer's run and a command that
// the hook took for a success.
function reviewSession(rollouts: { session: string; reviewer: string }): RawEvent[] {
  const cwd = root;
  const at = (ms: number) => SESSION_START_MS + ms;

  return [
    { ts: at(0), kind: "session_start", project: "lab", harness: "0.4.0", workflow: "default" },
    { ts: at(80), kind: "prompt", text: "do review" },
    { ts: at(300), kind: "subagent_start", agent: "reviewer", agentId: SUBAGENT_ID },
    {
      ts: at(400),
      kind: "tool",
      tool: "Bash",
      ok: true,
      command: "make check",
      callId: COMMAND_CALL_ID,
      cwd,
    },
    {
      ts: at(450),
      kind: "subagent_stop",
      agent: "reviewer",
      agentId: SUBAGENT_ID,
      transcriptPath: rollouts.reviewer,
      verdict: "APPROVED",
    },
    { ts: at(500), kind: "stop", transcriptPath: rollouts.session },
  ];
}

interface DraftEventShape {
  type: string;
  model?: string;
  ok?: boolean;
  tokens?: number;
  run?: string;
  said?: string;
  source?: string;
}

// The draft the command builds from the project's raw log, as its events.
async function drafted(): Promise<DraftEventShape[]> {
  const draftPath = await draftSession({ projectDirectory: root, messages: KIT_MESSAGES.en });
  const draft = JSON.parse(await readFile(draftPath, "utf8")) as { events: DraftEventShape[] };

  return draft.events;
}

describe("draftSession", () => {
  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), "cyberzavod-codex-draft-"));
    await connectProject();
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(root, { recursive: true, force: true });
  });

  it("кладёт черновик в каталог черновиков Codex журнала проекта", async () => {
    await writeRawLog(reviewSession(await writeRollouts()));

    const draftPath = await draftSession({ projectDirectory: root, messages: KIT_MESSAGES.en });

    expect(path.dirname(draftPath)).toBe(path.join(root, JOURNAL, "capture", "codex", "drafts"));
  });

  it("берёт модель промпта из rollout сессии", async () => {
    await writeRawLog(reviewSession(await writeRollouts()));

    const events = await drafted();

    expect(events.find((event) => event.type === "draft_prompt")?.model).toBe("gpt-5.5");
  });

  it("выводит ревью из запуска reviewer и считает его токены по rollout", async () => {
    await writeRawLog(reviewSession(await writeRollouts()));

    const events = await drafted();

    expect(events).toContainEqual(
      expect.objectContaining({ type: "stage_enter", stage: "review", run: SUBAGENT_ID }),
    );
    expect(events).toContainEqual(
      expect.objectContaining({ type: "draft_run", agent: "reviewer", run: SUBAGENT_ID }),
    );
    expect(events.find((event) => event.type === "usage" && event.run !== undefined)?.tokens).toBe(
      250,
    );
  });

  it("берёт задание ревьюеру и его отчёт из rollout как реплики", async () => {
    await writeRawLog(reviewSession(await writeRollouts()));

    const events = await drafted();

    expect(
      events
        .filter((event) => event.type === "draft_message")
        .map(({ source, said }) => [source, said]),
    ).toEqual(
      expect.arrayContaining([
        ["assignment", "review the change"],
        ["report", REVIEWER_REPORT],
        ["answer", "parent done"],
      ]),
    );
  });

  it("берёт исход проверки из кода выхода в rollout, а не из хука", async () => {
    const rollouts = await writeRollouts();
    const redCommand = `{"timestamp":"2026-10-10T08:33:12.100Z","type":"event_msg","payload":{"type":"item_completed","item":{"type":"CommandExecution","id":"${COMMAND_CALL_ID}","status":"completed","exit_code":1}}}\n`;

    await writeFile(rollouts.session, sessionRollout() + redCommand);
    await writeRawLog(reviewSession(rollouts));

    const events = await drafted();

    expect(events.filter((event) => event.type === "draft_check").map(({ ok }) => ok)).toContain(
      false,
    );
  });

  it("предупреждает о сжатом rollout, а не о потерянном", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const rollouts = await writeRollouts();

    await rm(rollouts.session);
    await writeFile(`${rollouts.session}.zst`, "");
    await writeRawLog(reviewSession(rollouts));

    await draftSession({ projectDirectory: root, messages: KIT_MESSAGES.en });

    expect(warn.mock.calls.join("\n")).toContain(
      KIT_MESSAGES.en.draft.transcriptCompressed(rollouts.session),
    );
  });
});
