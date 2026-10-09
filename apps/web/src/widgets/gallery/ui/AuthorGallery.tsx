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
  /** Site address, for the badge line. */
  siteUrl: string;
  /** Page language: captions and dates are in it. */
  locale: Locale;
}

/**
 * An author's public gallery: recordings with links to the floor and a badge for the README.
 * @param {Props} props Component props.
 * @param {Gallery} props.gallery The author's gallery.
 * @param {string} props.siteUrl Site address.
 * @param {Locale} props.locale Page language.
 * @returns {JSX.Element} Gallery recordings and the badge.
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
