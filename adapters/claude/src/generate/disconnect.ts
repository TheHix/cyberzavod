// Отключение адаптера: убрать из проекта то, что записал генератор, и ничего больше. Свой
// нетронутый файл удаляется, свой, но исправленный руками, остаётся; из настроек уходят только
// свои хуки и запреты, которые генератор дописал сам.

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
 * Что станет с настройками Claude Code: их нет или адаптера в них нет (`unchanged`), в них
 * остаётся чужое (`updated`), в них не остаётся ничего (`removed`).
 */
export type SettingsOutcome = "unchanged" | "updated" | "removed";

/** Что адаптер убирает из проекта: пути от корня через `/`. */
export interface DisconnectPlan {
  /** Сгенерированные и не тронутые руками файлы, в том числе манифест: они удаляются. */
  removed: string[];
  /** Сгенерированные, но исправленные руками файлы: они остаются. */
  edited: string[];
  settings: SettingsOutcome;
}

/** Что отключить и как: только посмотреть план или выполнить его. */
export interface DisconnectOptions {
  /** Каталог внутри проекта. */
  projectDirectory: string;
  /** Только составить план, ничего не меняя. */
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

// Удаляет опустевшие каталоги от файла вверх, но не выше `.claude/`: rmdir не трогает каталог,
// где что-то осталось.
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
 * Убирает из проекта файлы и настройки адаптера или, с `check`, только говорит, что уберёт.
 * Исправленные руками файлы, чужие хуки и запреты, `AGENTS.md` и журнал остаются.
 * @param {DisconnectOptions} options Проект и режим.
 * @returns {Promise<DisconnectPlan>} Что удалено или будет удалено и что останется.
 * @throws {Error} Если проекта нет.
 * @throws {Error} Если настройки или манифест не разобраны: тогда ничего не меняется.
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
