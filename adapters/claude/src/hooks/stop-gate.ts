// Хук Stop: если агент в этом ходе менял код, он не может закончить, пока проверки проекта
// красные. Нет конфига или команд проверок — агент отпускается без проверок; битый конфиг —
// отпускается с сообщением. Код выхода 2 возвращает агента к работе, а stderr он получает как
// задание. Защита от вечного цикла: после MAX_BLOCKS отказов за ход агент отпускается, зовёт
// человека и оставляет отметку `human-call` для записи сессии; если счётчик не удаётся записать,
// агент тоже отпускается. Счётчик обнуляет начало хода, поэтому здесь он только растёт.

import { readFile, rm, writeFile } from "node:fs/promises";
import {
  isNotFound,
  PROJECT_CONFIG_FILE,
  ProjectFileError,
  readProjectConfig,
} from "@cyberzavod/storage";
import type { ProjectConfig } from "@cyberzavod/core";
import { checksOf, runChecks, type ProjectChecks } from "./checks.ts";
import { codeFingerprint, GitError, hasUncommittedChanges } from "./fingerprint.ts";
import { sessionIdOf, SILENT_EXIT, type HookContext, type HookOutcome } from "./hook.ts";
import { hookStatePath, type HookStateName } from "./state.ts";

const MAX_BLOCKS = 3;
const OUTPUT_TAIL_LINES = 40;
const BLOCK_EXIT_CODE = 2;
const RELEASE_EXIT_CODE = 0;

/** Решение хука остановки. */
type StopVerdict =
  | { kind: "release" }
  | { kind: "release-with-message"; message: string }
  | { kind: "block"; message: string };

const RELEASE: StopVerdict = { kind: "release" };

/** Остановка одной сессии: где лежит её состояние. */
interface StopSession {
  root: string;
  statePath(name: HookStateName): string;
}

type ConfigReading = { config: ProjectConfig | undefined } | { broken: ProjectFileError };

async function readConfig(root: string): Promise<ConfigReading> {
  try {
    return { config: await readProjectConfig(root) };
  } catch (err) {
    if (err instanceof ProjectFileError) return { broken: err };

    throw err;
  }
}

async function readState(file: string): Promise<string | undefined> {
  try {
    return await readFile(file, "utf8");
  } catch (err) {
    if (isNotFound(err)) return undefined;

    throw err;
  }
}

// Если отпечатка начала хода нет (хуки подключились посреди хода), код считается изменённым
// при любых незакоммиченных правках в каталогах с кодом.
async function codeChangedThisTurn(session: StopSession, checks: ProjectChecks): Promise<boolean> {
  const turnStart = await readState(session.statePath("turn-start"));

  if (turnStart === undefined) return hasUncommittedChanges(session.root, checks.paths);

  return turnStart !== codeFingerprint(session.root, checks.paths);
}

// Счётчик, который не прочитать или не записать, не даёт защиты от вечного цикла: такой отказ
// вызывающий превращает в отпуск агента.
async function countedBlock(counter: string): Promise<number | undefined> {
  try {
    const stored = await readState(counter);
    const blocks = Number.parseInt(stored ?? "0", 10);
    const next = (Number.isNaN(blocks) ? 0 : blocks) + 1;

    await writeFile(counter, String(next));

    return next;
  } catch {
    return undefined;
  }
}

async function written(file: string, text: string): Promise<boolean> {
  try {
    await writeFile(file, text);

    return true;
  } catch {
    return false;
  }
}

function tailOf(output: string): string {
  const lines = output.trimEnd().split("\n");

  return lines.slice(-OUTPUT_TAIL_LINES).join("\n");
}

// Отметка нужна хуку записи: следующий промпт человека — вызов хуком остановки.
async function callHuman(session: StopSession, blocks: number): Promise<StopVerdict> {
  const message = `Проверки красные после ${MAX_BLOCKS} попыток исправить — агент остановлен, нужен человек.`;
  const marked = await written(session.statePath("human-call"), String(blocks));

  return {
    kind: "release-with-message",
    message: marked ? message : `${message} Отметка для записи не сохранена.`,
  };
}

async function verdictOnRedChecks(
  session: StopSession,
  checks: ProjectChecks,
  output: string,
): Promise<StopVerdict> {
  const counter = session.statePath("stop-blocks");
  const blocks = await countedBlock(counter);

  if (blocks === undefined) {
    return {
      kind: "release-with-message",
      message: `Хук остановки не смог записать счётчик попыток (${counter}) — проверки красные, агент отпущен без повторов.`,
    };
  }
  if (blocks > MAX_BLOCKS) return callHuman(session, blocks);

  return {
    kind: "block",
    message: `${checks.command} не проходит — закончить работу нельзя (попытка ${blocks} из ${MAX_BLOCKS}). Исправь:\n${tailOf(output)}\n`,
  };
}

// Без git не понять, менял ли агент код: держать его вслепую хуже, чем отпустить с сообщением.
async function codeChangedOrGitMissing(
  session: StopSession,
  checks: ProjectChecks,
): Promise<boolean | GitError> {
  try {
    return await codeChangedThisTurn(session, checks);
  } catch (err) {
    if (err instanceof GitError) return err;

    throw err;
  }
}

async function verdictOf(session: StopSession): Promise<StopVerdict> {
  const reading = await readConfig(session.root);

  if ("broken" in reading) {
    return {
      kind: "release-with-message",
      message: `Конфиг ${PROJECT_CONFIG_FILE} не читается — проверки пропущены, агент отпущен. ${reading.broken.message}`,
    };
  }

  const checks = reading.config === undefined ? undefined : checksOf(reading.config);

  if (checks === undefined) return RELEASE;

  const changed = await codeChangedOrGitMissing(session, checks);

  if (changed instanceof GitError) {
    return {
      kind: "release-with-message",
      message: `Хук остановки не запустил git — проверки пропущены, агент отпущен. ${changed.message}`,
    };
  }
  if (!changed) return RELEASE;

  const run = runChecks(checks, session.root, session.statePath("checks-output"));

  if (run.passed) return RELEASE;

  return verdictOnRedChecks(session, checks, run.output);
}

// На месте файла состояния может оказаться каталог: агент отпускается и тогда.
async function removeState(file: string): Promise<void> {
  await rm(file, { force: true, recursive: true });
}

// Отпущенный агент закончил ход: следующий промпт начнёт новый.
async function endTurn(session: StopSession): Promise<void> {
  await removeState(session.statePath("turn-start"));
  await removeState(session.statePath("stop-blocks"));
}

async function outcomeOf(session: StopSession, verdict: StopVerdict): Promise<HookOutcome> {
  switch (verdict.kind) {
    case "release":
      await endTurn(session);

      return SILENT_EXIT;
    case "release-with-message":
      await endTurn(session);

      return {
        exitCode: RELEASE_EXIT_CODE,
        stdout: `${JSON.stringify({ systemMessage: verdict.message })}\n`,
        stderr: "",
      };
    case "block":
      return { exitCode: BLOCK_EXIT_CODE, stdout: "", stderr: verdict.message };
  }
}

/**
 * Решает, может ли агент закончить ход: запускает проверки, если он менял код.
 * @param {HookContext} context Вызов хука.
 * @returns {Promise<HookOutcome>} Отпустить, отпустить с сообщением или вернуть к работе.
 */
export async function gateStop(context: HookContext): Promise<HookOutcome> {
  const sessionId = sessionIdOf(context.payload);
  const session: StopSession = {
    root: context.projectDirectory,
    statePath: (name) => hookStatePath(context.tmpDir, sessionId, name),
  };

  return outcomeOf(session, await verdictOf(session));
}
