import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isProgramAvailable, programOf } from "./programs.ts";

const isWindows = process.platform === "win32";
const EXECUTABLE_MODE = 0o755;
const PLAIN_FILE_MODE = 0o644;

let workspace: string;

async function writeProgram(relative: string, mode: number): Promise<void> {
  const file = path.join(workspace, relative);

  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, "#!/bin/sh\n");
  await chmod(file, mode);
}

describe("programOf", () => {
  it.each([
    ["make check", "make"],
    ["CI=1 pnpm test", "pnpm"],
    ['A=1 B="x y" pnpm test', "pnpm"],
    ["./scripts/check.sh --all", "./scripts/check.sh"],
    ['"./my scripts/check.sh" --all', "./my scripts/check.sh"],
    ["cd web && pnpm test", "cd"],
    ["", undefined],
    ["CI=1", undefined],
  ])("в команде %j находит программу %j", (command, expected) => {
    const program = programOf(command);

    expect(program).toBe(expected);
  });
});

describe("isProgramAvailable", () => {
  beforeEach(async () => {
    workspace = await mkdtemp(path.join(tmpdir(), "cyberzavod-programs-"));
  });

  afterEach(async () => {
    await rm(workspace, { recursive: true, force: true });
  });

  it.skipIf(isWindows)("находит исполняемый файл в PATH", async () => {
    await writeProgram("bin/tool", EXECUTABLE_MODE);

    const isFound = await isProgramAvailable({
      name: "tool",
      root: workspace,
      env: { PATH: `/nowhere:${path.join(workspace, "bin")}` },
      platform: "linux",
    });

    expect(isFound).toBe(true);
  });

  it.skipIf(isWindows)("не принимает за программу неисполняемый файл", async () => {
    await writeProgram("bin/tool", PLAIN_FILE_MODE);

    const isFound = await isProgramAvailable({
      name: "tool",
      root: workspace,
      env: { PATH: path.join(workspace, "bin") },
      platform: "linux",
    });

    expect(isFound).toBe(false);
  });

  it("не находит программу, которой нет в PATH", async () => {
    const isFound = await isProgramAvailable({
      name: "tool",
      root: workspace,
      env: { PATH: path.join(workspace, "bin") },
      platform: "linux",
    });

    expect(isFound).toBe(false);
  });

  it("не находит программу без PATH", async () => {
    const isFound = await isProgramAvailable({
      name: "tool",
      root: workspace,
      env: {},
      platform: "linux",
    });

    expect(isFound).toBe(false);
  });

  it.skipIf(isWindows)("ищет слово со слэшем от корня проекта, а не в PATH", async () => {
    await writeProgram("scripts/check.sh", EXECUTABLE_MODE);

    const isFound = await isProgramAvailable({
      name: "./scripts/check.sh",
      root: workspace,
      env: {},
      platform: "linux",
    });

    expect(isFound).toBe(true);
  });

  it("не принимает каталог за программу", async () => {
    await mkdir(path.join(workspace, "scripts"));

    const isFound = await isProgramAvailable({
      name: "./scripts",
      root: workspace,
      env: {},
      platform: "linux",
    });

    expect(isFound).toBe(false);
  });

  it("на Windows подбирает расширение из PATHEXT", async () => {
    await writeProgram("bin/tool.CMD", PLAIN_FILE_MODE);

    const isFound = await isProgramAvailable({
      name: "tool",
      root: workspace,
      env: { PATH: path.join(workspace, "bin"), PATHEXT: ".EXE;.CMD" },
      platform: "win32",
    });

    expect(isFound).toBe(true);
  });

  it("на Windows без PATHEXT берёт расширения по умолчанию", async () => {
    await writeProgram("bin/tool.EXE", PLAIN_FILE_MODE);

    const isFound = await isProgramAvailable({
      name: "tool",
      root: workspace,
      env: { Path: path.join(workspace, "bin") },
      platform: "win32",
    });

    expect(isFound).toBe(true);
  });
});
