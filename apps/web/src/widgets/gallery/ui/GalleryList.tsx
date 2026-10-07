import { For, Show, type JSX } from "solid-js";
import { galleryUrl, type GalleryListing } from "@/entities/gallery";
import type { Locale } from "@/shared/i18n/locale.ts";
import { UI_TEXT } from "@/shared/i18n/ui-text.ts";
import { formatCount, formatDate } from "@/shared/lib/format.ts";
import { Card, Title } from "@/shared/ui";
import styles from "./GalleryBoard.module.css";

interface Props {
  galleries: readonly GalleryListing[];
  /** Язык страницы: на нём подписи и даты. */
  locale: Locale;
}

/**
 * Общий список открытых галерей: автор, число сборок и когда галерея менялась.
 * @param {Props} props Свойства компонента.
 * @param {readonly GalleryListing[]} props.galleries Открытые галереи, свежие сверху.
 * @param {Locale} props.locale Язык страницы.
 * @returns {JSX.Element} Список галерей или заглушка, если их нет.
 */
export function GalleryList(props: Props): JSX.Element {
  return (
    <Show
      when={props.galleries.length > 0}
      fallback={<p class={styles.note}>{UI_TEXT.gallery.noGalleries[props.locale]}</p>}
    >
      <ul class={styles.list}>
        <For each={props.galleries}>
          {(gallery) => (
            <li>
              <Card>
                <div class={styles.card}>
                  <a href={galleryUrl(gallery.login, props.locale)}>
                    <Title as="span">{gallery.login}</Title>
                  </a>
                  <p class={styles.note}>
                    {formatCount(gallery.recordingCount, UI_TEXT.lists.builds, props.locale)} ·{" "}
                    {UI_TEXT.gallery.updated[props.locale](
                      formatDate(gallery.updatedAt, props.locale),
                    )}
                  </p>
                </div>
              </Card>
            </li>
          )}
        </For>
      </ul>
    </Show>
  );
}
