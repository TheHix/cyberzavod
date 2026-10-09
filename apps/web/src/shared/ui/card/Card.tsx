import type { JSX } from "solid-js";
import { cx } from "@/shared/lib/cx.ts";
import styles from "./Card.module.css";

interface Props {
  class?: string | undefined;
  current?: boolean | undefined;
  children: JSX.Element;
}

/**
 * ui-kit card inside a panel: a recording in a list, a prompt in the journal. The current card in
 * a list is highlighted, for example the journal entry the factory floor has reached.
 * @param {Props} props Component props.
 * @param {string} [props.class] Extra class for layout from outside.
 * @param {boolean} [props.current] Whether this is the current list card: sets `aria-current`
 * and highlights it.
 * @param {JSX.Element} props.children Content.
 * @returns {JSX.Element} Card.
 */
export function Card(props: Props): JSX.Element {
  return (
    <div class={cx(styles.card, props.class)} aria-current={props.current ? "true" : undefined}>
      {props.children}
    </div>
  );
}
