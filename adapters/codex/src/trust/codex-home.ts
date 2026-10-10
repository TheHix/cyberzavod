// Where Codex keeps the human's own config: the file that holds which projects and hooks the human
// trusts.

import path from "node:path";

const CONFIG_FILE_NAME = "config.toml";
const HOME_DIRECTORY_NAME = ".codex";
const HOME_VARIABLE = "CODEX_HOME";

/** What decides where the config is: the process environment and the home directory. */
export interface CodexHomeSource {
  env: Readonly<Record<string, string | undefined>>;
  homeDirectory: string;
}

/**
 * The human's Codex config: `$CODEX_HOME/config.toml` or `~/.codex/config.toml`.
 * @param {CodexHomeSource} source Environment and home directory.
 * @returns {string} Absolute path of the config file; it may not exist.
 */
export function codexConfigFile(source: CodexHomeSource): string {
  const home = source.env[HOME_VARIABLE];

  if (home !== undefined && home !== "") return path.join(home, CONFIG_FILE_NAME);

  return path.join(source.homeDirectory, HOME_DIRECTORY_NAME, CONFIG_FILE_NAME);
}
