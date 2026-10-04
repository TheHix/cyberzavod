import type { JSX } from "solid-js";
import { cx } from "@/shared/lib/cx.ts";
import styles from "./Chip.module.css";

/** Цвет метки: жёлтая — главное, голубая — кто кому пишет, светлая — справочное. */
export type ChipTone = "sun" | "sky" | "paper";

interface Props {
  tone?: ChipTone | undefined;
  class?: string | undefined;
  children: JSX.Element;
}

/**
 * Метка-таблетка ui-kit: короткий ярлык рядом с содержимым.
 * @param {Props} props Свойства компонента.
 * @param {ChipTone} [props.tone] Цвет метки; по умолчанию светлая.
 * @param {string} [props.class] Дополнительный класс для раскладки снаружи.
 * @param {JSX.Element} props.children Текст метки.
 * @returns {JSX.Element} Метка.
 */
export function Chip(props: Props): JSX.Element {
  return (
    <span class={cx(styles.chip, styles[props.tone ?? "paper"], props.class)}>
      {props.children}
    </span>
  );
}
