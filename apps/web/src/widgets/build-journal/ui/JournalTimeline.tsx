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
  /** Полная запись: в журнале, в отличие от цеха, есть полные тексты реплик. */
  recording: SessionRecord;
  /** Язык страницы: на нём метки и подписи журнала. */
  locale: Locale;
}

/**
 * Журнал сборки, который рисуется в браузере, — для записи, пришедшей из API. Та же разметка,
 * что у `BuildJournal.astro` на странице записи из журнала проекта, но целиком внутри одного
 * острова: тексты уже в браузере, и слотом их передавать незачем.
 * @param {Props} props Свойства компонента.
 * @param {SessionRecord} props.recording Полная запись.
 * @param {Locale} props.locale Язык страницы.
 * @returns {JSX.Element} Пометка о языке записи и список записей журнала.
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
