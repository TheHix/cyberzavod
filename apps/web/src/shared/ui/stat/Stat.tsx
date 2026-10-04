import { For, type JSX } from "solid-js";
import { Card } from "../card/Card.tsx";
import styles from "./Stat.module.css";

/** Счётчик: подпись и значение. */
export interface StatItem {
  readonly label: string;
  readonly value: string;
}

interface Props {
  items: readonly StatItem[];
}

/**
 * Счётчики ui-kit плашками в две колонки: «Время», «Токены» и т. п.
 * @param {Props} props Свойства компонента.
 * @param {readonly StatItem[]} props.items Счётчики по порядку.
 * @returns {JSX.Element} Список счётчиков.
 */
export function StatList(props: Props): JSX.Element {
  return (
    <dl class={styles.list}>
      <For each={props.items}>
        {(item) => (
          <Card class={styles.stat}>
            <dt class={styles.label}>{item.label}</dt>
            <dd class={styles.value}>{item.value}</dd>
          </Card>
        )}
      </For>
    </dl>
  );
}
