import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PROJECT_CONFIG_FILE } from "@cyberzavod/storage";
import { CLAUDE_MESSAGES } from "../messages/catalog.ts";
import type { ClaudeMessages } from "../messages/claude-messages.ts";
import type { HookContext, HookOutcome } from "./hook.ts";
import { gateStop } from "./stop-gate.ts";
import { startTurn } from "./turn-start.ts";

const SESSION = "test-session";
const RELEASED = 0;
// The check fails while apps/broken exists.
const RED_WHEN_BROKEN = "test ! -f apps/broken || (echo 'ошибка типов в apps/broken'; exit 1)";

const NO_CONFIG = "";

let workspace: string;
let repo: string;
let tmpDir: string;

function configWith(verification: unknown): string {
  return JSON.stringify({
    projectId: "lab",
    harness: "0.4.0",
    workflow: "default",
    journal: ".cyberzavod/journal",
    verification,
  });
}

function git(...args: string[]): void {
  execFileSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", ...args], { cwd: repo });
}

async function makeRepo(
  config = configWith({ commands: [RED_WHEN_BROKEN], paths: ["apps"] }),
): Promise<void> {
  await mkdir(path.join(repo, "apps"), { recursive: true });
  await writeFile(path.join(repo, "apps/main.ts"), "ok\n");

  if (config !== NO_CONFIG) {
    await mkdir(path.join(repo, path.dirname(PROJECT_CONFIG_FILE)), { recursive: true });
    await writeFile(path.join(repo, PROJECT_CONFIG_FILE), config);
  }

  git("init", "-q");
  git("add", "-A");
  git("commit", "-qm", "init");
}

function context(messages: ClaudeMessages = CLAUDE_MESSAGES.en): HookContext {
  return {
    payload: JSON.stringify({ session_id: SESSION }),
    projectDirectory: repo,
    tmpDir,
    messages,
  };
}

async function stopTimes(times: number): Promise<HookOutcome | undefined> {
  let outcome: HookOutcome | undefined;

  for (let attempt = 0; attempt < times; attempt += 1) outcome = await gateStop(context());

  return outcome;
}

// Refusal reason from the JSON `block` decision on stdout; undefined if the hook lets the agent go.
function blockReason(outcome: HookOutcome): string | undefined {
  if (outcome.stdout === "") return undefined;

  const parsed = JSON.parse(outcome.stdout) as { decision?: string; reason?: string };

  return parsed.decision === "block" ? parsed.reason : undefined;
}

function isBlocked(outcome: HookOutcome): boolean {
  return blockReason(outcome) !== undefined;
}

function stateFile(name: string): string {
  return path.join(tmpDir, `cyberzavod-${name}-${SESSION}`);
}

async function breakCode(): Promise<void> {
  await writeFile(path.join(repo, "apps/broken"), "");
}

async function editCode(): Promise<void> {
  await writeFile(path.join(repo, "apps/main.ts"), "changed\n");
}

