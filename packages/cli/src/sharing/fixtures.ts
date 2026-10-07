// Общие данные для тестов публикации: заглушки сервера, GitHub и хранилища токена.

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

/** Токен, которого не должно быть ни в одной строке вывода. */
export const SECRET_TOKEN = "gho_secret_token_value";

/** Адрес сервера в тестах. */
export const TEST_SITE_URL = "https://cyberzavod.test";

/**
 * Краткие сведения о записи на сервере.
 * @param {Partial<RecordingSummary>} patch Поля, которые нужно заменить.
 * @returns {RecordingSummary} Сведения о записи.
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
 * Автор с закрытой галереей и без записей.
 * @param {Partial<Me>} patch Поля, которые нужно заменить.
 * @returns {Me} Автор.
 */
export function author(patch: Partial<Me> = {}): Me {
  return { login: "alice", galleryPublic: false, limit: 5, recordings: [], ...patch };
}

/**
 * Токен в памяти вместо файла.
 * @param {string | undefined} token Сохранённый токен; без него входа не было.
 * @returns {CredentialsStore} Хранилище токена.
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
 * Сервер, который отвечает как для вошедшего автора с закрытой галереей.
 * @param {Partial<CyberzavodApi>} patch Методы, которые нужно заменить.
 * @returns {CyberzavodApi} Заглушка сервера: каждый метод — шпион.
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
 * GitHub, который сразу выдаёт токен.
 * @param {Partial<GithubDeviceAuth>} patch Методы, которые нужно заменить.
 * @returns {GithubDeviceAuth} Заглушка GitHub.
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
 * Зависимости команд публикации без сети и диска.
 * @param {Partial<Sharing>} patch Поля, которые нужно заменить.
 * @returns {Sharing} Заглушки: вход выполнен, паузы мгновенные.
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
 * Сессия для тестов.
 * @param {string} id Идентификатор записи.
 * @returns {SessionRecord} Сессия из начала и конца сборки.
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
 * Временный проект с журналом в `journal/`; удаляется после теста.
 * @returns {Promise<string>} Корень проекта.
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
 * Кладёт файл записи сессии в журнал временного проекта.
 * @param {string} root Корень проекта.
 * @param {string} id Имя файла без расширения.
 * @param {string} text Содержимое файла.
 * @returns {Promise<void>} Готово, когда файл записан.
 */
export async function writeSessionFile(root: string, id: string, text: string): Promise<void> {
  const directory = path.join(root, "journal", "sessions");

  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, `${id}.json`), text);
}

/**
 * Подавляет вывод `console.log` на время каждого теста группы; вызывать внутри `describe`.
 * @returns {() => string} Функция, которая возвращает всё напечатанное в тесте.
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
