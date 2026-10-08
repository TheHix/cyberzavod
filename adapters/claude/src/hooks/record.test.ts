import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PROJECT_CONFIG_FILE } from "@cyberzavod/storage";
import { CLAUDE_MESSAGES } from "../messages/catalog.ts";
import type { HookContext } from "./hook.ts";
import { recordEvent } from "./record.ts";
import { hookStatePath } from "./state.ts";

const SESSION = "s1";
const RAW_LOG = `.cyberzavod/journal/capture/claude/raw/${SESSION}.jsonl`;

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
    messages: CLAUDE_MESSAGES.en,
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

    await recordEvent(promptContext("Сделай задачу"));

    expect(await recordedEvents()).toEqual([
      expect.objectContaining({ kind: "prompt", text: "Сделай задачу" }),
    ]);
  });

  it("помечает промпт после вызова человека хуком остановки и забирает отметку", async () => {
    await connectProject();
    await writeFile(hookStatePath(workspace, SESSION, "human-call"), "4");

    await recordEvent(promptContext("Посмотрел, продолжай"));

    expect(await recordedEvents()).toEqual([expect.objectContaining({ afterStopGate: true })]);
  });

  it("вне проекта ничего не пишет", async () => {
    const outcome = await recordEvent(promptContext("Сделай задачу"));

    expect(outcome).toEqual({ exitCode: 0, stdout: "", stderr: "" });
  });

  it("при битом конфиге предупреждает и ничего не пишет", async () => {
    await mkdir(path.join(root, path.dirname(PROJECT_CONFIG_FILE)), { recursive: true });
    await writeFile(path.join(root, PROJECT_CONFIG_FILE), "{");

    const outcome = await recordEvent(promptContext("Сделай задачу"));

    expect(outcome.stderr).toContain("session not recorded");
  });

  it("отклоняет session_id, который не годится для имени файла", async () => {
    await connectProject();
    const payload = { hook_event_name: "UserPromptSubmit", session_id: "../x", prompt: "Привет" };

    const act = () => recordEvent({ ...promptContext(""), payload: JSON.stringify(payload) });

    await expect(act).rejects.toThrow(/session_id/);
  });
});
