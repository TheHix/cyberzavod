// Общие данные для тестов `doctor`: машина без диска, подключённый проект во временном каталоге
// и контекст проверок проекта.

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { onTestFinished, vi } from "vitest";
import { CLAUDE_MESSAGES } from "@cyberzavod/adapter-claude";
import { journalDirectory, readProjectConfig } from "@cyberzavod/storage";
import { confirmWithoutAsking } from "../confirmation.ts";
import { initProject } from "../commands/init.ts";
import type { ProjectAt } from "../commands/project.ts";
import { readInstallation } from "../installation/installation.ts";
import { CLI_MESSAGES } from "../messages/catalog.ts";
import { memoryCredentials, SECRET_TOKEN } from "../sharing/fixtures.ts";
import type { CommandRunner, Machine, ProjectContext } from "./check.ts";

/** Тексты на английском: тесты проверяют подсказки дословно. */
export const messages = CLI_MESSAGES.en;

/** Заполненные правила проекта: без заглушек заготовки. */
export const FILLED_RULES = "# Rules\n\nFilled in.\n";

/** Команда проверки у подключённого проекта в тестах. */
export const PROJECT_CHECK_COMMAND = "make check";

/**
 * Машина, на которой всё в порядке: свежий Node, git найден, токен сохранён.
 * @param {Partial<Machine>} patch Поля, которые нужно заменить.
 * @returns {Machine} Машина для проверок.
 */
export function machine(patch: Partial<Machine> = {}): Machine {
  return {
    nodeVersion: "22.1.0",
    credentials: memoryCredentials(SECRET_TOKEN),
    isProgramAvailable: async () => true,
    ...patch,
  };
}

/**
 * Подключённый проект во временном каталоге: `init --yes` с одной проверкой и заполненный
 * AGENTS.md. Вывод `init` подавлен до конца теста; каталог удаляется после теста.
 * @param {string[]} checks Команды проверок проекта.
 * @returns {Promise<ProjectAt>} Проект.
 */
export async function connectedProject(checks = [PROJECT_CHECK_COMMAND]): Promise<ProjectAt> {
  const root = await mkdtemp(path.join(tmpdir(), "cyberzavod-doctor-"));
  const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

  onTestFinished(() => rm(root, { recursive: true, force: true }));
  onTestFinished(() => log.mockRestore());
  await initProject(root, {
    confirm: confirmWithoutAsking,
    overrides: { checks, projectId: "shop" },
    installation: await readInstallation(),
    messages,
  });
  log.mockClear();
  await writeFile(path.join(root, "AGENTS.md"), FILLED_RULES);

  return projectAt(root);
}

/**
 * Проект, как его видят проверки, по корню на диске.
 * @param {string} root Корень подключённого проекта.
 * @returns {Promise<ProjectAt>} Проект с актуальным конфигом.
 */
export async function projectAt(root: string): Promise<ProjectAt> {
  const config = await readProjectConfig(root);

  if (config === undefined) throw new Error(`в ${root} нет проекта`);

  return { root, config, journal: journalDirectory(root, config) };
}

/**
 * Контекст проверок проекта: программы найдены, команды завершаются с кодом 0.
 * @param {ProjectAt} project Подключённый проект.
 * @param {Partial<ProjectContext>} patch Поля, которые нужно заменить.
 * @returns {Promise<ProjectContext>} Контекст.
 */
export async function projectContext(
  project: ProjectAt,
  patch: Partial<ProjectContext> = {},
): Promise<ProjectContext> {
  const runCommand: CommandRunner = () => ({ kind: "exited", code: 0 });

  return {
    project,
    installation: await readInstallation(),
    messages,
    claudeMessages: CLAUDE_MESSAGES.en,
    isProgramAvailable: async () => true,
    runCommand,
    ...patch,
  };
}
