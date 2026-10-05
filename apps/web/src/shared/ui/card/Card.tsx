import type { JSX } from "solid-js";
import { cx } from "@/shared/lib/cx.ts";
import styles from "./Card.module.css";

interface Props {
  class?: string | undefined;
  current?: boolean | undefined;
  children: JSX.Element;
}

/**
 * Карточка ui-kit внутри панели: запись в списке, промпт в журнале. Текущая карточка списка
 * выделена, например запись журнала, до которой дошёл цех.
 * @param {Props} props Свойства компонента.
 * @param {string} [props.class] Дополнительный класс для раскладки снаружи.
 * @param {boolean} [props.current] Текущая ли карточка списка: ставит `aria-current` и выделяет её.
 * @param {JSX.Element} props.children Содержимое.
 * @returns {JSX.Element} Карточка.
 */
export function Card(props: Props): JSX.Element {
  return (
    <div class={cx(styles.card, props.class)} aria-current={props.current ? "true" : undefined}>
      {props.children}
    </div>
  );
}
