import { onCleanup, onMount, Show, untrack, type JSX } from "solid-js";
import { $recordingFiles, requestRecordingFile } from "@/entities/recording-file";
import { $sceneRecordingId } from "@/features/journal-sync";
import { readyValue } from "@/shared/api/remote.ts";
import type { Locale } from "@/shared/i18n/locale.ts";
import { useStoreValue } from "@/shared/lib/use-store-value.ts";
import { seriesJournalNoticeOf } from "../lib/series-notice.ts";
import { createSeriesJournal } from "../model/series-journal.ts";
import { showNewRecordingsFromStart } from "./journal-scroll.ts";
import { JournalTimeline } from "./JournalTimeline.tsx";
import styles from "./Timeline.module.css";

interface Props {
  /** Build ids of the series in the order the floor plays them. */
  recordingIds: readonly string[];
  /** Page language: journal labels, captions and messages are in it. */
  locale: Locale;
}

/**
 * Build series journal: the full recording of the build on the floor now. Recordings come as files
 * in the browser, the next one loads ahead of time; while there is no recording, a message says
 * why. The journal always holds one recording, so message and intervention anchors are unambiguous.
 * @param {Props} props Component props.
 * @param {readonly string[]} props.recordingIds Build ids of the series in playback order.
 * @param {Locale} props.locale Page language.
 * @returns {JSX.Element} Journal or message.
 */
export function SeriesJournal(props: Props): JSX.Element {
  // The island's series does not change: the journal is created once.
  const journal = createSeriesJournal({
    recordingIds: untrack(() => props.recordingIds),
    $sceneRecordingId,
    $files: $recordingFiles,
    request: requestRecordingFile,
  });
  const state = useStoreValue(journal.$recording);
  const recording = () => readyValue(state());
  // The element is set in the markup via ref and lives as long as the component.
  let journalElement!: HTMLDivElement;

  onMount(() => {
    onCleanup(journal.follow());
    onCleanup(showNewRecordingsFromStart(journalElement, journal.$recordingId));
  });

  return (
    <div ref={(element) => (journalElement = element)}>
      <Show
        when={recording()}
        fallback={<p class={styles.empty}>{seriesJournalNoticeOf(state(), props.locale)}</p>}
      >
        {(ready) => <JournalTimeline recording={ready()} locale={props.locale} />}
      </Show>
    </div>
  );
}
