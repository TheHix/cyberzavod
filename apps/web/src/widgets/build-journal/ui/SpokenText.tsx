import { For, type JSX } from "solid-js";
import { paragraphsOf } from "@/entities/message";
import { Title } from "@/shared/ui";
import styles from "./SpokenText.module.css";

interface Props {
  /** The line the speaker says above the machine. */
  line: string;
  /** Full text: paragraphs are separated by a blank line. */
  text: string;
  /** Recording language: texts are not translated and carry their own `lang`. */
  language: string;
}

/**
 * A message or intervention in the journal: the line from the floor and the full text in
 * paragraphs.
 * @param {Props} props Component props.
 * @param {string} props.line Line above the speaker.
 * @param {string} props.text Full text.
 * @param {string} props.language Recording language.
 * @returns {JSX.Element} The line and text paragraphs.
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
