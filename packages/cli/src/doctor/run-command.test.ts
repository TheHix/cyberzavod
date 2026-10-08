import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runCommandInShell } from "./run-command.ts";

let root: string;

describe("runCommandInShell", () => {
  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), "cyberzavod-run-"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("возвращает код выхода команды", () => {
    const run = runCommandInShell('node -e "process.exit(3)"', root);

    expect(run).toEqual({ kind: "exited", code: 3 });
  });

  it("запускает команду в корне проекта", async () => {
    await writeFile(path.join(root, "marker.txt"), "");

    const run = runCommandInShell("node -e \"require('node:fs').accessSync('marker.txt')\"", root);

    expect(run).toEqual({ kind: "exited", code: 0 });
  });

  it("сообщает, что команда не стартовала, если корня нет", () => {
    const run = runCommandInShell("node --version", path.join(root, "missing"));

    expect(run.kind).toBe("notStarted");
  });
});
