import ChevronRight from "lucide-solid/icons/chevron-right";
import type { JSX } from "solid-js";
import styles from "./Disclosure.module.css";

const ICON_STROKE = 3;

interface Props {
  /**
   * Header: always visible; clicking it collapses and expands the content. From `.astro` it comes
   * through the `summary` slot, so it is optional for the types.
   */
  summary?: JSX.Element;
  /** Whether the block is expanded until someone collapses it. */
  open?: boolean | undefined;
  children: JSX.Element;
}

/**
 * ui-kit collapsible block on native `<details>` and `<summary>`: collapses without JS or an
 * island; keyboard and screen reader state come from the browser. The arrow by the header
 * turns when the block is expanded.
 * @param {Props} props Component props.
 * @param {JSX.Element} [props.summary] Block header: inline content, no links or buttons.
 * @param {boolean} [props.open] Whether the block starts expanded; collapsed by default.
 * @param {JSX.Element} props.children Content that collapses.
 * @returns {JSX.Element} Collapsible block.
 */
export function Disclosure(props: Props): JSX.Element {
  return (
    <details class={styles.disclosure} open={props.open}>
      <summary class={styles.summary}>
        <span class={styles.marker} aria-hidden="true">
          <ChevronRight stroke-width={ICON_STROKE} />
        </span>
        <span class={styles.heading}>{props.summary}</span>
      </summary>
      <div class={styles.body}>{props.children}</div>
    </details>
  );
}
