import { existsSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { hookStatePath } from "@cyberzavod/adapter-kit";
import { promptPayload, SESSION_ID } from "../capture/hook-payload.fixtures.ts";
import { runCodexHook } from "./index.ts";
import {
  createTestProject,
  hookContext,
  RED_WHEN_BROKEN,
  removeTestProject,
  type TestProject,
} from "./project.fixtures.ts";

let project: TestProject;

describe("runCodexHook: turn-start", () => {
  beforeEach(async () => {
    project = await createTestProject({
      verification: { commands: [RED_WHEN_BROKEN], paths: ["apps"] },
    });
  });

  afterEach(async () => {
    await removeTestProject(project);
  });

  it("запоминает отпечаток кода на промпте основной сессии", async () => {
    await runCodexHook("turn-start", hookContext(project, promptPayload()));

    expect(existsSync(hookStatePath(project.tmpDir, SESSION_ID, "turn-start"))).toBe(true);
  });

  it("не начинает ход на задании, которое получил сабагент", async () => {
    const assignment = {
      ...promptPayload("review the change"),
      agent_id: "a1",
      agent_type: "reviewer",
    };

    await runCodexHook("turn-start", hookContext(project, assignment));

    expect(existsSync(hookStatePath(project.tmpDir, SESSION_ID, "turn-start"))).toBe(false);
  });
});
