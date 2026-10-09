import { For, type JSX } from "solid-js";
import styles from "./BarList.module.css";

/** Chart row: a label, the number for the bar length, and the same number as page-language text. */
export interface BarItem {
  readonly label: string;
  readonly value: number;
  /** The number formatted for the page language. */
  readonly valueText: string;
}

interface Props {
  items: readonly BarItem[];
}

/**
 * ui-kit horizontal CSS bar chart: each row's bar is its share of the largest one. The numbers
 * are written as text beside them, and the bars are hidden from screen readers.
 * @param {Props} props Component props.
 * @param {readonly BarItem[]} props.items Chart rows.
 * @returns {JSX.Element} List of rows with bars.
 */
export function BarList(props: Props): JSX.Element {
  const largest = () => Math.max(0, ...props.items.map((item) => item.value));
  const shareOf = (value: number) => (largest() === 0 ? 0 : value / largest());

  return (
    <ul class={styles.list}>
      <For each={props.items}>
        {(item) => (
          <li class={styles.row}>
            <span class={styles.label}>{item.label}</span>
            <span class={styles.track} aria-hidden="true">
              <span class={styles.bar} style={{ "--share": shareOf(item.value) }} />
            </span>
            <span class={styles.value}>{item.valueText}</span>
          </li>
        )}
      </For>
    </ul>
  );
}
