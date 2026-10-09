// Everything the sharing commands talk to outside: the server, GitHub, the token file and the
// clock.

import { setTimeout as delay } from "node:timers/promises";
import { HttpCyberzavodApi, type CyberzavodApi } from "./api.ts";
import { HttpGithubAuth, type GithubDeviceAuth } from "./github.ts";
import {
  credentialsFile,
  FileCredentialsStore,
  type CredentialsStore,
  type SettingsEnvironment,
} from "./settings.ts";

/** The default server if `CYBERZAVOD_API_URL` is not set. */
export const DEFAULT_API_URL = "https://cyberzavod.com";

/** Environment variable with the server address. */
export const API_URL_VARIABLE = "CYBERZAVOD_API_URL";

const TRAILING_SLASHES = /\/+$/;

/** Dependencies of the login, logout, share, unshare and gallery commands; stubs in tests. */
export interface Sharing {
  /** Server address without a trailing "/": links for the human are built from it. */
  siteUrl: string;
  api: CyberzavodApi;
  github: GithubDeviceAuth;
  credentials: CredentialsStore;
  sleep(milliseconds: number): Promise<void>;
}

/**
 * Real dependencies: the server from `CYBERZAVOD_API_URL`, GitHub, the token in the settings
 * directory.
 * @param {SettingsEnvironment} environment Environment, platform and home directory.
 * @returns {Sharing} Dependencies of the sharing commands.
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
