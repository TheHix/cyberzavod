import type { JSX } from "solid-js";
import type { Locale } from "@/shared/i18n/locale.ts";
import { UI_TEXT } from "@/shared/i18n/ui-text.ts";
import { CopyableCode, Title } from "@/shared/ui";
import { badgeImageUrl, badgeMarkdown } from "../model/url.ts";
import styles from "./ReadmeBadge.module.css";

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
 * галерею, с кнопкой «копировать». Его показывают галерея автора и личный кабинет.
 * @param {Props} props Свойства компонента.
 * @param {string} props.login Логин автора.
 * @param {string} props.siteUrl Адрес сайта.
 * @param {Locale} props.locale Язык страницы.
 * @returns {JSX.Element} Раздел с бейджем.
 */
export function ReadmeBadge(props: Props): JSX.Element {
  return (
    <section class={styles.badge}>
      <Title as="h2">{UI_TEXT.gallery.badgeHeading[props.locale]}</Title>
      <p>{UI_TEXT.gallery.badgeHint[props.locale]}</p>
      <img
        src={badgeImageUrl(props.login)}
        alt={UI_TEXT.gallery.badgeAlt[props.locale](props.login)}
      />
      <CopyableCode
        code={badgeMarkdown(props.login, props.siteUrl)}
        labels={UI_TEXT.gallery.copyLabels[props.locale]}
      />
    </section>
  );
}
