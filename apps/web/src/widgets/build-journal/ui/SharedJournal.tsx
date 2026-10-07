import { onMount, Show, type JSX } from "solid-js";
import { $sharedRecording, noticeOf, openSharedRecording } from "@/features/shared-recording";
import type { Locale } from "@/shared/i18n/locale.ts";
import { useStoreValue } from "@/shared/lib/use-store-value.ts";
import { JournalTimeline } from "./JournalTimeline.tsx";
import styles from "./Timeline.module.css";

interface Props {
  /** Язык страницы: на нём метки, подписи и сообщения журнала. */
  locale: Locale;
}

/**
 * Журнал сборки записи из галереи: запись приходит из API в браузере, пока её нет — сообщение,
 * почему.
 * @param {Props} props Свойства компонента.
 * @param {Locale} props.locale Язык страницы.
 * @returns {JSX.Element} Журнал или сообщение.
 */
export function SharedJournal(props: Props): JSX.Element {
  const state = useStoreValue($sharedRecording);
  const recording = () => {
    const current = state();

    return current.status === "ready" ? current.value.record : undefined;
  };

  onMount(() => void openSharedRecording(window.location.search));

  return (
    <Show
      when={recording()}
      fallback={<p class={styles.empty}>{noticeOf(state(), props.locale)}</p>}
    >
      {(record) => <JournalTimeline recording={record()} locale={props.locale} />}
    </Show>
  );
}
