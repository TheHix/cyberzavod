import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { KIT_MESSAGES } from "@cyberzavod/adapter-kit";
import { PROJECT_CONFIG_FILE } from "@cyberzavod/storage";
import { runHook } from "./index.ts";

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

async function record(payload: object): Promise<void> {
  await runHook("record", {
    payload: JSON.stringify({ session_id: SESSION, ...payload }),
    projectDirectory: root,
    tmpDir: workspace,
    messages: KIT_MESSAGES.en,
  });
}

async function recordedEvents(): Promise<unknown[]> {
  const lines = (await readFile(path.join(root, RAW_LOG), "utf8")).trim().split("\n");

  return lines.map((line) => JSON.parse(line) as unknown);
}

describe("runHook", () => {
  beforeEach(async () => {
    workspace = await mkdtemp(path.join(tmpdir(), "cyberzavod-claude-hook-"));
    root = path.join(workspace, "lab");
    await mkdir(root);
    await connectProject();
  });

  afterEach(async () => {
    await rm(workspace, { recursive: true, force: true });
  });

  it("record пишет промпт Claude Code в capture/claude/raw/<сессия>.jsonl", async () => {
    await record({ hook_event_name: "UserPromptSubmit", prompt: "Сделай цех" });

    expect(await recordedEvents()).toEqual([
      { ts: expect.any(Number) as number, kind: "prompt", text: "Сделай цех" },
    ]);
  });

  it("record ставит на начало сессии проект, версию harness и процесс", async () => {
    await record({ hook_event_name: "SessionStart", source: "startup" });

    expect(await recordedEvents()).toEqual([
      expect.objectContaining({
        kind: "session_start",
        project: "lab",
        harness: "0.4.0",
        workflow: "default",
      }),
    ]);
  });

  it("record не пишет событие, которое Claude Code не нужно для записи", async () => {
    await record({ hook_event_name: "PreToolUse", tool_name: "Bash" });
    await record({ hook_event_name: "UserPromptSubmit", prompt: "Дальше" });

    expect(await recordedEvents()).toHaveLength(1);
  });
});
