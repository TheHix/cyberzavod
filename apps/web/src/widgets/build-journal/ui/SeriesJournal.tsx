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
  /** id сборок серии в порядке, в каком их проигрывает цех. */
  recordingIds: readonly string[];
  /** Язык страницы: на нём метки, подписи и сообщения журнала. */
  locale: Locale;
}

/**
 * Журнал серии сборок: полная запись той сборки, что сейчас в цехе. Записи приходят файлами в
 * браузере, следующая грузится заранее; пока записи нет — сообщение, почему. В журнале всегда
 * одна запись, поэтому якоря реплик и вмешательств однозначны.
 * @param {Props} props Свойства компонента.
 * @param {readonly string[]} props.recordingIds id сборок серии по порядку проигрывания.
 * @param {Locale} props.locale Язык страницы.
 * @returns {JSX.Element} Журнал или сообщение.
 */
export function SeriesJournal(props: Props): JSX.Element {
  // Серия у островка не меняется: журнал создаётся один раз.
  const journal = createSeriesJournal({
    recordingIds: untrack(() => props.recordingIds),
    $sceneRecordingId,
    $files: $recordingFiles,
    request: requestRecordingFile,
  });
  const state = useStoreValue(journal.$recording);
  const recording = () => readyValue(state());
  // Элемент задаётся в разметке через ref и живёт столько же, сколько компонент.
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
