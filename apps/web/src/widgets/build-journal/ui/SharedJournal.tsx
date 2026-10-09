import { onMount, Show, type JSX } from "solid-js";
import { $sharedRecording, noticeOf, openSharedRecording } from "@/features/shared-recording";
import type { Locale } from "@/shared/i18n/locale.ts";
import { useStoreValue } from "@/shared/lib/use-store-value.ts";
import { JournalTimeline } from "./JournalTimeline.tsx";
import styles from "./Timeline.module.css";

interface Props {
  /** Page language: journal labels, captions and messages are in it. */
  locale: Locale;
}

/**
 * Build journal of a gallery recording: the recording comes from the API in the browser; while it
 * is missing, a message says why.
 * @param {Props} props Component props.
 * @param {Locale} props.locale Page language.
 * @returns {JSX.Element} Journal or message.
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
