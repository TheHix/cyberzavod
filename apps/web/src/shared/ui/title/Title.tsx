import type { JSX } from "solid-js";
import { Dynamic } from "solid-js/web";
import { cx } from "@/shared/lib/cx.ts";
import styles from "./Title.module.css";

interface Props {
  /** Элемент: заголовок нужного уровня или строчный текст внутри ссылки и `<summary>`. */
  as?: "h1" | "h2" | "h3" | "p" | "span" | undefined;
  size?: "m" | "l" | "xl" | undefined;
  class?: string | undefined;
  children: JSX.Element;
}

/**
 * Заголовок ui-kit плотным шрифтом: название сборки, главное указание промпта.
 * @param {Props} props Свойства компонента.
 * @param {"h1" | "h2" | "h3" | "p" | "span"} [props.as] Элемент; по умолчанию `p`.
 * @param {"m" | "l" | "xl"} [props.size] Размер; по умолчанию `l`.
 * @param {string} [props.class] Дополнительный класс для раскладки снаружи.
 * @param {JSX.Element} props.children Текст.
 * @returns {JSX.Element} Заголовок.
 */
export function Title(props: Props): JSX.Element {
  return (
    <Dynamic
      component={props.as ?? "p"}
      class={cx(styles.title, styles[props.size ?? "l"], props.class)}
    >
      {props.children}
    </Dynamic>
  );
}
