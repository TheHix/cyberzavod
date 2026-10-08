// Журнал серии сборок: показывает полную запись той сборки, что сейчас в цехе. Цех и журнал —
// разные острова, какая запись в цехе — журнал узнаёт из `$sceneRecordingId` (journal-sync).

import { computed, type ReadableAtom } from "nanostores";
import type { SessionRecord } from "@cyberzavod/core";
import { recordingFileOf, type RecordingFiles } from "@/entities/recording-file";
import { MISSING, type Remote } from "@/shared/api/remote.ts";
import { nextIndexInCircle } from "@/shared/lib/circle.ts";

/** Откуда журнал серии берёт записи: порядок серии, запись в цехе и кеш полных записей. */
export interface SeriesJournalSources {
  /** id сборок серии в порядке, в каком их проигрывает цех. */
  readonly recordingIds: readonly string[];
  /** id записи, которую сейчас проигрывает цех; `null` — цех ещё не подключился. */
  readonly $sceneRecordingId: ReadableAtom<string | null>;
  /** Полные записи, которые уже спросили. */
  readonly $files: ReadableAtom<RecordingFiles>;
  /** Спрашивает полную запись, если её ещё не спрашивали. */
  readonly request: (id: string) => Promise<void>;
}

/** Журнал серии: какую запись показать и как следить за цехом. */
export interface SeriesJournalModel {
  /** id сборки, которую показывает журнал, пока её запись грузится, — тоже; нет у пустой серии. */
  readonly $recordingId: ReadableAtom<string | undefined>;
  /** Полная запись сборки, которая сейчас в цехе: грузится, готова или почему её нет. */
  readonly $recording: ReadableAtom<Remote<SessionRecord>>;
  /**
   * Следит за цехом: спрашивает запись, которая в нём, и заранее — следующую в серии, чтобы
   * журнал после смены сборки открылся без ожидания.
   * @returns {() => void} Перестаёт следить.
   */
  follow(): () => void;
}

/**
 * Создаёт журнал серии сборок.
 * @param {SeriesJournalSources} sources Порядок серии, запись в цехе и кеш полных записей.
 * @returns {SeriesJournalModel} Журнал, который ещё не следит за цехом.
 */
export function createSeriesJournal(sources: SeriesJournalSources): SeriesJournalModel {
  const { recordingIds, $sceneRecordingId, $files, request } = sources;
  const [firstId] = recordingIds;
  // Пока цех не подключился, журнал показывает первую сборку серии: с неё цех и начнёт.
  const $shownId = computed($sceneRecordingId, (id) => id ?? firstId);
  const $recording = computed([$shownId, $files], (id, files) =>
    id === undefined ? MISSING : recordingFileOf(files, id),
  );

  const nextIdOf = (id: string) => {
    const index = recordingIds.indexOf(id);

    if (index < 0) return undefined;

    return recordingIds[nextIndexInCircle(index, recordingIds.length)];
  };

  const requestWithNext = (id: string | undefined) => {
    if (id === undefined) return;

    const nextId = nextIdOf(id);

    void request(id);
    if (nextId !== undefined) void request(nextId);
  };

  return {
    $recordingId: $shownId,
    $recording,
    follow: () => $shownId.subscribe(requestWithNext),
  };
}
