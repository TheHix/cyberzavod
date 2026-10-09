import { Show, type JSX } from "solid-js";
import { cx } from "@/shared/lib/cx.ts";
import styles from "./Panel.module.css";

interface Props {
  /** Label above the content: "Build", "Journal". */
  label?: string | undefined;
  /** Whether to scroll the content inside the panel when it does not fit the given height. */
  scrollable?: boolean | undefined;
  class?: string | undefined;
  children: JSX.Element;
}

/**
 * ui-kit panel: a light outlined tile that holds the interface over the factory floor.
 * @param {Props} props Component props.
 * @param {string} [props.label] Label above the content.
 * @param {boolean} [props.scrollable] Scroll the content inside the panel.
 * @param {string} [props.class] Extra class for layout from outside.
 * @param {JSX.Element} props.children Content.
 * @returns {JSX.Element} Panel.
 */
export function Panel(props: Props): JSX.Element {
  return (
    <section class={cx(styles.panel, props.scrollable && styles.scrollable, props.class)}>
      <Show when={props.label}>{(label) => <span class={styles.label}>{label()}</span>}</Show>
      {props.children}
    </section>
  );
}
