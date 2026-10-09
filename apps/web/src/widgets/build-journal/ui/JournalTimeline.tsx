import { createMemo, For, Show, type JSX } from "solid-js";
import type { SessionRecord } from "@cyberzavod/core";
import type { Locale } from "@/shared/i18n/locale.ts";
import { UI_TEXT } from "@/shared/i18n/ui-text.ts";
import { languageNoteOf } from "@/shared/lib/language-note.ts";
import { headerOf, timelineOf } from "../lib/timeline.ts";
import { EntryBody } from "./EntryBody.tsx";
import { JournalEntry } from "./JournalEntry.tsx";
import styles from "./Timeline.module.css";

interface Props {
  /** Full recording: unlike the floor, the journal has the full message texts. */
  recording: SessionRecord;
  /** Page language: journal labels and captions are in it. */
  locale: Locale;
}

/**
 * Build journal rendered in the browser, for a recording that came from the API. The same markup
 * as `BuildJournal.astro` on the page of a recording from the project journal, but entirely inside
 * one island: the texts are already in the browser, so there is no point passing them via a slot.
 * @param {Props} props Component props.
 * @param {SessionRecord} props.recording Full recording.
 * @param {Locale} props.locale Page language.
 * @returns {JSX.Element} Recording language note and the list of journal entries.
 */
export function JournalTimeline(props: Props): JSX.Element {
  const entries = createMemo(() => timelineOf(props.recording.data.events));
  const language = () => props.recording.data.language;
  const languageNote = () => languageNoteOf(language(), props.locale);

  return (
    <>
      <Show when={languageNote()}>{(note) => <p class={styles.language}>{note()}</p>}</Show>
      <Show
        when={entries().length > 0}
        fallback={<p class={styles.empty}>{UI_TEXT.journal.empty[props.locale]}</p>}
      >
        <ol class={styles.timeline}>
          <For each={entries()}>
            {(entry) => {
              const header = () => headerOf(entry, props.locale);

              return (
                <li id={header().anchor}>
                  <JournalEntry
                    recordingId={props.recording.id}
                    speech={entry.speech}
                    locale={props.locale}
                    clock={header().clock}
                    route={header().route}
                  >
                    <EntryBody entry={entry} language={language()} locale={props.locale} />
                  </JournalEntry>
                </li>
              );
            }}
          </For>
        </ol>
      </Show>
    </>
  );
}
