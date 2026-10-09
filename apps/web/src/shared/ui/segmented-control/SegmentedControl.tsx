import * as ToggleGroup from "@kobalte/core/toggle-group";
import { For, type JSX } from "solid-js";
import styles from "./SegmentedControl.module.css";

/** A choice option: the value and the label on the button. */
export interface SegmentOption<T extends string> {
  readonly value: T;
  readonly label: string;
}

interface Props<T extends string> {
  /** Group label for screen readers. */
  label: string;
  options: readonly SegmentOption<T>[];
  value: T;
  disabled?: boolean;
  onChange: (value: T) => void;
}

/**
 * A switch of several buttons with exactly one always selected, built on Kobalte's ToggleGroup.
 * @template T
 * @param {Props<T>} props Component props.
 * @param {string} props.label Group label.
 * @param {readonly SegmentOption<T>[]} props.options Options in order.
 * @param {T} props.value Selected value.
 * @param {boolean} [props.disabled] Whether it is disabled.
 * @param {(value: T) => void} props.onChange Called when another option is chosen.
 * @returns {JSX.Element} Switch.
 */
export function SegmentedControl<T extends string>(props: Props<T>): JSX.Element {
  // Clicking the selected option again clears the selection, but this switch always has one.
  const choose = (value: string | null) => {
    const option = props.options.find((candidate) => candidate.value === value);

    if (option !== undefined) props.onChange(option.value);
  };

  return (
    <ToggleGroup.Root
      class={styles.group}
      aria-label={props.label}
      value={props.value}
      disabled={props.disabled ?? false}
      onChange={choose}
    >
      <For each={props.options}>
        {(option) => (
          <ToggleGroup.Item class={styles.item} value={option.value}>
            {option.label}
          </ToggleGroup.Item>
        )}
      </For>
    </ToggleGroup.Root>
  );
}
