// A temporary Codex project for the hook tests: a git repository with a Cyberzavod config.

import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { KIT_MESSAGES } from "@cyberzavod/adapter-kit";
import { PROJECT_CONFIG_FILE } from "@cyberzavod/storage";
import { CODEX_MESSAGES } from "../messages/catalog.ts";
import type { CodexHookContext } from "./context.ts";

/** The check fails while `apps/broken` exists. */
export const RED_WHEN_BROKEN =
  "test ! -f apps/broken || (echo 'type error in apps/broken'; exit 1)";

/** A project on disk: its root and a separate directory for the hook state between calls. */
export interface TestProject {
  workspace: string;
  root: string;
  tmpDir: string;
}

/** What goes into the project config of the test project. */
export interface TestProjectOptions {
  /** `verification` of the config; without it the config has none. */
  verification?: { commands: string[]; paths: string[] };
}

/**
 * Creates a git project with a committed config and one source file.
 * @param {TestProjectOptions} options What the config holds.
 * @returns {Promise<TestProject>} The project.
 */
export async function createTestProject(options: TestProjectOptions = {}): Promise<TestProject> {
  const workspace = await mkdtemp(path.join(tmpdir(), "cyberzavod-codex-hooks-"));
  const root = path.join(workspace, "lab");
  const tmpDir = path.join(workspace, "state");
  const config = {
    projectId: "lab",
    harness: "0.4.0",
    workflow: "default",
    journal: ".cyberzavod/journal",
    ...(options.verification === undefined ? {} : { verification: options.verification }),
  };

  await mkdir(path.join(root, "apps"), { recursive: true });
  await mkdir(path.join(root, path.dirname(PROJECT_CONFIG_FILE)), { recursive: true });
  await mkdir(tmpDir);
  await writeFile(path.join(root, "apps/main.ts"), "ok\n");
  await writeFile(path.join(root, PROJECT_CONFIG_FILE), JSON.stringify(config));

  git(root, "init", "-q");
  git(root, "add", "-A");
  git(root, "commit", "-qm", "init");

  return { workspace, root, tmpDir };
}

/**
 * Deletes the test project.
 * @param {TestProject} project The project from `createTestProject`.
 * @returns {Promise<void>} Resolves when it is gone.
 */
export async function removeTestProject(project: TestProject): Promise<void> {
  await rm(project.workspace, { recursive: true, force: true });
}

/**
 * Runs git in the directory with a fixed author.
 * @param {string} directory Working directory.
 * @param {string[]} args Arguments of git.
 */
export function git(directory: string, ...args: string[]): void {
  execFileSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", ...args], { cwd: directory });
}

/**
 * The hook call as the CLI makes it.
 * @param {TestProject} project The project the hook runs in.
 * @param {Record<string, unknown>} payload Event the hook receives on stdin.
 * @param {string} [directory] Directory the hook is called from; the project root by default.
 * @returns {CodexHookContext} The hook call.
 */
export function hookContext(
  project: TestProject,
  payload: Record<string, unknown>,
  directory = project.root,
): CodexHookContext {
  return {
    payload: JSON.stringify(payload),
    projectDirectory: directory,
    tmpDir: project.tmpDir,
    messages: KIT_MESSAGES.en,
    guardMessages: CODEX_MESSAGES.en.guard,
  };
}
