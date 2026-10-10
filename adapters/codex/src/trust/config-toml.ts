// Edits of the human's `config.toml` that record trust: the project is trusted, and its hooks are
// approved by hash. The file belongs to the human and may hold anything, so the edits are textual
// and line by line: comments, order and everything else stay as they are. A real TOML parser checks
// every result: if the file after the edit does not mean the file before plus the trust entries,
// nothing is written.

import { isDeepStrictEqual } from "node:util";
import { isObject } from "@cyberzavod/adapter-kit";
import { parse, TomlError } from "smol-toml";
import { tomlString } from "../generate/toml.ts";
import {
  eolOf,
  joinLines,
  keyLineIndex,
  scanLines,
  splitLines,
  tableAt,
  withLineRemoved,
  withLineSet,
  headerText,
  type Line,
} from "./toml-lines.ts";

/**
 * Mark on the trust line Cyberzavod adds: disconnect touches only a line with it. When the line
 * replaced another value, the mark names it: `# added by cyberzavod, was "untrusted"`.
 */
export const TRUST_MARK = "# added by cyberzavod";

// Values of `trust_level` worth keeping in the mark; anything else is not written back.
const KEPT_LEVEL = "[A-Za-z_-]+";

const PROJECTS = "projects";
const HOOKS = "hooks";
const STATE = "state";
const TRUST_LEVEL = "trust_level";
const TRUSTED_HASH = "trusted_hash";
const TRUSTED = "trusted";

/** One hook the human is asked to trust: where it stands and the hash of its handler. */
export interface HookTrustEntry {
  /** Key under `[hooks.state]`. */
  key: string;
  /** Hash of the handler: `sha256:<hex>`. */
  hash: string;
}

/** What to record or take back: the project and the hooks. */
export interface TrustEdit {
  /**
   * Key of the project under `[projects]`: its root with symlinks resolved. Without it only the
   * hooks are looked at.
   */
  projectKey?: string;
  hooks: readonly HookTrustEntry[];
}

/** What the config says about the project and the hooks of an edit. */
export interface TrustReading {
  /** The project's `trust_level` is `trusted`. */
  isProjectTrusted: boolean;
  /** The project's trust line carries `TRUST_MARK`: Cyberzavod added it. */
  isProjectMarked: boolean;
  /** The `trust_level` the marked line replaced, if the mark names one. */
  replacedLevel: string | undefined;
  /** Hooks whose key holds the same hash. */
  trustedHooks: HookTrustEntry[];
  /** Hooks with no entry or another hash. */
  untrustedHooks: HookTrustEntry[];
}

/**
 * Why a config could not be read or edited: `notParsed` (not TOML, with the reason),
 * `layoutUnsupported` (the entries sit in an inline table or a dotted key; `lines` are what the
 * human can add by hand), `editRejected` (the edit would have changed more than the trust entries).
 */
export type ConfigProblem =
  | { kind: "notParsed"; reason: string }
  | { kind: "layoutUnsupported"; lines: string }
  | { kind: "editRejected" };

/** The config cannot be read or edited safely; the file stays as it was. */
export class ConfigTomlError extends Error {
  readonly problem: ConfigProblem;

  /**
   * Error of reading or editing the config.
   * @param {ConfigProblem} problem What is wrong.
   * @param {ErrorOptions} [options] Cause of the error.
   */
  constructor(problem: ConfigProblem, options?: ErrorOptions) {
    super(`config.toml: ${problem.kind}`, options);
    this.problem = problem;
  }
}

function tomlOf(text: string): Record<string, unknown> {
  try {
    return parse(text);
  } catch (err) {
    if (err instanceof TomlError) {
      throw new ConfigTomlError({ kind: "notParsed", reason: err.message }, { cause: err });
    }

    throw err;
  }
}

function tableOfValue(root: unknown, path: readonly string[]): Record<string, unknown> | undefined {
  let current: unknown = root;

  for (const segment of path) {
    if (!isObject(current)) return undefined;

    current = current[segment];
  }

  return isObject(current) ? current : undefined;
}

function projectTable(config: unknown, projectKey: string) {
  return tableOfValue(config, [PROJECTS, projectKey]);
}

function projectSegmentsOf(edit: TrustEdit): string[] | undefined {
  return edit.projectKey === undefined ? undefined : [PROJECTS, edit.projectKey];
}

function projectLevelOf(config: unknown, projectSegments: readonly string[]): unknown {
  return tableOfValue(config, projectSegments)?.[TRUST_LEVEL];
}

function hookTable(config: unknown, key: string) {
  return tableOfValue(config, [HOOKS, STATE, key]);
}

/**
 * What the config text says about the project's trust and the hooks'.
 * @param {string} text Contents of the human's config; empty if there is no file.
 * @param {TrustEdit} edit Project and hooks to look for.
 * @returns {TrustReading} Whether the project is trusted and which hooks are.
 * @throws {ConfigTomlError} If the text is not TOML.
 */
