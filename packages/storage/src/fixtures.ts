// Общие данные для тестов хранилища: временные каталоги и проверенные записи.

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { onTestFinished } from "vitest";
import type { DecisionRecord, ProjectConfig, SessionRecord } from "@cyberzavod/core";

/**
 * Создаёт пустой временный каталог для теста и удаляет его, когда тест закончится.
 * @returns {Promise<string>} Абсолютный путь каталога.
 */
export async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), "cyberzavod-storage-"));
  onTestFinished(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

/**
 * Конфиг проекта для тестов.
 * @param {Partial<ProjectConfig>} patch Поля, которые нужно заменить.
 * @returns {ProjectConfig} Конфиг с журналом в репозитории.
 */
export function validConfig(patch: Partial<ProjectConfig> = {}): ProjectConfig {
  return {
    projectId: "demo",
    harness: "0.3.0",
    workflow: "default",
    journal: "journal",
    agents: { planning: { provider: "anthropic", agent: "claude", model: "default" } },
    verification: { commands: ["pnpm test"], paths: ["src"] },
    ...patch,
  };
}

/**
 * Сессия для тестов.
 * @param {string} id Идентификатор записи.
 * @returns {SessionRecord} Сессия из начала и конца.
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
 * Решение для тестов.
 * @returns {DecisionRecord} Решение, записанное вручную.
 */
export function validDecision(): DecisionRecord {
  return {
    version: 1,
    type: "decision",
    id: "use-indexeddb",
    timestamp: "2026-10-07T10:24:00.000Z",
    projectId: "demo",
    source: { type: "manual" },
    data: { title: "IndexedDB вместо localStorage", description: "Данные растут." },
  };
}
