import type { JSX } from "solid-js";
import type { Locale } from "@/shared/i18n/locale.ts";
import { UI_TEXT } from "@/shared/i18n/ui-text.ts";
import { CopyableCode, Title } from "@/shared/ui";
import { badgeImageUrl, badgeMarkdown } from "../model/url.ts";
import styles from "./ReadmeBadge.module.css";

interface Props {
  /** Login of the public gallery's author. */
  login: string;
  /** Site address, `site` from the Astro config: the Markdown line lives in another's README. */
  siteUrl: string;
  /** Page language. */
  locale: Locale;
}

/**
 * The "Built at Cyberzavod" badge for a README: the image from the API and a Markdown line linking
 * to the gallery, with a "copy" button. Shown by the author's gallery and the account page.
 * @param {Props} props Component props.
 * @param {string} props.login Author login.
 * @param {string} props.siteUrl Site address.
 * @param {Locale} props.locale Page language.
 * @returns {JSX.Element} Section with the badge.
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
