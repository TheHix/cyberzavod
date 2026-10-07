import type { JSX } from "solid-js";
import type { Locale } from "@/shared/i18n/locale.ts";
import { UI_TEXT } from "@/shared/i18n/ui-text.ts";
import { CopyableCode, Title } from "@/shared/ui";
import styles from "./CabinetBoard.module.css";

/** Команда, которой запись из журнала проекта уходит в галерею. */
const SHARE_COMMAND = "npx cyberzavod share <id>";
/** Команда входа в CLI: у CLI свой вход, кука сайта ему не нужна. */
const LOGIN_COMMAND = "npx cyberzavod login";

interface Props {
  /** Язык страницы. */
  locale: Locale;
}

/**
 * Подсказка, откуда берутся записи: сайт их не загружает, их отправляет CLI из проекта.
 * @param {Props} props Свойства компонента.
 * @param {Locale} props.locale Язык страницы.
 * @returns {JSX.Element} Раздел с командами CLI.
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
