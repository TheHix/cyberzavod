import { For, type JSX } from "solid-js";
import { paragraphsOf } from "@/entities/message";
import { Title } from "@/shared/ui";
import styles from "./SpokenText.module.css";

interface Props {
  /** Строка, которую говорящий произносит над станком. */
  line: string;
  /** Полный текст: абзацы разделены пустой строкой. */
  text: string;
  /** Язык записи: тексты не переводятся и несут свой `lang`. */
  language: string;
}

/**
 * Реплика или вмешательство в журнале: строка из цеха и полный текст абзацами.
 * @param {Props} props Свойства компонента.
 * @param {string} props.line Строка над говорящим.
 * @param {string} props.text Полный текст.
 * @param {string} props.language Язык записи.
 * @returns {JSX.Element} Строка и абзацы текста.
 */
export function SpokenText(props: Props): JSX.Element {
  return (
    <>
      <Title lang={props.language}>{props.line}</Title>
      <div class={styles.text} lang={props.language}>
        <For each={paragraphsOf(props.text)}>{(paragraph) => <p>{paragraph}</p>}</For>
      </div>
    </>
  );
}
