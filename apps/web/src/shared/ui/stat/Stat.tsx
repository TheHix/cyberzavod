import { For, Show, type JSX } from "solid-js";
import { Card } from "../card/Card.tsx";
import styles from "./Stat.module.css";

/** Счётчик: подпись, значение и, если нужно, пояснение к нему мелким текстом. */
export interface StatItem {
  readonly label: string;
  readonly value: string;
  /** Пояснение под значением: «без возвратов 4 из 7». Переносится, если не помещается. */
  readonly detail?: string | undefined;
}

interface Props {
  items: readonly StatItem[];
}

/**
 * Счётчики ui-kit плашками в две колонки, в узком месте — в одну: «Время», «Токены» и т. п.; у
 * счётчика может быть пояснение под значением.
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
            <Show when={item.detail}>{(detail) => <dd class={styles.detail}>{detail()}</dd>}</Show>
          </Card>
        )}
      </For>
    </dl>
  );
}
