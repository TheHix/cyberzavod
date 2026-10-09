import type { JSX } from "solid-js";
import { cx } from "@/shared/lib/cx.ts";
import styles from "./Prose.module.css";

interface Props {
  /** Container id: islands find the text by it, for example to add buttons to code blocks. */
  id?: string | undefined;
  class?: string | undefined;
  children: JSX.Element;
}

/**
 * Look of a code block with room for a button: a wrapper that holds `<pre>` and an action button
 * next to it. Without the wrapper `<pre>` looks the same, just without a button.
 * @returns {string} Code block wrapper class.
 */
export function codeBlockClass(): string {
  return cx(styles.codeBlock);
}

/**
 * ui-kit article text container: styles second- and third-level headings, paragraphs, lists,
 * links, code, quotes and rules that arrive as ready-made markup, for example from Markdown.
 * Static: does nothing on its own.
 * @param {Props} props Component props.
 * @param {string} [props.id] Container id.
 * @param {string} [props.class] Extra class for layout from outside.
 * @param {JSX.Element} props.children Article text.
 * @returns {JSX.Element} Text container.
 */
export function Prose(props: Props): JSX.Element {
  return (
    <div id={props.id} class={cx(styles.prose, props.class)}>
      {props.children}
    </div>
  );
}
