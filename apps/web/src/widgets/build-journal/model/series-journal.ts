// Build series journal: shows the full recording of the build that is on the floor now. The floor
// and the journal are separate islands; the journal learns which recording is on the floor from
// `$sceneRecordingId` (journal-sync).

import { computed, type ReadableAtom } from "nanostores";
import type { SessionRecord } from "@cyberzavod/core";
import { recordingFileOf, type RecordingFiles } from "@/entities/recording-file";
import { MISSING, type Remote } from "@/shared/api/remote.ts";
import { nextIndexInCircle } from "@/shared/lib/circle.ts";

/**
 * Where the series journal gets recordings: the series order, the floor recording and the cache.
 */
export interface SeriesJournalSources {
  /** Build ids of the series in the order the floor plays them. */
  readonly recordingIds: readonly string[];
  /**
   * Id of the recording the floor is playing now; `null` means the floor is not connected yet.
   */
  readonly $sceneRecordingId: ReadableAtom<string | null>;
  /** Full recordings already requested. */
  readonly $files: ReadableAtom<RecordingFiles>;
  /** Requests a full recording unless it was already requested. */
  readonly request: (id: string) => Promise<void>;
}

/** Series journal: which recording to show and how to follow the floor. */
export interface SeriesJournalModel {
  /**
   * Id of the build the journal shows, also while its recording loads; absent for an empty series.
   */
  readonly $recordingId: ReadableAtom<string | undefined>;
  /** Full recording of the build on the floor now: loading, ready, or why it is missing. */
  readonly $recording: ReadableAtom<Remote<SessionRecord>>;
  /**
   * Follows the floor: requests the recording on it and, ahead of time, the next one in the
   * series, so the journal opens without waiting after the build changes.
   * @returns {() => void} Stops following.
   */
  follow(): () => void;
}

/**
 * Creates the build series journal.
 * @param {SeriesJournalSources} sources Series order, floor recording and full recording cache.
 * @returns {SeriesJournalModel} A journal that is not following the floor yet.
 */
export function createSeriesJournal(sources: SeriesJournalSources): SeriesJournalModel {
  const { recordingIds, $sceneRecordingId, $files, request } = sources;
  const [firstId] = recordingIds;
  // Until the floor connects, the journal shows the first build of the series: the floor starts
  // there.
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
