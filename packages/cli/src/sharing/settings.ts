// Учётные данные пользователя: токен GitHub в `credentials.json` каталога настроек, вне проекта.

import { chmod, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { isObject } from "./http.ts";
import { readOptionalText } from "../files.ts";
import { CommandError } from "../errors.ts";

/** Имя каталога настроек Cyberzavod внутри каталога настроек пользователя. */
const SETTINGS_DIRECTORY_NAME = "cyberzavod";

/** Имя файла с токеном. */
export const CREDENTIALS_FILE_NAME = "credentials.json";

/** Токен читает и пишет только владелец файла. */
const OWNER_ONLY_FILE_MODE = 0o600;
const OWNER_ONLY_DIRECTORY_MODE = 0o700;

/** Откуда брать каталог настроек: окружение, платформа и домашний каталог. */
export interface SettingsEnvironment {
  env: Readonly<Record<string, string | undefined>>;
  platform: NodeJS.Platform;
  homeDirectory: string;
}

/**
 * Каталог настроек пользователя: `%APPDATA%\cyberzavod` на Windows, иначе
 * `$XDG_CONFIG_HOME/cyberzavod` или `~/.config/cyberzavod`.
 * @param {SettingsEnvironment} environment Окружение, платформа и домашний каталог.
 * @returns {string} Путь каталога настроек Cyberzavod.
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
 * Файл с токеном.
 * @param {SettingsEnvironment} environment Окружение, платформа и домашний каталог.
 * @returns {string} Путь `credentials.json`.
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

/** Где лежит токен GitHub между запусками CLI. */
export interface CredentialsStore {
  /** Сохранённый токен или undefined, если входа не было. */
  read(): Promise<string | undefined>;
  save(token: string): Promise<void>;
  /** Удаляет токен; false, если сохранённого не было. */
  remove(): Promise<boolean>;
}

/** Токен в файле `credentials.json`. */
export class FileCredentialsStore implements CredentialsStore {
  readonly #file: string;

  /**
   * Хранилище токена в файле.
   * @param {string} file Абсолютный путь `credentials.json`.
   */
  constructor(file: string) {
    this.#file = file;
  }

  /**
   * Читает сохранённый токен.
   * @returns {Promise<string | undefined>} Токен или undefined, если файла нет.
   * @throws {CommandError} Если файл повреждён.
   */
  async read(): Promise<string | undefined> {
    const text = await readOptionalText(this.#file);

    if (text === undefined) return undefined;

    const token = tokenIn(text);

    if (token === undefined) {
      throw new CommandError(
        `файл ${CREDENTIALS_FILE_NAME} повреждён: войдите заново командой cyberzavod login`,
      );
    }

    return token;
  }

  /**
   * Сохраняет токен в файл, доступный только владельцу.
   * @param {string} token Токен GitHub.
   * @returns {Promise<void>} Готово, когда файл записан.
   */
  async save(token: string): Promise<void> {
    await mkdir(path.dirname(this.#file), { recursive: true, mode: OWNER_ONLY_DIRECTORY_MODE });
    await writeFile(this.#file, `${JSON.stringify({ token }, null, 2)}\n`, {
      mode: OWNER_ONLY_FILE_MODE,
    });
    // mode у writeFile действует только при создании файла; прежние права у старого файла — шире.
    await chmod(this.#file, OWNER_ONLY_FILE_MODE);
  }

  /**
   * Удаляет файл с токеном.
   * @returns {Promise<boolean>} true, если токен был сохранён.
   */
  async remove(): Promise<boolean> {
    const hadToken = (await readOptionalText(this.#file)) !== undefined;

    await rm(this.#file, { force: true });

    return hadToken;
  }
}
