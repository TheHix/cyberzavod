import { For, type JSX } from "solid-js";
import styles from "./BarList.module.css";

/** Строка диаграммы: подпись, число для длины полосы и оно же текстом на языке страницы. */
export interface BarItem {
  readonly label: string;
  readonly value: number;
  /** Число, отформатированное по языку страницы. */
  readonly valueText: string;
}

interface Props {
  items: readonly BarItem[];
}

/**
 * Горизонтальная диаграмма ui-kit на CSS: полоса каждой строки — доля от наибольшей. Числа
 * написаны текстом рядом, полосы скрыты от программ чтения.
 * @param {Props} props Свойства компонента.
 * @param {readonly BarItem[]} props.items Строки диаграммы.
 * @returns {JSX.Element} Список строк с полосами.
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
