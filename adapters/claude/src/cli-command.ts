// Как адаптер зовёт CLI: пакет из npm через npx.

/** Имя npm-пакета Cyberzavod. */
export const PACKAGE_NAME = "cyberzavod";

/** Команда запуска CLI для подсказок человеку: версию подбирает npx. */
export const CLI_COMMAND = `npx ${PACKAGE_NAME}`;

/**
 * Команда запуска CLI той версии, что записана в конфиге проекта: так черновик и публикация идут
 * той же версией, что писала журнал.
 * @param {string} version Версия Cyberzavod из конфига проекта.
 * @returns {string} Команда запуска без аргументов.
 */
export function pinnedCliCommand(version: string): string {
  return `${CLI_COMMAND}@${version}`;
}
