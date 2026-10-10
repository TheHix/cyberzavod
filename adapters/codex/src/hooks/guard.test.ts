import path from "node:path";
import { writeFile } from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  applyPatchPayload,
  shellPayload,
  waitAgentPayload,
} from "../capture/hook-payload.fixtures.ts";
import { runCodexHook } from "./index.ts";
import {
  createTestProject,
  hookContext,
  removeTestProject,
  type TestProject,
} from "./project.fixtures.ts";

let project: TestProject;

function patchOf(...headers: string[]): string {
  return ["*** Begin Patch", ...headers.map((header) => `${header}\n+x`), "*** End Patch"].join(
    "\n",
  );
}

// The permission decision from the hook's stdout; undefined if the hook let the call pass.
async function decisionOn(payload: Record<string, unknown>): Promise<string | undefined> {
  const outcome = await runCodexHook(
    "guard",
    hookContext(project, { ...payload, cwd: project.root }),
  );

  if (outcome.stdout === "") return undefined;

  const parsed = JSON.parse(outcome.stdout) as {
    hookSpecificOutput: { hookEventName: string; permissionDecision: string };
  };

  expect(outcome.exitCode).toBe(0);
  expect(parsed.hookSpecificOutput.hookEventName).toBe("PreToolUse");

  return parsed.hookSpecificOutput.permissionDecision;
}

describe("runCodexHook: guard", () => {
  beforeEach(async () => {
    project = await createTestProject();
  });

  afterEach(async () => {
    await removeTestProject(project);
  });

  it.each([
    "cat .env",
    "source ./.env.local",
    "grep K apps/api/.env",
    'cat ".env"',
    "cat '.env.production'",
    "echo SECRET=1 >> .env",
    "cat < .env",
    "cat $(pwd)/.env",
    "git show HEAD:.env",
    "cat package.json; cat .env",
    "head -n1 {x,.env}",
    "cat .env*",
    "cat apps/.env?",
    "source .env[.]local",
  ])("отказывает на команде %s", async (command) => {
    const decision = await decisionOn(shellPayload(command));

    expect(decision).toBe("deny");
  });

  it.each([
    "ls",
    "cat env.ts",
    "cat .envrc",
    "cat .environment",
    "cat apps/.environment.ts",
    "echo env",
    "git status",
  ])("пропускает команду %s", async (command) => {
    const decision = await decisionOn(shellPayload(command));

    expect(decision).toBeUndefined();
  });

  it.each([
    ["*** Update File: .env"],
    ["*** Add File: apps/api/.env.local"],
    ["*** Delete File: .env"],
    ["*** Update File: src/a.ts", "*** Move to: .env"],
  ])("отказывает на патче с заголовками %s", async (...headers) => {
    const decision = await decisionOn(applyPatchPayload(patchOf(...headers)));

    expect(decision).toBe("deny");
  });

  it("отказывает на патче сырого журнала Codex по относительному и по абсолютному пути", async () => {
    const relative = ".cyberzavod/journal/capture/codex/raw/s1.jsonl";
    const absolute = path.join(project.root, relative);

    const decisions = [
      await decisionOn(applyPatchPayload(patchOf(`*** Update File: ${relative}`))),
      await decisionOn(applyPatchPayload(patchOf(`*** Add File: ${absolute}`))),
    ];

    expect(decisions).toEqual(["deny", "deny"]);
  });

  it("пропускает патч обычных файлов, в том числе соседних с журналом", async () => {
    const patch = patchOf(
      "*** Update File: src/app.ts",
      "*** Add File: .cyberzavod/journal/capture/codex/drafts/s1.json",
    );

    const decision = await decisionOn(applyPatchPayload(patch));

    expect(decision).toBeUndefined();
  });

  it("берёт журнал из конфига проекта", async () => {
    const config = {
      projectId: "lab",
      harness: "0.4.0",
      workflow: "default",
      journal: "../lab.journal",
    };

    await writeFile(path.join(project.root, ".cyberzavod/project.json"), JSON.stringify(config));

    const decision = await decisionOn(
      applyPatchPayload(patchOf("*** Update File: ../lab.journal/capture/codex/raw/s1.jsonl")),
    );

    expect(decision).toBe("deny");
  });

  it("при битом конфиге держит только правило .env", async () => {
    await writeFile(path.join(project.root, ".cyberzavod/project.json"), "{");

    const decisions = [
      await decisionOn(
        applyPatchPayload(
          patchOf("*** Update File: .cyberzavod/journal/capture/codex/raw/s1.jsonl"),
        ),
      ),
      await decisionOn(applyPatchPayload(patchOf("*** Update File: .env"))),
    ];

    expect(decisions).toEqual([undefined, "deny"]);
  });

  it("называет в причине отказа файл", async () => {
    const outcome = await runCodexHook(
      "guard",
      hookContext(project, shellPayload("cat apps/.env")),
    );

    expect(outcome.stdout).toContain("apps/.env");
  });

  it("пропускает вызов другого инструмента, даже если в нём упомянут .env", async () => {
    const payload = { ...waitAgentPayload(), tool_input: { command: "cat .env" } };

    const decision = await decisionOn(payload);

    expect(decision).toBeUndefined();
  });
});
