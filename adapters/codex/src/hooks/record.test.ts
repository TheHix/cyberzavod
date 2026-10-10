import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  applyPatchPayload,
  promptPayload,
  sessionStartPayload,
  SESSION_ID,
  shellPayload,
  spawnAgentPayload,
  stopPayload,
  subagentAssignmentPayload,
  subagentStartPayload,
  subagentStopPayload,
  waitAgentPayload,
} from "../capture/hook-payload.fixtures.ts";
import { runCodexHook } from "./index.ts";
import {
  createTestProject,
  hookContext,
  removeTestProject,
  type TestProject,
} from "./project.fixtures.ts";

const RAW_LOG = `.cyberzavod/journal/capture/codex/raw/${SESSION_ID}.jsonl`;

let project: TestProject;

async function recordAll(payloads: Record<string, unknown>[]): Promise<void> {
  for (const payload of payloads) {
    await runCodexHook("record", hookContext(project, payload));
  }
}

async function rawLogText(): Promise<string> {
  return readFile(path.join(project.root, RAW_LOG), "utf8");
}

async function recordedEvents(): Promise<Record<string, unknown>[]> {
  const lines = (await rawLogText()).trim().split("\n");

  return lines.map((line) => JSON.parse(line) as Record<string, unknown>);
}

describe("runCodexHook: record", () => {
  beforeEach(async () => {
    project = await createTestProject();
  });

  afterEach(async () => {
    await removeTestProject(project);
  });

  it("пишет по одному событию на каждую нагрузку сессии в capture/codex/raw/<session_id>.jsonl", async () => {
    await recordAll([
      sessionStartPayload(),
      promptPayload(),
      spawnAgentPayload(),
      subagentStartPayload(),
      shellPayload(),
      applyPatchPayload(),
      subagentStopPayload(),
      stopPayload(),
    ]);

    const kinds = (await recordedEvents()).map((event) => event.kind);

    expect(kinds).toEqual([
      "session_start",
      "prompt",
      "tool",
      "subagent_start",
      "tool",
      "tool",
      "subagent_stop",
      "stop",
    ]);
  });

  it("ставит на начало сессии проект, версию harness и процесс", async () => {
    await recordAll([sessionStartPayload()]);

    expect(await recordedEvents()).toEqual([
      expect.objectContaining({
        kind: "session_start",
        project: "lab",
        harness: "0.4.0",
        workflow: "default",
      }),
    ]);
  });

  it("не пишет в журнал текст патча, задание сабагенту и ответы инструментов", async () => {
    await recordAll([
      promptPayload(),
      spawnAgentPayload(),
      shellPayload(),
      applyPatchPayload(),
      waitAgentPayload(),
    ]);

    const log = await rawLogText();

    expect(log).not.toContain("secret text");
    expect(log).not.toContain("review the change");
    expect(log).not.toContain("secret-output");
    expect(log).not.toContain("Epicurus");
  });

  it("не пишет промпт сабагента — это его задание, а не слова человека", async () => {
    await recordAll([promptPayload(), subagentAssignmentPayload()]);

    const kinds = (await recordedEvents()).map((event) => event.kind);

    expect(kinds).toEqual(["prompt"]);
  });

  it("находит журнал проекта, когда сессия идёт в его подкаталоге", async () => {
    const directory = path.join(project.root, "apps");

    await runCodexHook("record", hookContext(project, promptPayload(), directory));

    expect(await recordedEvents()).toHaveLength(1);
  });

  it("вне проекта ничего не пишет", async () => {
    const outside = path.join(project.workspace, "elsewhere");

    await mkdir(outside);

    const outcome = await runCodexHook("record", hookContext(project, promptPayload(), outside));

    expect(outcome).toEqual({ exitCode: 0, stdout: "", stderr: "" });
  });

  it("при битом конфиге предупреждает и ничего не пишет", async () => {
    await writeFile(path.join(project.root, ".cyberzavod/project.json"), "{");

    const outcome = await runCodexHook("record", hookContext(project, promptPayload()));

    expect(outcome.stderr).toContain("session not recorded");
  });

  it("отклоняет session_id, который не годится для имени файла", async () => {
    const payload = { ...promptPayload(), session_id: "../x" };

    const act = () => runCodexHook("record", hookContext(project, payload));

    await expect(act()).rejects.toThrow(/session_id/);
  });
});
