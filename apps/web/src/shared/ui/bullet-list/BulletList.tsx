import { For, type JSX } from "solid-js";
import { cx } from "@/shared/lib/cx.ts";
import styles from "./BulletList.module.css";

interface Props {
  items: readonly string[];
  class?: string | undefined;
  /** Language of the items when it differs from the page language. */
  lang?: string | undefined;
}

/**
 * ui-kit list with bright bullets: prompt refinements and similar lists.
 * @param {Props} props Component props.
 * @param {readonly string[]} props.items Items in order.
 * @param {string} [props.class] Extra class for layout from outside.
 * @param {string} [props.lang] Language of the items when it differs from the page language.
 * @returns {JSX.Element} Bulleted list.
 */
export function BulletList(props: Props): JSX.Element {
  return (
    <ul class={cx(styles.list, props.class)} lang={props.lang}>
      <For each={props.items}>{(item) => <li>{item}</li>}</For>
    </ul>
  );
}
