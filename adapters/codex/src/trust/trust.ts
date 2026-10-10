// Trust of the project and its hooks in the human's Codex config. Codex runs a project's hooks only
// when the config says the project is trusted and holds the hash of each hook. This module reads
// and edits that one file, and only the trust entries in it. Every edit is planned first: a config
// that cannot be edited safely stops the command before anything is written.

import { randomUUID } from "node:crypto";
import { chmod, mkdir, realpath, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileAt, KitError, readOptional, SettingsError } from "@cyberzavod/adapter-kit";
import { CodexError } from "../errors.ts";
import { HOOKS_FILE, unparsedHooks } from "../generate/hooks-config.ts";
import { hooksFileText, readHooksFile } from "../generate/sync.ts";
import { codexConfigFile, type CodexHomeSource } from "./codex-home.ts";
import {
  ConfigTomlError,
  trustReading,
  withoutTrust,
  withTrust,
  type HookTrustEntry,
  type TrustEdit,
} from "./config-toml.ts";
import { ownHookTrust, type HookEvent, type HookTrust } from "./hook-trust.ts";

const HOME_ALIAS = "~";

/** Where the project is and which Cyberzavod version's hooks it has. */
export interface TrustTarget {
  /** Project root. */
  root: string;
  /** Cyberzavod version from the project config. */
  version: string;
}

/**
 * What changes in the human's config: the project's trust (`project`) or the approval of the
 * adapter's hooks (`hooks`). `file` is the config as shown to the human.
 */
export interface TrustChange {
  kind: "project" | "hooks";
  file: string;
}

/** An edit of the human's config, planned and checked, not yet written. */
export interface TrustPlan {
  /** What the edit adds or takes away. */
  changes: TrustChange[];
  /** Config in which the project's trust stays because the human, not Cyberzavod, gave it. */
  keptProjectTrustFile: string | undefined;
  /** Writes the edit; does nothing if `changes` is empty. */
  apply(): Promise<void>;
}

/** What the human's config says about the project and its hooks. */
export type TrustInspection =
  | { kind: "trusted"; file: string }
  | { kind: "projectUntrusted"; file: string; projectKey: string }
  | { kind: "hooksUntrusted"; events: HookEvent[]; file: string }
  | { kind: "unreadable"; error: CodexError | KitError };

/** Result of an action wrapped in `carryOverTrust`: its value and the config change, if any. */
export interface CarriedOver<T> {
  value: T;
  /** The hooks' approval moved to the new hooks; undefined if there was nothing to move. */
  change: TrustChange | undefined;
}

interface ConfigState {
  /** Absolute path of the config as shown to the human. */
  displayFile: string;
  /** Where the config is written: the file itself, symlinks resolved. */
  file: string;
  text: string;
  exists: boolean;
}

function displayed(file: string, homeDirectory: string): string {
  const relative = path.relative(homeDirectory, file);
  const isInHome = relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);

  return isInHome ? `${HOME_ALIAS}/${relative.split(path.sep).join("/")}` : file;
}

async function resolvedPath(file: string): Promise<string> {
  try {
    return await realpath(file);
  } catch {
    return file;
  }
}

async function readConfig(source: CodexHomeSource): Promise<ConfigState> {
  const configFile = codexConfigFile(source);
  const text = await readOptional(configFile);

  return {
    displayFile: displayed(configFile, source.homeDirectory),
    file: await resolvedPath(configFile),
    text: text ?? "",
    exists: text !== undefined,
  };
}

// The new content is written to a file beside the config and renamed over it, so the config is
// never half written; the permissions of the old file carry over.
async function writeAtomically(file: string, text: string): Promise<void> {
  const directory = path.dirname(file);
  const temporary = path.join(directory, `.${path.basename(file)}.${randomUUID()}.tmp`);
  const mode = await stat(file).then(
    (info) => info.mode,
    () => undefined,
  );

  await mkdir(directory, { recursive: true });
  await writeFile(temporary, text, "utf8");

  if (mode !== undefined) await chmod(temporary, mode);

  await rename(temporary, file);
}

