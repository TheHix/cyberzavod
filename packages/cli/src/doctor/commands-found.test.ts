import { describe, expect, it, vi } from "vitest";
import { commandsFoundCheck } from "./commands-found.ts";
import { connectedProject, projectContext } from "./fixtures.ts";

describe("commandsFoundCheck", () => {
  it("находит программы команд, не запуская их, и говорит об этом", async () => {
    const project = await connectedProject(["make check", "CI=1 pnpm test", "make lint"]);
    const runCommand = vi.fn();

    const result = await commandsFoundCheck.run(await projectContext(project, { runCommand }));

    expect({ result, started: runCommand.mock.calls.length }).toEqual({
      result: {
        status: "passed",
        summary:
          "programs make, pnpm found; the commands were not run — npx cyberzavod doctor --run-checks",
      },
      started: 0,
    });
  });

  it("ищет слово от корня проекта", async () => {
    const project = await connectedProject(["./scripts/check.sh"]);
    const isProgramAvailable = vi.fn(async () => true);

    await commandsFoundCheck.run(await projectContext(project, { isProgramAvailable }));

    expect(isProgramAvailable).toHaveBeenCalledWith("./scripts/check.sh", project.root);
  });

  it("называет программы, которых нет, и подсказывает про встроенные команды оболочки", async () => {
    const project = await connectedProject(["cd web && pnpm test", "make check"]);
    const context = await projectContext(project, {
      isProgramAvailable: async (word) => word === "make",
    });

    const result = await commandsFoundCheck.run(context);

    expect(result).toEqual({
      status: "failed",
      problem: "check programs not found: cd",
      fix: "install the programs or correct the commands in .cyberzavod/project.json; a command that starts with a shell builtin (cd web && …) is not recognised: wrap it in a make target or a script, or run npx cyberzavod doctor --run-checks",
    });
  });

  it("без команд просит /setup или правку конфига", async () => {
    const project = await connectedProject([]);

    const result = await commandsFoundCheck.run(await projectContext(project));

    expect(result).toEqual({
      status: "failed",
      problem: "no check commands are set in .cyberzavod/project.json",
      fix: "run /setup in Claude Code or add the commands to .cyberzavod/project.json",
    });
  });
});
