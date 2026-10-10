// `.env` guard: a PreToolUse hook that denies shell commands and patches which touch files with
// secrets, and patches which touch the raw session logs the capture hook writes. It is string
// matching, as a deny rule is: it does not run the command and does not parse the shell. A command
// that builds the file name from pieces gets past it.

import path from "node:path";
import {
  isObject,
  locateProject,
  SILENT_EXIT,
  stringField,
  captureDirectories,
  type HookOutcome,
} from "@cyberzavod/adapter-kit";
import { ProjectFileError } from "@cyberzavod/storage";
import { CODEX_AGENT, PATCH_TOOL, SHELL_TOOL } from "../generate/codex.ts";
import type { GuardMessages } from "../messages/codex-messages.ts";
import { patchPaths } from "../patch-paths.ts";
import type { CodexHookContext } from "./context.ts";

// `.env` itself, a variant (`.env.local`) or a glob that can match them (`.env*`, `.env?`,
// `.env[.]local`): the shell expands the glob before the file is opened.
const ENV_FILE_NAME = /^\.env(?:$|[.*?[])/;
// Everything that separates one word of a shell command from the next, or wraps it: spaces,
// operators, redirections, quotes, substitutions, assignments, braces and `:` as in `git show
// HEAD:.env`.
const SHELL_WORD_SEPARATORS = /[\s;&|<>()`"'=,:{}]+/;

// `**/.env` and `**/.env.*`: the file itself and its variants, wherever it lies. `.envrc` and
// `env.ts` are other files. A glob that starts the same way is caught too; one that hides the
// start (`.en?`, `.[e]nv`) is not: telling it from other names needs the file system.
function isEnvFile(file: string): boolean {
  const name = file.split("/").pop() ?? "";

  return ENV_FILE_NAME.test(name);
}

function envFileIn(files: readonly string[]): string | undefined {
  return files.find(isEnvFile);
}

function wordsOf(command: string): string[] {
  return command.split(SHELL_WORD_SEPARATORS).filter((word) => word !== "");
}

function isInside(file: string, directory: string): boolean {
  const relative = path.relative(directory, file);

  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}

// The journal comes from the project config; a broken config leaves the guard with the `.env` rule
// only, because the agent must still be able to work.
async function rawLogDirectory(projectDirectory: string): Promise<string | undefined> {
  try {
    const project = await locateProject(projectDirectory);

    return project === undefined ? undefined : captureDirectories(project.journal, CODEX_AGENT).raw;
  } catch (err) {
    if (err instanceof ProjectFileError) return undefined;

    throw err;
  }
}

async function rawLogIn(
  files: readonly string[],
  call: { cwd: string; projectDirectory: string },
): Promise<string | undefined> {
  const directory = await rawLogDirectory(call.projectDirectory);

  if (directory === undefined) return undefined;

  return files.find((file) => isInside(path.resolve(call.cwd, file), directory));
}

function denial(reason: string): HookOutcome {
  const decision = {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: reason,
    },
  };

  return { exitCode: 0, stdout: `${JSON.stringify(decision)}\n`, stderr: "" };
}

async function denyPatch(
  patch: string,
  context: CodexHookContext,
  cwd: string,
): Promise<HookOutcome> {
  const { guardMessages, projectDirectory } = context;
  const files = patchPaths(patch);
  const secretFile = envFileIn(files);

  if (secretFile !== undefined) return denial(guardMessages.secretFile(secretFile));

  const rawLog = await rawLogIn(files, { cwd, projectDirectory });

  return rawLog === undefined ? SILENT_EXIT : denial(guardMessages.rawLog(rawLog));
}

function denyCommand(command: string, guardMessages: GuardMessages): HookOutcome {
  const secretFile = envFileIn(wordsOf(command));

  return secretFile === undefined ? SILENT_EXIT : denial(guardMessages.secretFile(secretFile));
}

/**
 * Denies a tool call that touches a file with secrets or a raw session log. Calls of other tools
 * and calls that touch neither pass.
 * @param {CodexHookContext} context Hook call.
 * @returns {Promise<HookOutcome>} A denial for Codex, or a silent exit.
 * @throws {SyntaxError} If the payload is not JSON.
 */
export async function guardSecrets(context: CodexHookContext): Promise<HookOutcome> {
  const payload: unknown = JSON.parse(context.payload);

  if (!isObject(payload) || !isObject(payload.tool_input)) return SILENT_EXIT;

  const text = stringField(payload.tool_input, "command");

  if (text === undefined) return SILENT_EXIT;

  switch (stringField(payload, "tool_name")) {
    case SHELL_TOOL:
      return denyCommand(text, context.guardMessages);
    case PATCH_TOOL:
      return denyPatch(text, context, stringField(payload, "cwd") ?? context.projectDirectory);
    default:
      return SILENT_EXIT;
  }
}