function codexErrorOf(err: ConfigTomlError, displayFile: string): CodexError {
  const { problem } = err;

  switch (problem.kind) {
    case "notParsed":
      return new CodexError(
        (messages) =>
          messages.errors.configNotParsed({ file: displayFile, reason: problem.reason }),
        { cause: err },
      );
    case "layoutUnsupported":
      return new CodexError(
        (messages) =>
          messages.errors.configLayoutUnsupported({ file: displayFile, lines: problem.lines }),
        { cause: err },
      );
    case "editRejected":
      return new CodexError((messages) => messages.errors.configEditRejected(displayFile), {
        cause: err,
      });
  }
}

function inConfig<T>(config: ConfigState, action: () => T): T {
  try {
    return action();
  } catch (err) {
    if (err instanceof ConfigTomlError) throw codexErrorOf(err, config.displayFile);

    throw err;
  }
}

function entriesOf(trusts: readonly HookTrust[]): HookTrustEntry[] {
  return trusts.map(({ key, hash }) => ({ key, hash }));
}

async function projectKeyOf(root: string): Promise<string> {
  return realpath(root);
}

function ownTrustOf(projectKey: string, hooksText: string): HookTrust[] {
  try {
    return ownHookTrust(projectKey, hooksText);
  } catch (err) {
    if (err instanceof SettingsError) throw unparsedHooks(err);

    throw err;
  }
}

// The adapter's own handlers as they stand in the project's hooks file now.
async function currentHookTrust(root: string): Promise<HookTrust[]> {
  const text = await readOptional(fileAt(root, HOOKS_FILE));

  return text === undefined ? [] : ownTrustOf(await projectKeyOf(root), text);
}

// The adapter's own handlers as they will stand after sync.
async function expectedHookTrust(target: TrustTarget): Promise<HookTrust[]> {
  const settings = await readHooksFile(target.root);
  const text = hooksFileText(settings, target.version);

  return ownTrustOf(await projectKeyOf(target.root), text);
}

function plannedWrite(config: ConfigState, after: string, before: string) {
  return async () => {
    if (after !== before) await writeAtomically(config.file, after);
  };
}

/**
 * Plans trusting the project and approving the adapter's hooks as they will be after sync. What
 * the human already trusts is left alone.
 * @param {CodexHomeSource} source Environment and home directory, which tell where the config is.
 * @param {TrustTarget} target Project and Cyberzavod version.
 * @returns {Promise<TrustPlan>} What will be added, and how to write it.
 * @throws {CodexError} If the config is not TOML or cannot be edited safely.
 * @throws {KitError} If the project's hooks file cannot be parsed.
 */
export async function planConnectTrust(
  source: CodexHomeSource,
  target: TrustTarget,
): Promise<TrustPlan> {
  const config = await readConfig(source);
  const edit: TrustEdit = {
    projectKey: await projectKeyOf(target.root),
    hooks: entriesOf(await expectedHookTrust(target)),
  };
  const reading = inConfig(config, () => trustReading(config.text, edit));
  const after = inConfig(config, () => withTrust(config.text, edit));
  const changes: TrustChange[] = [
    ...(reading.isProjectTrusted ? [] : [{ kind: "project" as const, file: config.displayFile }]),
    ...(reading.untrustedHooks.length === 0
      ? []
      : [{ kind: "hooks" as const, file: config.displayFile }]),
  ];

  return {
    changes,
    keptProjectTrustFile: undefined,
    apply: plannedWrite(config, after, config.text),
  };
}

function isSameHandler(left: HookTrust, right: HookTrust): boolean {
  return left.event === right.event && left.name === right.name;
}

/**
 * Runs an action that rewrites the project's hooks file (sync) and carries the human's approval
 * over to the new handlers: a new handler is approved only if the earlier handler of the same event
 * and hook was approved. Approval the human never gave, or took back, is not made up, and the
 * approvals of replaced handlers are taken back.
 * @param {CodexHomeSource} source Environment and home directory, which tell where the config is.
 * @param {string} root Project root.
 * @param {() => Promise<T>} action What rewrites the files; runs exactly once.
 * @returns {Promise<CarriedOver<T>>} The action's value and the change in the config, if any.
 * @throws {CodexError} If the config is not TOML or cannot be edited safely; the action has run.
 */
