import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PROJECT_CONFIG_FILE } from "@cyberzavod/storage";
import { KIT_MESSAGES } from "../messages/catalog.ts";
import type { HookContext } from "./hook.ts";
import { isObject } from "../object.ts";
import type { RawEvent } from "../capture/raw-event.ts";
import { recordEvent, type RawEventSource } from "./record.ts";
import { hookStatePath } from "./state.ts";

const SESSION = "s1";
const RAW_LOG = `.cyberzavod/journal/capture/test-agent/raw/${SESSION}.jsonl`;

// An agent of its own for the test: the hook does not care whose payloads it records.
const SOURCE: RawEventSource = {
  agent: "test-agent",
  eventOf: (payload, ts): RawEvent | null => {
    if (!isObject(payload)) return null;

    switch (payload.hook_event_name) {
      case "UserPromptSubmit":
        return { ts, kind: "prompt", text: String(payload.prompt) };
      case "SessionStart":
        return { ts, kind: "session_start" };
      default:
        return null;
    }
  },
};

let workspace: string;
let root: string;

async function connectProject(): Promise<void> {
  const config = {
    projectId: "lab",
    harness: "0.4.0",
    workflow: "default",
    journal: ".cyberzavod/journal",
  };

  await mkdir(path.join(root, path.dirname(PROJECT_CONFIG_FILE)), { recursive: true });
  await writeFile(path.join(root, PROJECT_CONFIG_FILE), JSON.stringify(config));
}

function promptContext(prompt: string): HookContext {
  return {
    payload: JSON.stringify({ hook_event_name: "UserPromptSubmit", session_id: SESSION, prompt }),
    projectDirectory: root,
    tmpDir: workspace,
    messages: KIT_MESSAGES.en,
  };
}

async function recordedEvents(): Promise<unknown[]> {
  const lines = (await readFile(path.join(root, RAW_LOG), "utf8")).trim().split("\n");

  return lines.map((line) => JSON.parse(line) as unknown);
}

describe("recordEvent", () => {
  beforeEach(async () => {
    workspace = await mkdtemp(path.join(tmpdir(), "cyberzavod-record-"));
    root = path.join(workspace, "lab");
    await mkdir(root);
  });

  afterEach(async () => {
    await rm(workspace, { recursive: true, force: true });
  });

  it("дописывает промпт в сырой журнал сессии проекта", async () => {
    await connectProject();

    await recordEvent(promptContext("Сделай задачу"), SOURCE);

    expect(await recordedEvents()).toEqual([
      expect.objectContaining({ kind: "prompt", text: "Сделай задачу" }),
    ]);
  });

  it("помечает промпт после вызова человека хуком остановки и забирает отметку", async () => {
    await connectProject();
    await writeFile(hookStatePath(workspace, SESSION, "human-call"), "4");

    await recordEvent(promptContext("Посмотрел, продолжай"), SOURCE);

    expect(await recordedEvents()).toEqual([expect.objectContaining({ afterStopGate: true })]);
  });

  it("вне проекта ничего не пишет", async () => {
    const outcome = await recordEvent(promptContext("Сделай задачу"), SOURCE);

    expect(outcome).toEqual({ exitCode: 0, stdout: "", stderr: "" });
  });

  it("при битом конфиге предупреждает и ничего не пишет", async () => {
    await mkdir(path.join(root, path.dirname(PROJECT_CONFIG_FILE)), { recursive: true });
    await writeFile(path.join(root, PROJECT_CONFIG_FILE), "{");

    const outcome = await recordEvent(promptContext("Сделай задачу"), SOURCE);

    expect(outcome.stderr).toContain("session not recorded");
  });

  it("отклоняет session_id, который не годится для имени файла", async () => {
    await connectProject();
    const payload = { hook_event_name: "UserPromptSubmit", session_id: "../x", prompt: "Привет" };

    const act = () =>
      recordEvent({ ...promptContext(""), payload: JSON.stringify(payload) }, SOURCE);

    await expect(act).rejects.toThrow(/session_id/);
  });

  it("ставит на начало сессии проект, версию harness и процесс", async () => {
    await connectProject();
    const payload = { hook_event_name: "SessionStart", session_id: SESSION };

    await recordEvent({ ...promptContext(""), payload: JSON.stringify(payload) }, SOURCE);

    expect(await recordedEvents()).toEqual([
      expect.objectContaining({
        kind: "session_start",
        project: "lab",
        harness: "0.4.0",
        workflow: "default",
      }),
    ]);
  });

  it("не пишет событие, которое агент не считает нужным для записи", async () => {
    await connectProject();
    const payload = { hook_event_name: "PreToolUse", session_id: SESSION };

    await recordEvent({ ...promptContext(""), payload: JSON.stringify(payload) }, SOURCE);

    expect(existsSync(path.join(root, RAW_LOG))).toBe(false);
  });

  it("не принимает служебное сообщение за слова человека и не забирает отметку", async () => {
    await connectProject();
    const marker = hookStatePath(workspace, SESSION, "human-call");

    await writeFile(marker, "4");

    await recordEvent(promptContext('<hook_prompt hook_run_id="stop:1">fix</hook_prompt>'), SOURCE);

    expect(existsSync(marker)).toBe(true);
    expect(await recordedEvents()).toEqual([expect.not.objectContaining({ afterStopGate: true })]);
  });
});
