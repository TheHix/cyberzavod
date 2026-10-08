import { For, type JSX } from "solid-js";
import { Chip } from "../chip/Chip.tsx";
import styles from "./ChipList.module.css";

interface Props {
  items: readonly string[];
}

/**
 * Справочные метки ui-kit строкой с переносом: стек проекта и подобные короткие перечни.
 * @param {Props} props Свойства компонента.
 * @param {readonly string[]} props.items Подписи меток по порядку.
 * @returns {JSX.Element} Список меток.
 */
export function ChipList(props: Props): JSX.Element {
  return (
    <ul class={styles.list}>
      <For each={props.items}>
        {(item) => (
          <li class={styles.item}>
            <Chip>{item}</Chip>
          </li>
        )}
      </For>
    </ul>
  );
}