export function trustReading(text: string, edit: TrustEdit): TrustReading {
  const config = tomlOf(text);
  const isHookTrusted = ({ key, hash }: HookTrustEntry) =>
    hookTable(config, key)?.[TRUSTED_HASH] === hash;
  const lines = splitLines(text);
  const scan = scanLines(lines);
  const { projectKey } = edit;
  const table = projectKey === undefined ? undefined : tableAt(scan, [PROJECTS, projectKey]);
  const at = table === undefined ? undefined : keyLineIndex(lines, scan, table, TRUST_LEVEL);
  const marked = at === undefined ? null : markedTrustLine(lines[at]?.text ?? "");

  return {
    isProjectTrusted:
      projectKey !== undefined && projectTable(config, projectKey)?.[TRUST_LEVEL] === TRUSTED,
    isProjectMarked: marked !== null,
    replacedLevel: marked?.[1],
    trustedHooks: edit.hooks.filter(isHookTrusted),
    untrustedHooks: edit.hooks.filter((entry) => !isHookTrusted(entry)),
  };
}

const MARKED_TRUST_LINE = new RegExp(
  `^\\s*${TRUST_LEVEL}\\s*=\\s*"${TRUSTED}"\\s*${TRUST_MARK}(?:, was "(${KEPT_LEVEL})")?\\s*$`,
);

// The regexp match if the line is a trust line Cyberzavod added; group 1 is the replaced level.
function markedTrustLine(text: string): RegExpExecArray | null {
  return MARKED_TRUST_LINE.exec(text);
}

function isMarkedTrustLine(text: string): boolean {
  return markedTrustLine(text) !== null;
}

const KEPT_LEVEL_PATTERN = new RegExp(`^${KEPT_LEVEL}$`);

// The line Cyberzavod writes; it keeps the level it replaces so that disconnect can restore it.
function ownTrustLine(replaced: unknown): string {
  const isKept = typeof replaced === "string" && KEPT_LEVEL_PATTERN.test(replaced);
  const was = isKept ? `, was "${replaced}"` : "";

  return `${TRUST_LEVEL} = "${TRUSTED}" ${TRUST_MARK}${was}`;
}

function ourHashLine(hash: string): (text: string) => boolean {
  const pattern = new RegExp(`^\\s*${TRUSTED_HASH}\\s*=\\s*["']${hash}["']`);

  return (text) => pattern.test(text);
}

/**
 * The lines a human adds to the config by hand when the file cannot be edited automatically.
 * @param {TrustEdit} edit Project and hooks.
 * @returns {string} TOML tables, without comments.
 */
export function trustLines(edit: TrustEdit): string {
  const project =
    edit.projectKey === undefined
      ? []
      : [`${headerText([PROJECTS, edit.projectKey])}\n${TRUST_LEVEL} = "${TRUSTED}"`];
  const hooks = edit.hooks.map(
    ({ key, hash }) => `${headerText([HOOKS, STATE, key])}\n${TRUSTED_HASH} = ${tomlString(hash)}`,
  );

  return [...project, ...hooks].join("\n\n");
}

function pruned(value: unknown): unknown {
  if (!isObject(value)) return value;

  const entries = Object.entries(value)
    .map(([key, child]) => [key, pruned(child)] as const)
    .filter(([, child]) => !(isObject(child) && Object.keys(child).length === 0));

  return Object.fromEntries(entries);
}

function withSetting(config: unknown, path: readonly string[], value: string): unknown {
  const [head, ...rest] = path;

  if (head === undefined) return value;

  const object = isObject(config) ? config : {};

  return { ...object, [head]: withSetting(object[head], rest, value) };
}

function withoutSetting(config: unknown, path: readonly string[]): unknown {
  const [head, ...rest] = path;

  if (head === undefined || !isObject(config)) return config;

  if (rest.length === 0) {
    return Object.fromEntries(Object.entries(config).filter(([k]) => k !== head));
  }

  return { ...config, [head]: withoutSetting(config[head], rest) };
}

// The edit must mean the file before it plus the intended change, and nothing else.
function verified(after: string, expected: unknown, edit: TrustEdit): string {
  let parsed: Record<string, unknown>;

  try {
    parsed = tomlOf(after);
  } catch (err) {
    if (err instanceof ConfigTomlError) {
      throw new ConfigTomlError(
        { kind: "layoutUnsupported", lines: trustLines(edit) },
        { cause: err },
      );
    }

    throw err;
  }

  if (!isDeepStrictEqual(pruned(parsed), pruned(expected))) {
    throw new ConfigTomlError({ kind: "editRejected" });
  }

  return after;
}

interface EditTarget {
  segments: string[];
  /** The table in the config as the parser sees it; undefined if the config has none. */
  defined: Record<string, unknown> | undefined;
}

// A table the parser sees but no header of its own shows lives in an inline table or a dotted key.
function requireEditableLayout(
  lines: readonly Line[],
  targets: readonly EditTarget[],
  edit: TrustEdit,
): void {
  const scan = scanLines(lines);
  const isHiddenInOtherLayout = targets.some(
    ({ segments, defined }) => defined !== undefined && tableAt(scan, segments) === undefined,
  );

  if (isHiddenInOtherLayout) {
    throw new ConfigTomlError({ kind: "layoutUnsupported", lines: trustLines(edit) });
  }
}

