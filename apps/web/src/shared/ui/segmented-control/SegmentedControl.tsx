import * as ToggleGroup from "@kobalte/core/toggle-group";
import { For, type JSX } from "solid-js";
import styles from "./SegmentedControl.module.css";

/** Вариант выбора: значение и подпись на кнопке. */
export interface SegmentOption<T extends string> {
  readonly value: T;
  readonly label: string;
}

interface Props<T extends string> {
  /** Подпись группы для программ чтения с экрана. */
  label: string;
  options: readonly SegmentOption<T>[];
  value: T;
  disabled?: boolean;
  onChange: (value: T) => void;
}

/**
 * Переключатель из нескольких кнопок, выбрана всегда одна, — на ToggleGroup из Kobalte.
 * @template T
 * @param {Props<T>} props Свойства компонента.
 * @param {string} props.label Подпись группы.
 * @param {readonly SegmentOption<T>[]} props.options Варианты по порядку.
 * @param {T} props.value Выбранное значение.
 * @param {boolean} [props.disabled] Выключен ли.
 * @param {(value: T) => void} props.onChange Вызывается при выборе другого варианта.
 * @returns {JSX.Element} Переключатель.
 */
export function SegmentedControl<T extends string>(props: Props<T>): JSX.Element {
  // Повторное нажатие на выбранный вариант снимает выбор — у переключателя он всегда есть.
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
