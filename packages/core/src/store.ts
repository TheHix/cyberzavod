// Граница хранилища: домен знает, что записи можно перечислить и сохранить, но не знает,
// где они лежат — в репозитории проекта, в каталоге рядом с ним или где-то ещё.

import type { JournalRecord } from "./record.ts";

/** Хранилище записей журнала одного проекта. */
export interface RecordStore {
  /**
   * Перечисляет все записи журнала.
   * @returns {Promise<JournalRecord[]>} Проверенные записи в порядке, который выбирает хранилище.
   */
  list(): Promise<JournalRecord[]>;
  /**
   * Сохраняет запись; запись того же типа с тем же `id` заменяется.
   * @param {JournalRecord} record Проверенная запись.
   * @returns {Promise<void>} Готово, когда запись сохранена.
   */
  write(record: JournalRecord): Promise<void>;
}
