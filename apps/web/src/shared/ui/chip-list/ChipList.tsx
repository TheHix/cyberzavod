import { For, type JSX } from "solid-js";
import { Chip } from "../chip/Chip.tsx";
import styles from "./ChipList.module.css";

interface Props {
  items: readonly string[];
}

/**
 * ui-kit reference chips in a wrapping row: the project stack and similar short lists.
 * @param {Props} props Component props.
 * @param {readonly string[]} props.items Chip labels in order.
 * @returns {JSX.Element} Chip list.
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
