// Полные записи сайта, которые страница уже спросила. Их файлы грузятся лениво и по одному
// разу: журнал серии берёт запись, которая сейчас в цехе, и заранее — следующую.

import { atom, type ReadableAtom } from "nanostores";
import type { SessionRecord } from "@cyberzavod/core";
import { LOADING, settle, type Remote } from "@/shared/api/remote.ts";
import { fetchRecording } from "../api/requests.ts";

/** Записи, которые уже спросили, по id: грузится, готова или почему её нет. */
export type RecordingFiles = Readonly<Record<string, Remote<SessionRecord>>>;

/** Кеш полных записей: стор и действие, которое спрашивает запись. */
export interface RecordingFilesModel {
  /** Записи, которые уже спросили. */
  readonly $files: ReadableAtom<RecordingFiles>;
  /**
   * Спрашивает запись, если её ещё не спрашивали: повторный вызов второй запрос не шлёт. После
   * сбоя сети следующий вызов спрашивает снова.
   * @param {string} id id записи.
   * @returns {Promise<void>} Когда запись получена или стало ясно, почему её нет.
   */
  request(id: string): Promise<void>;
}

/**
 * Создаёт кеш полных записей.
 * @param {(id: string) => Promise<SessionRecord>} fetchFile Запрос записи по id.
 * @returns {RecordingFilesModel} Пустой кеш.
 */
export function createRecordingFiles(
  fetchFile: (id: string) => Promise<SessionRecord>,
): RecordingFilesModel {
  const $files = atom<RecordingFiles>({});
  const requests = new Map<string, Promise<void>>();

  const store = (id: string, state: Remote<SessionRecord>) =>
    $files.set({ ...$files.get(), [id]: state });

  const load = async (id: string) => {
    store(id, LOADING);

    const state = await settle(() => fetchFile(id));

    store(id, state);
    // Сбой сети проходит: в следующий раз запись спросим снова, а 404 и битая запись — навсегда.
    if (state.status === "failed") requests.delete(id);
  };

  return {
    $files,
    request: (id) => {
      const pending = requests.get(id) ?? load(id);

      requests.set(id, pending);

      return pending;
    },
  };
}

/**
 * Запись из кеша: ещё не спрошенная считается загружающейся.
 * @param {RecordingFiles} files Записи, которые уже спросили.
 * @param {string} id id записи.
 * @returns {Remote<SessionRecord>} Состояние записи.
 */
export function recordingFileOf(files: RecordingFiles, id: string): Remote<SessionRecord> {
  return files[id] ?? LOADING;
}

const recordingFiles = createRecordingFiles((id) => fetchRecording(id));

/** Полные записи сайта на этой странице: общий кеш для всех островов. */
export const $recordingFiles = recordingFiles.$files;

/**
 * Спрашивает полную запись сайта, если её ещё не спрашивали на этой странице.
 * @param {string} id id записи.
 * @returns {Promise<void>} Когда запись получена или стало ясно, почему её нет.
 */
export function requestRecordingFile(id: string): Promise<void> {
  return recordingFiles.request(id);
}
