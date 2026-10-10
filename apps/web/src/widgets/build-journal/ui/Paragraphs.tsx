import { For, type JSX } from "solid-js";
import { paragraphsOf } from "@/entities/message";
import styles from "./Paragraphs.module.css";

interface Props {
  /** Full text: paragraphs are separated by a blank line. */
  text: string;
  /** Recording language: texts are not translated and carry their own `lang`. */
  language: string;
}

/**
 * The full text of a message, an intervention or a stage's words at a rework, in paragraphs. The
 * one place that decides how such a text looks in the journal; static markup without state.
 * @param {Props} props Component props.
 * @param {string} props.text Full text.
 * @param {string} props.language Recording language.
 * @returns {JSX.Element} Text paragraphs.
 */
export function Paragraphs(props: Props): JSX.Element {
  return (
    <div class={styles.text} lang={props.language}>
      <For each={paragraphsOf(props.text)}>{(paragraph) => <p>{paragraph}</p>}</For>
    </div>
  );
}