/**
 * The config with the project trusted and the hooks approved. A trust line that is missing or says
 * something else becomes `trust_level = "trusted"` with `TRUST_MARK`; hook entries are added or
 * their hash is replaced. Everything else, comments included, stays as it is.
 * @param {string} text Contents of the human's config; empty if there is no file.
 * @param {TrustEdit} edit Project and hooks to trust.
 * @returns {string} The new contents; the same text if there is nothing to add.
 * @throws {ConfigTomlError} If the text is not TOML, keeps the entries in a form that cannot be
 *   edited (an inline table, a dotted key), or the edit would change anything else.
 */
export function withTrust(text: string, edit: TrustEdit): string {
  const config = tomlOf(text);
  const lines = splitLines(text);
  const eol = eolOf(text);
  const reading = trustReading(text, edit);
  const projectSegments = reading.isProjectTrusted ? undefined : projectSegmentsOf(edit);
  const projectTargets: EditTarget[] =
    projectSegments === undefined
      ? []
      : [{ segments: projectSegments, defined: tableOfValue(config, projectSegments) }];
  const hookTargets = reading.untrustedHooks.map(({ key }) => ({
    segments: [HOOKS, STATE, key],
    defined: hookTable(config, key),
  }));

  requireEditableLayout(lines, [...projectTargets, ...hookTargets], edit);

  const withProject =
    projectSegments === undefined
      ? lines
      : withLineSet(
          lines,
          {
            segments: projectSegments,
            key: TRUST_LEVEL,
            line: ownTrustLine(projectLevelOf(config, projectSegments)),
          },
          eol,
        );
  const withHooks = reading.untrustedHooks.reduce(
    (current, { key, hash }) =>
      withLineSet(
        current,
        {
          segments: [HOOKS, STATE, key],
          key: TRUSTED_HASH,
          line: `${TRUSTED_HASH} = ${tomlString(hash)}`,
        },
        eol,
      ),
    withProject,
  );
  const expectedProject =
    projectSegments === undefined
      ? config
      : withSetting(config, [...projectSegments, TRUST_LEVEL], TRUSTED);
  const expected = reading.untrustedHooks.reduce(
    (current, { key, hash }) => withSetting(current, [HOOKS, STATE, key, TRUSTED_HASH], hash),
    expectedProject,
  );

  return verified(joinLines(withHooks), expected, edit);
}

// The line Cyberzavod added goes; if it replaced the human's level, that level comes back.
function withoutOwnTrustLine(
  lines: readonly Line[],
  projectSegments: readonly string[],
  replacedLevel: string | undefined,
  eol: string,
): Line[] {
  if (replacedLevel === undefined) {
    return withLineRemoved(lines, {
      segments: projectSegments,
      key: TRUST_LEVEL,
      isOurs: isMarkedTrustLine,
    });
  }

  const line = `${TRUST_LEVEL} = ${tomlString(replacedLevel)}`;

  return withLineSet(lines, { segments: projectSegments, key: TRUST_LEVEL, line }, eol);
}

function withProjectLevelRestored(
  config: unknown,
  projectSegments: readonly string[],
  replacedLevel: string | undefined,
): unknown {
  if (replacedLevel === undefined) return withoutSetting(config, [...projectSegments, TRUST_LEVEL]);

  return withSetting(config, [...projectSegments, TRUST_LEVEL], replacedLevel);
}

/**
 * The config without the trust Cyberzavod added: the project's trust line with `TRUST_MARK` and
 * the hook entries with the given key and hash; a level the trust line replaced comes back. Tables
 * left empty go too. Trust the human gave themselves stays.
 * @param {string} text Contents of the human's config.
 * @param {TrustEdit} edit Project and hooks to take back.
 * @returns {string} The new contents; the same text if there is nothing to take back.
 * @throws {ConfigTomlError} If the text is not TOML or the edit would change anything else.
 */
export function withoutTrust(text: string, edit: TrustEdit): string {
  const config = tomlOf(text);
  const lines = splitLines(text);
  const reading = trustReading(text, edit);
  const projectSegments = reading.isProjectMarked ? projectSegmentsOf(edit) : undefined;
  const withoutProject =
    projectSegments === undefined
      ? lines
      : withoutOwnTrustLine(lines, projectSegments, reading.replacedLevel, eolOf(text));
  const withoutHooks = reading.trustedHooks.reduce(
    (current, { key, hash }) =>
      withLineRemoved(current, {
        segments: [HOOKS, STATE, key],
        key: TRUSTED_HASH,
        isOurs: ourHashLine(hash),
      }),
    withoutProject,
  );
  const withoutProjectSetting =
    projectSegments === undefined
      ? config
      : withProjectLevelRestored(config, projectSegments, reading.replacedLevel);
  const expected = reading.trustedHooks.reduce(
    (current, { key }) => withoutSetting(current, [HOOKS, STATE, key, TRUSTED_HASH]),
    withoutProjectSetting,
  );

  return verified(joinLines(withoutHooks), expected, edit);
}
