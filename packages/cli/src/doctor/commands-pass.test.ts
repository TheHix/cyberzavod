import { describe, expect, it, vi } from "vitest";
import type { CommandRun } from "./check.ts";
import { commandsPassCheck } from "./commands-pass.ts";
import { CLI_MESSAGES } from "../messages/catalog.ts";
import { connectedProject, projectContext } from "./fixtures.ts";

describe("commandsPassCheck", () => {
  it("запускает каждую команду по отдельности в корне проекта", async () => {
    const project = await connectedProject(["make lint", "make test"]);
    const runCommand = vi.fn((): CommandRun => ({ kind: "exited", code: 0 }));

    const result = await commandsPassCheck.run(await projectContext(project, { runCommand }));

    expect({ result, calls: runCommand.mock.calls }).toEqual({
      result: { status: "passed", summary: "check commands pass: 2" },
      calls: [
        ["make lint", project.root],
        ["make test", project.root],
      ],
    });
  });

  it("называет упавшую команду и просит запустить её самому", async () => {
    const project = await connectedProject(["make lint", "make test"]);
    const runCommand = (command: string): CommandRun =>
      command === "make test" ? { kind: "exited", code: 3 } : { kind: "exited", code: 0 };

    const result = await commandsPassCheck.run(await projectContext(project, { runCommand }));

    expect(result).toEqual({
      status: "failed",
      problem: "check commands failed: “make test” (exit 3)",
      fix: "run “make test” yourself and read the error",
    });
  });

  it("по-русски берёт кавычки и слова из каталога", async () => {
    const project = await connectedProject(["make test"]);
    const runCommand = (): CommandRun => ({ kind: "exited", code: 3 });
    const context = await projectContext(project, { runCommand, messages: CLI_MESSAGES.ru });

    const result = await commandsPassCheck.run(context);

    expect(result).toEqual({
      status: "failed",
      problem: "команды проверок не прошли: «make test» (код выхода 3)",
      fix: "запустите «make test» сами и посмотрите ошибку",
    });
  });

  it("называет причину, если команда не запустилась", async () => {
    const project = await connectedProject(["make test"]);
    const runCommand = (): CommandRun => ({ kind: "notStarted", reason: "spawn ENOENT" });

    const result = await commandsPassCheck.run(await projectContext(project, { runCommand }));

    expect(result).toEqual({
      status: "failed",
      problem: "check commands failed: “make test” (not started: spawn ENOENT)",
      fix: "run “make test” yourself and read the error",
    });
  });

  it("без команд просит /setup или правку конфига", async () => {
    const project = await connectedProject([]);

    const result = await commandsPassCheck.run(await projectContext(project));

    expect(result).toMatchObject({
      status: "failed",
      fix: "run /setup in Claude Code or add the commands to .cyberzavod/project.json",
    });
  });
});
