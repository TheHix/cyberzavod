import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { hookStatePath, type HookOutcome } from "@cyberzavod/adapter-kit";
import { promptPayload, SESSION_ID, stopPayload } from "../capture/hook-payload.fixtures.ts";
import { runCodexHook } from "./index.ts";
import {
  createTestProject,
  hookContext,
  RED_WHEN_BROKEN,
  removeTestProject,
  type TestProject,
} from "./project.fixtures.ts";

const BLOCKS_BEFORE_HUMAN_CALL = 3;

let project: TestProject;

async function breakCode(): Promise<void> {
  await writeFile(path.join(project.root, "apps/broken"), "x\n");
}

async function stop(directory = project.root): Promise<HookOutcome> {
  return runCodexHook("stop", hookContext(project, stopPayload(), directory));
}

async function rawLog(): Promise<Record<string, unknown>[]> {
  const file = path.join(project.root, `.cyberzavod/journal/capture/codex/raw/${SESSION_ID}.jsonl`);
  const lines = (await readFile(file, "utf8")).trim().split("\n");

  return lines.map((line) => JSON.parse(line) as Record<string, unknown>);
}

describe("runCodexHook: stop", () => {
  beforeEach(async () => {
    project = await createTestProject({
      verification: { commands: [RED_WHEN_BROKEN], paths: ["apps"] },
    });
  });

  afterEach(async () => {
    await removeTestProject(project);
  });

  it("возвращает агента к работе JSON-решением block с кодом 0, пока проверки красные", async () => {
    await breakCode();

    const outcome = await stop();

    expect(outcome.exitCode).toBe(0);
    expect(JSON.parse(outcome.stdout)).toEqual({
      decision: "block",
      reason: expect.stringContaining("type error in apps/broken") as string,
    });
  });

  it("отпускает агента молча, когда код не менялся", async () => {
    const outcome = await stop();

    expect(outcome).toEqual({ exitCode: 0, stdout: "", stderr: "" });
  });

  it("находит проект, когда сессия идёт в его подкаталоге", async () => {
    await breakCode();

    const outcome = await stop(path.join(project.root, "apps"));

    expect(outcome.stdout).toContain('"decision":"block"');
  });

  it("на четвёртый вызов отпускает с systemMessage и оставляет отметку human-call", async () => {
    await breakCode();
    for (let attempt = 0; attempt < BLOCKS_BEFORE_HUMAN_CALL; attempt += 1) await stop();

    const outcome = await stop();

    expect(JSON.parse(outcome.stdout)).toEqual({
      systemMessage: expect.stringContaining("a human is needed") as string,
    });
    expect(existsSync(hookStatePath(project.tmpDir, SESSION_ID, "human-call"))).toBe(true);
  });

  it("помечает следующий промпт человека afterStopGate и забирает отметку", async () => {
    await breakCode();
    for (let attempt = 0; attempt <= BLOCKS_BEFORE_HUMAN_CALL; attempt += 1) await stop();

    await runCodexHook("record", hookContext(project, promptPayload("Посмотрел, продолжай")));

    expect(await rawLog()).toEqual([
      expect.objectContaining({
        kind: "prompt",
        text: "Посмотрел, продолжай",
        afterStopGate: true,
      }),
    ]);
    expect(existsSync(hookStatePath(project.tmpDir, SESSION_ID, "human-call"))).toBe(false);
  });

  it("не считает правками код, изменённый до начала хода", async () => {
    await breakCode();
    await runCodexHook("turn-start", hookContext(project, promptPayload()));

    const outcome = await stop();

    expect(outcome).toEqual({ exitCode: 0, stdout: "", stderr: "" });
  });

  it("блокирует, если код изменился после начала хода", async () => {
    await runCodexHook("turn-start", hookContext(project, promptPayload()));
    await breakCode();

    const outcome = await stop();

    expect(outcome.stdout).toContain('"decision":"block"');
  });

  it("отпускает с сообщением при битом конфиге", async () => {
    await writeFile(path.join(project.root, ".cyberzavod/project.json"), "{");

    const outcome = await stop();

    expect(JSON.parse(outcome.stdout)).toEqual({
      systemMessage: expect.stringContaining("cannot be read") as string,
    });
  });
});
