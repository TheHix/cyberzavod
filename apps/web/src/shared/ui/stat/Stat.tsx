import { For, Show, type JSX } from "solid-js";
import { Card } from "../card/Card.tsx";
import styles from "./Stat.module.css";

/** Counter: a label, a value and, when needed, a note on it in small text. */
export interface StatItem {
  readonly label: string;
  readonly value: string;
  /** Note under the value: "no rework 4 of 7". Wraps when it does not fit. */
  readonly detail?: string | undefined;
}

interface Props {
  items: readonly StatItem[];
}

/**
 * ui-kit counters as tiles in two columns, one column in a narrow spot: "Time", "Tokens" and so
 * on; a counter can have a note under its value.
 * @param {Props} props Component props.
 * @param {readonly StatItem[]} props.items Counters in order.
 * @returns {JSX.Element} List of counters.
 */
export function StatList(props: Props): JSX.Element {
  return (
    <dl class={styles.list}>
      <For each={props.items}>
        {(item) => (
          <Card class={styles.stat}>
            <dt class={styles.label}>{item.label}</dt>
            <dd class={styles.value}>{item.value}</dd>
            <Show when={item.detail}>{(detail) => <dd class={styles.detail}>{detail()}</dd>}</Show>
          </Card>
        )}
      </For>
    </dl>
  );
}
