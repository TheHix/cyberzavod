// Запущенная версия Cyberzavod: версия, harness и шаблоны.

import type { ClaudeTemplates } from "@cyberzavod/adapter-claude";
import { parseHarness, type Harness, type HarnessError } from "@cyberzavod/core";
import { readAssets } from "./assets.ts";

/** Версия Cyberzavod: её ставит в конфиг проекта этот CLI, она же — версия npm-пакета. */
export const HARNESS_VERSION = "0.8.0";

const RULES_TEMPLATE = "rules.md";

/** Запущенная версия Cyberzavod. */
export interface Installation {
  harness: Harness;
  /** Заготовка AGENTS.md нового проекта. */
  rulesTemplate: string;
  claudeTemplates: ClaudeTemplates;
}

function template(templates: Readonly<Record<string, string>>, name: string): string {
  const text = templates[name];

  if (text === undefined) throw new Error(`в установке нет шаблона ${name}`);

  return text;
}

/**
 * Читает запущенную версию Cyberzavod.
 * @returns {Promise<Installation>} Harness и шаблоны.
 * @throws {HarnessError} Если harness установки не прошёл проверку.
 */
export async function readInstallation(): Promise<Installation> {
  const { harness, templates } = await readAssets();

  return {
    harness: parseHarness(harness),
    rulesTemplate: template(templates, RULES_TEMPLATE),
    claudeTemplates: {
      publishRecording: template(templates, "publish-recording.md"),
      recordingEditor: template(templates, "recording-editor.md"),
      setup: template(templates, "setup.md"),
    },
  };
}
