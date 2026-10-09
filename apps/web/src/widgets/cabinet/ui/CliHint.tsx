import type { JSX } from "solid-js";
import type { Locale } from "@/shared/i18n/locale.ts";
import { UI_TEXT } from "@/shared/i18n/ui-text.ts";
import { CopyableCode, Title } from "@/shared/ui";
import styles from "./CabinetBoard.module.css";

/** Command that sends a recording from the project journal to the gallery. */
const SHARE_COMMAND = "npx cyberzavod share <id>";
/** CLI sign-in command: the CLI has its own sign-in and does not need the site cookie. */
const LOGIN_COMMAND = "npx cyberzavod login";

interface Props {
  /** Page language. */
  locale: Locale;
}

/**
 * Hint on where recordings come from: the site does not upload them, the CLI sends them from the
 * project.
 * @param {Props} props Component props.
 * @param {Locale} props.locale Page language.
 * @returns {JSX.Element} Section with CLI commands.
 */
export function CliHint(props: Props): JSX.Element {
  return (
    <section class={styles.section}>
      <Title as="h2">{UI_TEXT.cabinet.cliHeading[props.locale]}</Title>
      <p class={styles.note}>{UI_TEXT.cabinet.shareHint[props.locale]}</p>
      <CopyableCode code={SHARE_COMMAND} labels={UI_TEXT.copy.labels[props.locale]} />
      <p class={styles.note}>{UI_TEXT.cabinet.loginHint[props.locale]}</p>
      <CopyableCode code={LOGIN_COMMAND} labels={UI_TEXT.copy.labels[props.locale]} />
    </section>
  );
}
