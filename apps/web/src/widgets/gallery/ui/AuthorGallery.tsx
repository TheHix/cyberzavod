import { For, Show, type JSX } from "solid-js";
import { ReadmeBadge, sharedRecordingUrl, type Gallery } from "@/entities/gallery";
import type { Locale } from "@/shared/i18n/locale.ts";
import { UI_TEXT } from "@/shared/i18n/ui-text.ts";
import { formatDate } from "@/shared/lib/format.ts";
import { languageNoteOf } from "@/shared/lib/language-note.ts";
import { Card, Chip, Title } from "@/shared/ui";
import styles from "./GalleryBoard.module.css";

interface Props {
  gallery: Gallery;
  /** Адрес сайта — для строки бейджа. */
  siteUrl: string;
  /** Язык страницы: на нём подписи и даты. */
  locale: Locale;
}

/**
 * Открытая галерея автора: записи со ссылками на цех и бейдж для README.
 * @param {Props} props Свойства компонента.
 * @param {Gallery} props.gallery Галерея автора.
 * @param {string} props.siteUrl Адрес сайта.
 * @param {Locale} props.locale Язык страницы.
 * @returns {JSX.Element} Записи галереи и бейдж.
 */
export function AuthorGallery(props: Props): JSX.Element {
  return (
    <>
      <Show
        when={props.gallery.recordings.length > 0}
        fallback={<p class={styles.note}>{UI_TEXT.gallery.noRecordings[props.locale]}</p>}
      >
        <ul class={styles.list}>
          <For each={props.gallery.recordings}>
            {(recording) => (
              <li>
                <Card>
                  <div class={styles.card}>
                    <Chip tone="sun">{formatDate(recording.startedAt, props.locale)}</Chip>
                    <a href={sharedRecordingUrl(recording.slug, props.locale)}>
                      <Title as="span" lang={recording.language}>
                        {recording.title}
                      </Title>
                    </a>
                    <p class={styles.note}>
                      {recording.projectId}
                      <Show when={languageNoteOf(recording.language, props.locale)}>
                        {(note) => ` · ${note()}`}
                      </Show>
                    </p>
                  </div>
                </Card>
              </li>
            )}
          </For>
        </ul>
      </Show>
      <ReadmeBadge login={props.gallery.login} siteUrl={props.siteUrl} locale={props.locale} />
    </>
  );
}
