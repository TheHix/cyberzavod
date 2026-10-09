// Disconnecting the adapter: remove from the project what the generator wrote, and nothing else.
// Its own untouched file is deleted, its own hand-edited file stays; only its own hooks and the
// deny rules the generator added itself leave the settings.

import { rm, rmdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { requireProject } from "../paths.ts";
import { MANIFEST_FILE } from "./manifest.ts";
import {
  SETTINGS_FILE,
  SettingsError,
  unparsedSettings,
  withoutAdapterSettings,
  type Settings,
} from "./settings.ts";
import {
  fileAt,
  generatedCandidates,
  ownershipOf,
  readManifest,
  readOptional,
  readSettings,
} from "./sync.ts";

const CLAUDE_DIRECTORY = ".claude";

/**
 * What happens to the Claude Code settings: there are none or the adapter is not in them
 * (`unchanged`), someone else's entries remain (`updated`), nothing remains (`removed`).
 */
export type SettingsOutcome = "unchanged" | "updated" | "removed";

/** What the adapter removes from the project: paths from the root with `/`. */
export interface DisconnectPlan {
  /** Generated files not touched by hand, the manifest included: they are deleted. */
  removed: string[];
  /** Generated but hand-edited files: they stay. */
  edited: string[];
  settings: SettingsOutcome;
}

/** What to disconnect and how: only view the plan or carry it out. */
export interface DisconnectOptions {
  /** Directory inside the project. */
  projectDirectory: string;
  /** Only draw up the plan without changing anything. */
  check?: boolean;
}

function settingsText(settings: Settings): string {
  return `${JSON.stringify(settings, null, 2)}\n`;
}

function isEmpty(settings: Settings): boolean {
  return Object.keys(settings).length === 0;
}

function cleanedSettings(settings: Settings, deny: readonly string[]): Settings {
  try {
    return withoutAdapterSettings(settings, deny);
  } catch (err) {
    if (err instanceof SettingsError) throw unparsedSettings(err);

    throw err;
  }
}

function settingsOutcomeOf(text: string | undefined, cleaned: Settings): SettingsOutcome {
  if (text === undefined) return "unchanged";
  if (isEmpty(cleaned)) return "removed";

  const isSame = JSON.stringify(JSON.parse(text)) === JSON.stringify(cleaned);

  return isSame ? "unchanged" : "updated";
}

// Removes emptied directories from the file upward, but not above `.claude/`: rmdir leaves alone a
// directory where something remains.
async function removeEmptyParents(root: string, file: string): Promise<void> {
  const boundary = fileAt(root, CLAUDE_DIRECTORY);
  const isInside = (directory: string) =>
    directory === boundary || directory.startsWith(`${boundary}${path.sep}`);
  let directory = path.dirname(file);

  while (isInside(directory)) {
    const isRemoved = await rmdir(directory).then(
      () => true,
      () => false,
    );

    if (!isRemoved) return;

    directory = path.dirname(directory);
  }
}

/**
 * Removes the adapter's files and settings from the project or, with `check`, only says what it
 * will remove. Hand-edited files, other hooks and deny rules, `AGENTS.md` and the journal stay.
 * @param {DisconnectOptions} options Project and mode.
 * @returns {Promise<DisconnectPlan>} What was or will be deleted, and what will stay.
 * @throws {Error} If there is no project.
 * @throws {Error} If the settings or the manifest cannot be parsed: then nothing changes.
 */
export async function disconnectClaude(options: DisconnectOptions): Promise<DisconnectPlan> {
  const project = await requireProject(options.projectDirectory);
  const { root } = project;
  const manifest = await readManifest(root);
  const settingsSource = await readOptional(fileAt(root, SETTINGS_FILE));
  const settings = cleanedSettings(await readSettings(root), manifest.deny);
  const candidates = await generatedCandidates(project, manifest);
  const owned = await Promise.all(
    candidates.map(async (file) => {
      const text = await readOptional(fileAt(root, file));

      return { path: file, ownership: ownershipOf(file, text, manifest) };
    }),
  );
  const generated = owned.filter(({ ownership }) => ownership === "generated");
  const manifestText = await readOptional(fileAt(root, MANIFEST_FILE));
  const removed = [
    ...generated.map((file) => file.path).sort(),
    ...(manifestText === undefined ? [] : [MANIFEST_FILE]),
  ];
  const plan: DisconnectPlan = {
    removed,
    edited: owned.filter(({ ownership }) => ownership === "edited").map((file) => file.path),
    settings: settingsOutcomeOf(settingsSource, settings),
  };

  if (options.check === true) return plan;

  await applyDisconnect(root, plan, settings);

  return plan;
}

async function applyDisconnect(
  root: string,
  plan: DisconnectPlan,
  settings: Settings,
): Promise<void> {
  const settingsPath = fileAt(root, SETTINGS_FILE);

  switch (plan.settings) {
    case "unchanged":
      break;
    case "updated":
      await writeFile(settingsPath, settingsText(settings));
      break;
    case "removed":
      await rm(settingsPath);
      await removeEmptyParents(root, settingsPath);
      break;
    default:
      return plan.settings satisfies never;
  }

  for (const file of plan.removed) {
    const target = fileAt(root, file);

    await rm(target);
    await removeEmptyParents(root, target);
  }
}
