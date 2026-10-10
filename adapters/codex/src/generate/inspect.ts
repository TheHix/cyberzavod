// Hooks in the project's `.codex/hooks.json`: reads the file and compares it with what the adapter
// installs. Writes nothing and needs no harness, so it suits connection diagnostics.

import {
  fileAt,
  KitError,
  parseSettings,
  readOptional,
  SettingsError,
  type HooksInspection,
} from "@cyberzavod/adapter-kit";
import { HOOKS_FILE, inspectHooksFile, unparsedHooks } from "./hooks-config.ts";

/** Hooks were read (`HooksInspection`) or `hooks.json` is unparsable (`unreadable`, `error`). */
export type HooksReading = HooksInspection | { kind: "unreadable"; error: KitError };

/**
 * Checks whether the project's `.codex/hooks.json` has the adapter hooks of the right version.
 * @param {string} projectRoot Project root.
 * @param {string} version Cyberzavod version from the project config.
 * @returns {Promise<HooksReading>} Hook state; no file: `missing`; the file is not JSON, not an
 *   object, or has `hooks` of the wrong shape: `unreadable` with an adapter error.
 * @throws {Error} If the file cannot be read for a reason other than "no file".
 */
export async function inspectCodexHooks(
  projectRoot: string,
  version: string,
): Promise<HooksReading> {
  const text = await readOptional(fileAt(projectRoot, HOOKS_FILE));

  if (text === undefined) return { kind: "missing" };

  try {
    return inspectHooksFile(parseSettings(text, HOOKS_FILE), version);
  } catch (err) {
    if (err instanceof KitError) return { kind: "unreadable", error: err };

    if (err instanceof SettingsError) return { kind: "unreadable", error: unparsedHooks(err) };

    throw err;
  }
}