describe("gateStop", () => {
  beforeEach(async () => {
    workspace = await mkdtemp(path.join(tmpdir(), "cyberzavod-stop-"));
    repo = path.join(workspace, "repo");
    tmpDir = path.join(workspace, "tmp");
    await mkdir(tmpDir);
  });

  afterEach(async () => {
    await rm(workspace, { recursive: true, force: true });
  });

  it("красные проверки после правок агента держат остановку", async () => {
    await makeRepo();
    await startTurn(context());
    await breakCode();

    const outcome = await gateStop(context());

    expect({
      blocked: isBlocked(outcome),
      attempt: blockReason(outcome)?.includes("attempt 1 of 3"),
    }).toEqual({
      blocked: true,
      attempt: true,
    });
  });

  it("держит остановку решением block с кодом выхода 0", async () => {
    await makeRepo();
    await startTurn(context());
    await breakCode();

    const outcome = await gateStop(context());

    expect({ code: outcome.exitCode, stderr: outcome.stderr, blocked: isBlocked(outcome) }).toEqual(
      {
        code: 0,
        stderr: "",
        blocked: true,
      },
    );
  });

  it("говорит с агентом на языке сообщений хука", async () => {
    await makeRepo();
    await startTurn(context());
    await breakCode();

    const outcome = await gateStop(context(CLAUDE_MESSAGES.ru));

    expect(blockReason(outcome)).toContain(
      "не проходит — закончить работу нельзя (попытка 1 из 3)",
    );
  });

  it("показывает агенту вывод проверок", async () => {
    await makeRepo();
    await startTurn(context());
    await breakCode();

    const outcome = await gateStop(context());

    expect(blockReason(outcome)).toContain("ошибка типов в apps/broken");
  });

  it("после трёх отказов отпускает агента с сообщением и оставляет отметку", async () => {
    await makeRepo();
    await startTurn(context());
    await breakCode();

    const outcome = await stopTimes(4);

    expect({
      code: outcome?.exitCode,
      message: outcome?.stdout.includes("a human is needed"),
      marker: existsSync(stateFile("human-call")),
    }).toEqual({ code: RELEASED, message: true, marker: true });
  });

  it("без отметки агент отпускается с сообщением о ней", async () => {
    await makeRepo();
    await startTurn(context());
    await breakCode();
    await mkdir(stateFile("human-call"));

    const outcome = await stopTimes(4);

    expect(outcome?.stdout).toContain("The marker for the recording was not saved.");
  });

  it("не оставляет отметку, пока агента ещё возвращают к работе", async () => {
    await makeRepo();
    await startTurn(context());
    await breakCode();

    await stopTimes(3);

    expect(existsSync(stateFile("human-call"))).toBe(false);
  });

  it("зелёные проверки отпускают и завершают ход без отметки", async () => {
    await makeRepo();
    await startTurn(context());
    await editCode();

    const outcome = await gateStop(context());

    expect({
      code: outcome.exitCode,
      turnStart: existsSync(stateFile("turn-start")),
      marker: existsSync(stateFile("human-call")),
    }).toEqual({ code: RELEASED, turnStart: false, marker: false });
  });

  it("новый ход считает попытки заново", async () => {
    await makeRepo();
    await startTurn(context());
    await breakCode();
    await stopTimes(4);
    await startTurn(context());
    await editCode();

    const outcome = await gateStop(context());

    expect({
      blocked: isBlocked(outcome),
      attempt: blockReason(outcome)?.includes("attempt 1 of 3"),
    }).toEqual({
      blocked: true,
      attempt: true,
    });
  });

  it("работа до начала хода не держит агента", async () => {
    await makeRepo();
    await breakCode();
    await startTurn(context());

    const outcome = await gateStop(context());

    expect(outcome.exitCode).toBe(RELEASED);
  });

  it("закоммиченные в ходе правки тоже проверяются", async () => {
    await makeRepo();
    await startTurn(context());
    await breakCode();
    git("add", "-A");
    git("commit", "-qm", "change");

    const outcome = await gateStop(context());

    expect(isBlocked(outcome)).toBe(true);
  });

  it("сообщение посреди хода не сдвигает начало хода", async () => {
    await makeRepo();
    await startTurn(context());
    await breakCode();
    await startTurn(context());

    const outcome = await gateStop(context());

    expect(isBlocked(outcome)).toBe(true);
  });

  it("без отпечатка красные правки в коде держат остановку", async () => {
    await makeRepo();
    await breakCode();

    const outcome = await gateStop(context());

    expect(isBlocked(outcome)).toBe(true);
  });

  it("незаписываемый счётчик отпускает, а не зацикливает", async () => {
    await makeRepo();
    await startTurn(context());
    await breakCode();
    await mkdir(stateFile("stop-blocks"));

    const outcome = await gateStop(context());

    expect({ code: outcome.exitCode, message: outcome.stdout.includes("attempt counter") }).toEqual(
      {
        code: RELEASED,
        message: true,
      },
    );
  });

  it("запускает все команды из конфига по порядку и называет их в отказе", async () => {
    await makeRepo(configWith({ commands: ["touch first-ran", "touch second-ran && exit 1"] }));
    await startTurn(context());
    await editCode();

    const outcome = await gateStop(context());

    expect({
      blocked: isBlocked(outcome),
      first: existsSync(path.join(repo, "first-ran")),
      second: existsSync(path.join(repo, "second-ran")),
      named: blockReason(outcome)?.startsWith(
        "touch first-ran && touch second-ran && exit 1 fails",
      ),
    }).toEqual({ blocked: true, first: true, second: true, named: true });
  });

  it("правки вне paths не держат агента", async () => {
    await makeRepo(configWith({ commands: ["false"], paths: ["apps"] }));
    await startTurn(context());
    await mkdir(path.join(repo, "docs"));
    await writeFile(path.join(repo, "docs/note.md"), "changed\n");

    const outcome = await gateStop(context());

    expect(outcome.exitCode).toBe(RELEASED);
  });

  it("без paths проверяется весь репозиторий", async () => {
    await makeRepo(configWith({ commands: ["test ! -f broken"] }));
    await startTurn(context());
    await writeFile(path.join(repo, "broken"), "");

    const outcome = await gateStop(context());

    expect(isBlocked(outcome)).toBe(true);
  });

  it("без конфига агент отпускается молча", async () => {
    await makeRepo(NO_CONFIG);
    await breakCode();

    const outcome = await gateStop(context());

    expect(outcome).toEqual({ exitCode: RELEASED, stdout: "", stderr: "" });
  });

  it("без команд проверок агент отпускается молча", async () => {
    await makeRepo(configWith({ commands: [] }));
    await breakCode();

    const outcome = await gateStop(context());

    expect(outcome).toEqual({ exitCode: RELEASED, stdout: "", stderr: "" });
  });

  it("битый конфиг отпускает агента с сообщением", async () => {
    await makeRepo('{"verification": ');
    await breakCode();

    const outcome = await gateStop(context());

    expect({
      code: outcome.exitCode,
      message: (JSON.parse(outcome.stdout) as { systemMessage: string }).systemMessage,
    }).toMatchObject({ code: RELEASED, message: expect.stringContaining("project.json") });
  });
});

describe("startTurn", () => {
  beforeEach(async () => {
    workspace = await mkdtemp(path.join(tmpdir(), "cyberzavod-turn-"));
    repo = path.join(workspace, "repo");
    tmpDir = path.join(workspace, "tmp");
    await mkdir(tmpDir);
  });

  afterEach(async () => {
    await rm(workspace, { recursive: true, force: true });
  });

  it("запоминает отпечаток кода в начале хода", async () => {
    await makeRepo();

    await startTurn(context());

    expect(existsSync(stateFile("turn-start"))).toBe(true);
  });

  it.each([
    ["без конфига", NO_CONFIG],
    ["с битым конфигом", '{"verification": '],
    ["без команд проверок", configWith({ commands: [] })],
  ])("%s выходит без ошибки и без отпечатка", async (_case, config) => {
    await makeRepo(config);

    const outcome = await startTurn(context());

    expect({ code: outcome.exitCode, turnStart: existsSync(stateFile("turn-start")) }).toEqual({
      code: RELEASED,
      turnStart: false,
    });
  });
});
