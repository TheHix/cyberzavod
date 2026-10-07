import type { JSX } from "solid-js";
import { badgeImageUrl, badgeMarkdown } from "@/entities/gallery";
import type { Locale } from "@/shared/i18n/locale.ts";
import { UI_TEXT } from "@/shared/i18n/ui-text.ts";
import { codeBlockClass, CopyButton, Prose, Title } from "@/shared/ui";
import styles from "./GalleryBoard.module.css";

interface Props {
  /** Логин автора открытой галереи. */
  login: string;
  /** Адрес сайта — `site` из конфига Astro: строка Markdown живёт в чужом README. */
  siteUrl: string;
  /** Язык страницы. */
  locale: Locale;
}

/**
 * Бейдж «Built at Cyberzavod» для README: картинка из API и строка Markdown со ссылкой на
 * галерею, с кнопкой «копировать».
 * @param {Props} props Свойства компонента.
 * @param {string} props.login Логин автора.
 * @param {string} props.siteUrl Адрес сайта.
 * @param {Locale} props.locale Язык страницы.
 * @returns {JSX.Element} Раздел с бейджем.
 */
export function ReadmeBadge(props: Props): JSX.Element {
  const markdown = () => badgeMarkdown(props.login, props.siteUrl);

  return (
    <section class={styles.badge}>
      <Title as="h2">{UI_TEXT.gallery.badgeHeading[props.locale]}</Title>
      <p>{UI_TEXT.gallery.badgeHint[props.locale]}</p>
      <img
        src={badgeImageUrl(props.login)}
        alt={UI_TEXT.gallery.badgeAlt[props.locale](props.login)}
      />
      <Prose>
        <div class={codeBlockClass()}>
          <pre>
            <code>{markdown()}</code>
          </pre>
          <div>
            <CopyButton text={markdown} labels={UI_TEXT.gallery.copyLabels[props.locale]} />
          </div>
        </div>
      </Prose>
    </section>
  );
}