export async function carryOverTrust<T>(
  source: CodexHomeSource,
  root: string,
  action: () => Promise<T>,
): Promise<CarriedOver<T>> {
  const before = await currentHookTrust(root);
  const value = await action();

  if (before.length === 0) return { value, change: undefined };

  const config = await readConfig(source);
  const earlier = inConfig(config, () => trustReading(config.text, { hooks: entriesOf(before) }));
  const approvedKeys = new Set(earlier.trustedHooks.map(({ key }) => key));
  const approvedBefore = before.filter(({ key }) => approvedKeys.has(key));

  if (approvedBefore.length === 0) return { value, change: undefined };

  const after = await currentHookTrust(root);
  const carried = after.filter((handler) =>
    approvedBefore.some((approved) => isSameHandler(approved, handler)),
  );
  const stale = earlier.trustedHooks.filter(
    (entry) => !after.some(({ key, hash }) => key === entry.key && hash === entry.hash),
  );
  const withoutStale = inConfig(config, () => withoutTrust(config.text, { hooks: stale }));
  const text = inConfig(config, () => withTrust(withoutStale, { hooks: entriesOf(carried) }));

  if (text === config.text) return { value, change: undefined };

  await writeAtomically(config.file, text);

  return { value, change: { kind: "hooks", file: config.displayFile } };
}

/**
 * Checks the human's config against the project: is the project trusted and are the adapter's
 * hooks approved. Writes nothing.
 * @param {CodexHomeSource} source Environment and home directory, which tell where the config is.
 * @param {string} root Project root.
 * @returns {Promise<TrustInspection>} What is missing, or that all is in place.
 */
export async function inspectTrust(
  source: CodexHomeSource,
  root: string,
): Promise<TrustInspection> {
  const config = await readConfig(source);
  const projectKey = await projectKeyOf(root);

  try {
    const ownHooks = await currentHookTrust(root);
    const edit: TrustEdit = { projectKey, hooks: entriesOf(ownHooks) };
    const reading = trustReading(config.text, edit);

    if (!reading.isProjectTrusted) {
      return { kind: "projectUntrusted", file: config.displayFile, projectKey };
    }

    if (reading.untrustedHooks.length === 0) return { kind: "trusted", file: config.displayFile };

    const untrusted = new Set(reading.untrustedHooks.map(({ key }) => key));
    const events = ownHooks.filter(({ key }) => untrusted.has(key)).map(({ event }) => event);

    return { kind: "hooksUntrusted", events: [...new Set(events)], file: config.displayFile };
  } catch (err) {
    if (err instanceof ConfigTomlError) {
      return { kind: "unreadable", error: codexErrorOf(err, config.displayFile) };
    }

    if (err instanceof KitError) return { kind: "unreadable", error: err };

    throw err;
  }
}

/**
 * Plans taking back what Cyberzavod added to the human's config: the project's trust line with
 * its mark and the approvals of the adapter's hooks as they stand in the project now. Trust the
 * human gave themselves stays.
 * @param {CodexHomeSource} source Environment and home directory, which tell where the config is.
 * @param {string} root Project root.
 * @returns {Promise<TrustPlan>} What will be removed and what stays, and how to write it.
 * @throws {CodexError} If the config is not TOML or cannot be edited safely.
 * @throws {KitError} If the project's hooks file cannot be parsed.
 */
export async function planDisconnectTrust(
  source: CodexHomeSource,
  root: string,
): Promise<TrustPlan> {
  const config = await readConfig(source);

  if (!config.exists) {
    return { changes: [], keptProjectTrustFile: undefined, apply: async () => undefined };
  }

  const edit: TrustEdit = {
    projectKey: await projectKeyOf(root),
    hooks: entriesOf(await currentHookTrust(root)),
  };
  const reading = inConfig(config, () => trustReading(config.text, edit));
  const after = inConfig(config, () => withoutTrust(config.text, edit));
  const changes: TrustChange[] = [
    ...(reading.isProjectMarked ? [{ kind: "project" as const, file: config.displayFile }] : []),
    ...(reading.trustedHooks.length === 0
      ? []
      : [{ kind: "hooks" as const, file: config.displayFile }]),
  ];
  const isTrustTheHumans = reading.isProjectTrusted && !reading.isProjectMarked;

  return {
    changes,
    keptProjectTrustFile: isTrustTheHumans ? config.displayFile : undefined,
    apply: plannedWrite(config, after, config.text),
  };
}
