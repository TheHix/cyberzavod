// Запущенная версия Cyberzavod: версия, harness, шаблоны и собранный CLI, который команды кладут
// в проект.

import type { ClaudeTemplates } from "@cyberzavod/adapter-claude";
import { parseHarness, type Harness, type HarnessError } from "@cyberzavod/core";
import { CommandError } from "../errors.ts";
import { readAssets } from "./assets.ts";

/** Версия Cyberzavod: её ставит в конфиг проекта этот CLI, она же — версия npm-пакета. */
export const HARNESS_VERSION = "0.6.0";

const RULES_TEMPLATE = "rules.md";

/** Запущенная версия Cyberzavod. */
export interface Installation {
  harness: Harness;
  /** Заготовка AGENTS.md нового проекта. */
  rulesTemplate: string;
  claudeTemplates: ClaudeTemplates;
  /** Текст собранного CLI; undefined — CLI запущен из исходников. */
  tool: string | undefined;
}

function template(templates: Readonly<Record<string, string>>, name: string): string {
  const text = templates[name];

  if (text === undefined) throw new Error(`в установке нет шаблона ${name}`);

  return text;
}

/**
 * Читает запущенную версию Cyberzavod.
 * @returns {Promise<Installation>} Harness, шаблоны и собранный CLI.
 * @throws {HarnessError} Если harness установки не прошёл проверку.
 */
export async function readInstallation(): Promise<Installation> {
  const { harness, templates, tool } = await readAssets();

  return {
    harness: parseHarness(harness),
    rulesTemplate: template(templates, RULES_TEMPLATE),
    claudeTemplates: {
      publishRecording: template(templates, "publish-recording.md"),
      recordingEditor: template(templates, "recording-editor.md"),
    },
    tool,
  };
}

/**
 * Собранный CLI, который кладут в проект: без него хукам нечего запускать.
 * @param {Installation} installation Запущенная версия.
 * @returns {string} Текст собранного CLI.
 * @throws {CommandError} Если CLI запущен из исходников.
 */
export function toolOf(installation: Installation): string {
  if (installation.tool === undefined) {
    throw new CommandError(
      "CLI запущен из исходников: соберите его (pnpm cyberzavod) и запустите собранный",
    );
  }

  return installation.tool;
}
