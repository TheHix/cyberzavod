// Shared data for sharing tests: stubs of the server, GitHub and the token store.

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, onTestFinished, vi } from "vitest";
import type { ProjectConfig, SessionRecord } from "@cyberzavod/core";
import { writeProjectConfig } from "@cyberzavod/storage";
import type { CyberzavodApi, Me, RecordingSummary } from "./api.ts";
import type { GithubDeviceAuth } from "./github.ts";
import type { CredentialsStore } from "./settings.ts";
import type { Sharing } from "./services.ts";

/** A token that must not appear in any output line. */
export const SECRET_TOKEN = "gho_secret_token_value";

/** Server address in tests. */
export const TEST_SITE_URL = "https://cyberzavod.test";

/**
 * Brief information about a recording on the server.
 * @param {Partial<RecordingSummary>} patch Fields to replace.
 * @returns {RecordingSummary} Recording information.
 */
export function summary(patch: Partial<RecordingSummary> = {}): RecordingSummary {
  return {
    id: "2026-10-07-demo",
    slug: "k3f9x2m1q8zt",
    projectId: "demo",
    title: "Демо",
    language: "ru",
    startedAt: "2026-10-07T10:00:00.000Z",
    uploadedAt: "2026-10-07T11:00:00Z",
    ...patch,
  };
}

/**
 * An author with a private gallery and no recordings.
 * @param {Partial<Me>} patch Fields to replace.
 * @returns {Me} The author.
 */
export function author(patch: Partial<Me> = {}): Me {
  return { login: "alice", galleryPublic: false, limit: 5, recordings: [], ...patch };
}

/**
 * A token in memory instead of a file.
 * @param {string | undefined} token The saved token; without it there was no login.
 * @returns {CredentialsStore} The token store.
 */
export function memoryCredentials(token?: string): CredentialsStore {
  let saved = token;

  return {
    read: async () => saved,
    save: async (next) => {
      saved = next;
    },
    remove: async () => {
      const hadToken = saved !== undefined;

      saved = undefined;

      return hadToken;
    },
  };
}

/**
 * A server that responds as for a logged-in author with a private gallery.
 * @param {Partial<CyberzavodApi>} patch Methods to replace.
 * @returns {CyberzavodApi} Server stub: every method is a spy.
 */
export function fakeApi(patch: Partial<CyberzavodApi> = {}): CyberzavodApi {
  return {
    githubClientId: vi.fn(async () => "client-id"),
    me: vi.fn(async () => author()),
    uploadRecording: vi.fn(async () => ({ recording: summary(), isNew: true })),
    deleteRecording: vi.fn(async () => undefined),
    setGalleryPublic: vi.fn(async () => undefined),
    ...patch,
  };
}

/**
 * GitHub that issues a token right away.
 * @param {Partial<GithubDeviceAuth>} patch Methods to replace.
 * @returns {GithubDeviceAuth} GitHub stub.
 */
export function fakeGithub(patch: Partial<GithubDeviceAuth> = {}): GithubDeviceAuth {
  return {
    requestDeviceCode: vi.fn(async () => ({
      deviceCode: "device-code",
      userCode: "WDJB-MJHT",
      verificationUri: "https://github.com/login/device",
      expiresInSeconds: 900,
      intervalSeconds: 5,
    })),
    pollAccessToken: vi.fn(async () => ({ status: "granted" as const, token: SECRET_TOKEN })),
    ...patch,
  };
}

/**
 * Sharing command dependencies without network or disk.
 * @param {Partial<Sharing>} patch Fields to replace.
 * @returns {Sharing} Stubs: logged in, pauses are instant.
 */
export function fakeSharing(patch: Partial<Sharing> = {}): Sharing {
  return {
    siteUrl: TEST_SITE_URL,
    api: fakeApi(),
    github: fakeGithub(),
    credentials: memoryCredentials(SECRET_TOKEN),
    sleep: vi.fn(async () => undefined),
    ...patch,
  };
}

/**
 * A session for tests.
 * @param {string} id Recording id.
 * @returns {SessionRecord} A session of the build's start and end.
 */
export function validSession(id = "2026-10-07-demo"): SessionRecord {
  return {
    version: 1,
    type: "session",
    id,
    timestamp: "2026-10-07T10:00:00.000Z",
    projectId: "demo",
    source: { type: "agent", provider: "anthropic", agent: "claude" },
    data: {
      title: "Демо",
      language: "ru",
      workflow: "default",
      harness: "0.3.0",
      events: [
        { t: 0, type: "build_start" },
        { t: 10, type: "build_end", ok: true },
      ],
    },
  };
}

/**
 * A temporary project with the journal in `journal/`; removed after the test.
 * @returns {Promise<string>} Project root.
 */
export async function temporaryProject(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "cyberzavod-share-"));
  const config: ProjectConfig = {
    projectId: "demo",
    harness: "0.3.0",
    workflow: "default",
    journal: "journal",
    agents: {},
    verification: { commands: [], paths: [] },
  };

  onTestFinished(() => rm(root, { recursive: true, force: true }));
  await writeProjectConfig(root, config);

  return root;
}

/**
 * Puts a session recording file into the temporary project's journal.
 * @param {string} root Project root.
 * @param {string} id File name without extension.
 * @param {string} text File contents.
 * @returns {Promise<void>} Done when the file is written.
 */
export async function writeSessionFile(root: string, id: string, text: string): Promise<void> {
  const directory = path.join(root, "journal", "sessions");

  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, `${id}.json`), text);
}

/**
 * Suppresses `console.log` output during each test of the group; call inside `describe`.
 * @returns {() => string} A function that returns everything printed in the test.
 */
export function captureOutput(): () => string {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  return () =>
    vi
      .mocked(console.log)
      .mock.calls.map((call) => call.join(" "))
      .join("\n");
}
