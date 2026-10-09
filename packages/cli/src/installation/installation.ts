// The running Cyberzavod version: version, harness and templates.

import type { ClaudeTemplates } from "@cyberzavod/adapter-claude";
import { parseHarness, type Harness, type HarnessError } from "@cyberzavod/core";
import { readAssets } from "./assets.ts";

/**
 * Cyberzavod version: this CLI sets it in the project config; it is also the npm package version.
 */
export const HARNESS_VERSION = "0.9.1";

const RULES_TEMPLATE = "rules.md";

/** The running Cyberzavod version. */
export interface Installation {
  harness: Harness;
  /** AGENTS.md starter for a new project. */
  rulesTemplate: string;
  claudeTemplates: ClaudeTemplates;
}

function template(templates: Readonly<Record<string, string>>, name: string): string {
  const text = templates[name];

  if (text === undefined) throw new Error(`installation has no template ${name}`);

  return text;
}

/**
 * Reads the running Cyberzavod version.
 * @returns {Promise<Installation>} Harness and templates.
 * @throws {HarnessError} If the installation's harness fails validation.
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
