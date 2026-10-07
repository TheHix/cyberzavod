// Запись из галереи на странице `/r/`: её показывают два острова — цех и журнал сборки. Запись
// грузится один раз, оба острова читают один стор.

import { atom, type ReadableAtom } from "nanostores";
import { fetchSharedRecording, queryParamOf, type SharedRecording } from "@/entities/gallery";
import { LOADING, MISSING, settle, type Remote } from "@/shared/api/remote.ts";

/** Запись из галереи: стор и действие, которое её открывает. */
export interface SharedRecordingModel {
  /** Запись по ссылке страницы: грузится, готова или почему её нет. */
  readonly $recording: ReadableAtom<Remote<SharedRecording>>;
  /**
   * Открывает запись по параметрам адреса. Повторный вызов не шлёт второй запрос.
   * @param {string} search Параметры адреса — `location.search`.
   * @returns {Promise<void>} Когда запись получена или стало ясно, почему её нет.
   */
  open(search: string): Promise<void>;
}

/**
 * Создаёт модель записи из галереи.
 * @param {(slug: string) => Promise<SharedRecording>} fetchRecording Запрос записи по slug.
 * @returns {SharedRecordingModel} Модель с начальным состоянием «грузится».
 */
export function createSharedRecordingModel(
  fetchRecording: (slug: string) => Promise<SharedRecording>,
): SharedRecordingModel {
  const $recording = atom<Remote<SharedRecording>>(LOADING);
  let opening: Promise<void> | undefined;

  const load = async (search: string) => {
    const slug = queryParamOf(search, "recording");

    if (slug === undefined) {
      $recording.set(MISSING);

      return;
    }

    $recording.set(await settle(() => fetchRecording(slug)));
  };

  return {
    $recording,
    open: (search) => {
      opening ??= load(search);

      return opening;
    },
  };
}

const sharedRecording = createSharedRecordingModel((slug) => fetchSharedRecording(slug));

/** Запись из галереи на этой странице: общая для островов цеха и журнала. */
export const $sharedRecording = sharedRecording.$recording;

/**
 * Открывает запись из галереи по параметрам адреса страницы; второй остров не шлёт второй запрос.
 * @param {string} search Параметры адреса — `location.search`.
 * @returns {Promise<void>} Когда запись получена или стало ясно, почему её нет.
 */
export function openSharedRecording(search: string): Promise<void> {
  return sharedRecording.open(search);
}
