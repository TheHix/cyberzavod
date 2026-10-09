// Машиночитаемый вывод команд чтения и проверки (`--json`): один JSON-документ в stdout, без
// цветов и переводов. Ключи стабильны: их читают скрипты и CI, текст для человека — нет.

/** Версия формата JSON-вывода; не путать с версией CLI и harness. */
export const JSON_OUTPUT_SCHEMA_VERSION = 1;

/**
 * Печатает JSON-документ команды: версия формата, имя команды, затем поля команды.
 * @param {string} command Имя команды, например `doctor`.
 * @param {object} body Поля документа.
 */
export function printJson(command: string, body: object): void {
  const document = { schemaVersion: JSON_OUTPUT_SCHEMA_VERSION, command, ...body };

  console.log(JSON.stringify(document, null, 2));
}
