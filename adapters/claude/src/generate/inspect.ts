// Hooks in the project's `.claude/settings.json`: reads the file and compares it with what the
// adapter installs. Writes nothing and needs no harness, so it suits connection diagnostics.

import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  KitError,
  parseSettings,
  SettingsError,
  type HooksInspection,
} from "@cyberzavod/adapter-kit";
import { isNotFound } from "@cyberzavod/storage";
import { inspectHooks, SETTINGS_FILE, unparsedSettings } from "./settings.ts";

/** Hooks were read (`HooksInspection`) or `settings.json` is unparsable (`unreadable`, `error`). */
export type HooksReading = HooksInspection | { kind: "unreadable"; error: KitError };

async function readSettingsText(projectRoot: string): Promise<string | undefined> {
  try {
    return await readFile(path.join(projectRoot, SETTINGS_FILE), "utf8");
  } catch (err) {
    if (isNotFound(err)) return undefined;

    throw err;
  }
}

/**
 * Checks whether the project's `.claude/settings.json` has the adapter hooks of the right version.
 * @param {string} projectRoot Project root.
 * @param {string} version Cyberzavod version from the project config.
 * @returns {Promise<HooksReading>} Hook state; no file: `missing`; the file is not JSON, not an
 *   object, or has `hooks` of the wrong shape: `unreadable` with an adapter error.
 * @throws {Error} If the file cannot be read for a reason other than "no file".
 */
export async function inspectClaudeHooks(
  projectRoot: string,
  version: string,
): Promise<HooksReading> {
  const text = await readSettingsText(projectRoot);

  if (text === undefined) return { kind: "missing" };

  try {
    return inspectHooks(parseSettings(text, SETTINGS_FILE), version);
  } catch (err) {
    if (err instanceof KitError) return { kind: "unreadable", error: err };

    if (err instanceof SettingsError) return { kind: "unreadable", error: unparsedSettings(err) };

    throw err;
  }
}
