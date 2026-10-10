// The adapter's real templates, as the tests read them from the sources.

import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ClaudeTemplates } from "./files.ts";

const REPOSITORY = path.resolve(import.meta.dirname, "../../../..");
const TEMPLATES = path.join(REPOSITORY, "adapters/claude/templates");
const KIT_TEMPLATES = path.join(REPOSITORY, "packages/adapter-kit/templates");

/**
 * Reads the adapter's templates and the texts it shares with the other agents.
 * @returns {Promise<ClaudeTemplates>} The templates as the CLI installs them.
 */
export async function realTemplates(): Promise<ClaudeTemplates> {
  const read = (directory: string, name: string) => readFile(path.join(directory, name), "utf8");

  return {
    publishRecording: await read(TEMPLATES, "publish-recording.md"),
    recordingEditor: await read(TEMPLATES, "recording-editor.md"),
    setup: await read(TEMPLATES, "setup.md"),
    recordingFragments: {
      rules: await read(KIT_TEMPLATES, "recording-rules.md"),
      editor: await read(KIT_TEMPLATES, "recording-editor.md"),
    },
  };
}
