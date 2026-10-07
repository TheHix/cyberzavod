// Хук UserPromptSubmit: начинает ход — запоминает отпечаток кода и обнуляет счётчик отказов
// хука остановки. По отпечатку хук остановки понимает, менял ли агент код именно в этом ходе.
// Нет конфига проекта, команд проверок или конфиг битый — хук ничего не запоминает: хук остановки
// в этих случаях отпускает агента без проверок.
//
// Ход начинается, только если отпечатка ещё нет: отчёты сабагентов посреди работы приходят
// тем же событием и не должны сдвигать начало хода. Хук остановки удаляет отпечаток, когда
// отпускает агента. Если ход прервали (Stop не вызван), следующий ход наследует и начало
// прерванного хода, и его счётчик: проверка выйдет строже, а попыток может остаться меньше трёх.
// Зацикливания при этом нет.

import { existsSync } from "node:fs";
import { rm, writeFile } from "node:fs/promises";
import { ProjectFileError, readProjectConfig } from "@cyberzavod/storage";
import type { ProjectConfig } from "@cyberzavod/core";
import { checksOf } from "./checks.ts";
import { codeFingerprint, type GitError } from "./fingerprint.ts";
import { sessionIdOf, SILENT_EXIT, type HookContext, type HookOutcome } from "./hook.ts";
import { hookStatePath } from "./state.ts";

// Битый конфиг здесь не повод шуметь: о нём скажет хук остановки.
async function configOrNothing(root: string): Promise<ProjectConfig | undefined> {
  try {
    return await readProjectConfig(root);
  } catch (err) {
    if (err instanceof ProjectFileError) return undefined;

    throw err;
  }
}

/**
 * Начинает ход: запоминает отпечаток кода, если ход ещё не начат.
 * @param {HookContext} context Вызов хука.
 * @returns {Promise<HookOutcome>} Всегда молчаливый выход.
 * @throws {GitError} Если git не запускается.
 */
export async function startTurn(context: HookContext): Promise<HookOutcome> {
  const config = await configOrNothing(context.projectDirectory);
  const checks = config === undefined ? undefined : checksOf(config);

  if (checks === undefined) return SILENT_EXIT;

  const sessionId = sessionIdOf(context.payload);
  const turnStart = hookStatePath(context.tmpDir, sessionId, "turn-start");

  if (existsSync(turnStart)) return SILENT_EXIT;

  await rm(hookStatePath(context.tmpDir, sessionId, "stop-blocks"), { force: true });
  await writeFile(turnStart, codeFingerprint(context.projectDirectory, checks.paths));

  return SILENT_EXIT;
}
