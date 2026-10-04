import type { JSX } from "solid-js";
import { cx } from "@/shared/lib/cx.ts";
import styles from "./Card.module.css";

interface Props {
  class?: string | undefined;
  children: JSX.Element;
}

/**
 * Карточка ui-kit внутри панели: запись в списке, промпт в журнале.
 * @param {Props} props Свойства компонента.
 * @param {string} [props.class] Дополнительный класс для раскладки снаружи.
 * @param {JSX.Element} props.children Содержимое.
 * @returns {JSX.Element} Карточка.
 */
export function Card(props: Props): JSX.Element {
  return <div class={cx(styles.card, props.class)}>{props.children}</div>;
}
