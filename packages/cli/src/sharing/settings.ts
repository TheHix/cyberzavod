// User credentials: the GitHub token in `credentials.json` in the settings directory, outside the
// project.

import { chmod, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { isObject } from "./http.ts";
import { readOptionalText } from "../files.ts";
import { CommandError } from "../errors.ts";

/** Name of the Cyberzavod settings directory inside the user's settings directory. */
const SETTINGS_DIRECTORY_NAME = "cyberzavod";

/** Name of the token file. */
export const CREDENTIALS_FILE_NAME = "credentials.json";

/** Only the file owner reads and writes the token. */
const OWNER_ONLY_FILE_MODE = 0o600;
const OWNER_ONLY_DIRECTORY_MODE = 0o700;

/** Where to get the settings directory from: environment, platform and home directory. */
export interface SettingsEnvironment {
  env: Readonly<Record<string, string | undefined>>;
  platform: NodeJS.Platform;
  homeDirectory: string;
}

/**
 * The user's settings directory: `%APPDATA%\cyberzavod` on Windows, otherwise
 * `$XDG_CONFIG_HOME/cyberzavod` or `~/.config/cyberzavod`.
 * @param {SettingsEnvironment} environment Environment, platform and home directory.
 * @returns {string} Path of the Cyberzavod settings directory.
 */
export function settingsDirectory(environment: SettingsEnvironment): string {
  const { env, platform, homeDirectory } = environment;
  const isWindows = platform === "win32";
  const pathFor = isWindows ? path.win32 : path.posix;
  const windowsBase = env.APPDATA || pathFor.join(homeDirectory, "AppData", "Roaming");
  const posixBase = env.XDG_CONFIG_HOME || pathFor.join(homeDirectory, ".config");
  const base = isWindows ? windowsBase : posixBase;

  return pathFor.join(base, SETTINGS_DIRECTORY_NAME);
}

/**
 * The token file.
 * @param {SettingsEnvironment} environment Environment, platform and home directory.
 * @returns {string} Path of `credentials.json`.
 */
export function credentialsFile(environment: SettingsEnvironment): string {
  const pathFor = environment.platform === "win32" ? path.win32 : path.posix;

  return pathFor.join(settingsDirectory(environment), CREDENTIALS_FILE_NAME);
}

function tokenIn(text: string): string | undefined {
  try {
    const parsed = JSON.parse(text) as unknown;

    return isObject(parsed) && typeof parsed.token === "string" && parsed.token !== ""
      ? parsed.token
      : undefined;
  } catch {
    return undefined;
  }
}

/** Where the GitHub token is kept between CLI runs. */
export interface CredentialsStore {
  /** The saved token, or undefined if there was no login. */
  read(): Promise<string | undefined>;
  save(token: string): Promise<void>;
  /** Removes the token; false if none was saved. */
  remove(): Promise<boolean>;
}

/** The token in the `credentials.json` file. */
export class FileCredentialsStore implements CredentialsStore {
  readonly #file: string;

  /**
   * File-based token store.
   * @param {string} file Absolute path of `credentials.json`.
   */
  constructor(file: string) {
    this.#file = file;
  }

  /**
   * Reads the saved token.
   * @returns {Promise<string | undefined>} The token, or undefined if there is no file.
   * @throws {CommandError} If the file is corrupted.
   */
  async read(): Promise<string | undefined> {
    const text = await readOptionalText(this.#file);

    if (text === undefined) return undefined;

    const token = tokenIn(text);

    if (token === undefined) {
      throw new CommandError((messages) =>
        messages.errors.credentialsCorrupt(CREDENTIALS_FILE_NAME),
      );
    }

    return token;
  }

  /**
   * Saves the token to a file only the owner can access.
   * @param {string} token GitHub token.
   * @returns {Promise<void>} Done when the file is written.
   */
  async save(token: string): Promise<void> {
    await mkdir(path.dirname(this.#file), { recursive: true, mode: OWNER_ONLY_DIRECTORY_MODE });
    await writeFile(this.#file, `${JSON.stringify({ token }, null, 2)}\n`, {
      mode: OWNER_ONLY_FILE_MODE,
    });
    // writeFile's mode applies only when the file is created; an old file may have wider
    // permissions.
    await chmod(this.#file, OWNER_ONLY_FILE_MODE);
  }

  /**
   * Removes the token file.
   * @returns {Promise<boolean>} true if a token was saved.
   */
  async remove(): Promise<boolean> {
    const hadToken = (await readOptionalText(this.#file)) !== undefined;

    await rm(this.#file, { force: true });

    return hadToken;
  }
}
