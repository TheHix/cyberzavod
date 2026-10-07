// Всё, с чем команды публикации говорят вовне: сервер, GitHub, файл с токеном и часы.

import { setTimeout as delay } from "node:timers/promises";
import { HttpCyberzavodApi, type CyberzavodApi } from "./api.ts";
import { HttpGithubAuth, type GithubDeviceAuth } from "./github.ts";
import {
  credentialsFile,
  FileCredentialsStore,
  type CredentialsStore,
  type SettingsEnvironment,
} from "./settings.ts";

/** Сервер по умолчанию, если `CYBERZAVOD_API_URL` не задан. */
export const DEFAULT_API_URL = "https://cyberzavod.com";

/** Переменная окружения с адресом сервера. */
export const API_URL_VARIABLE = "CYBERZAVOD_API_URL";

const TRAILING_SLASHES = /\/+$/;

/** Зависимости команд login, logout, share, unshare и gallery; в тестах — заглушки. */
export interface Sharing {
  /** Адрес сервера без завершающего «/»: от него строятся ссылки для человека. */
  siteUrl: string;
  api: CyberzavodApi;
  github: GithubDeviceAuth;
  credentials: CredentialsStore;
  sleep(milliseconds: number): Promise<void>;
}

/**
 * Настоящие зависимости: сервер из `CYBERZAVOD_API_URL`, GitHub, токен в каталоге настроек.
 * @param {SettingsEnvironment} environment Окружение, платформа и домашний каталог.
 * @returns {Sharing} Зависимости команд публикации.
 */
export function createSharing(environment: SettingsEnvironment): Sharing {
  const siteUrl = (environment.env[API_URL_VARIABLE] || DEFAULT_API_URL).replace(
    TRAILING_SLASHES,
    "",
  );

  return {
    siteUrl,
    api: new HttpCyberzavodApi(siteUrl),
    github: new HttpGithubAuth(),
    credentials: new FileCredentialsStore(credentialsFile(environment)),
    sleep: (milliseconds) => delay(milliseconds),
  };
}
