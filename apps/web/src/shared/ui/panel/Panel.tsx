import { Show, type JSX } from "solid-js";
import { cx } from "@/shared/lib/cx.ts";
import styles from "./Panel.module.css";

interface Props {
  /** Ярлык над содержимым: «Сборка», «Журнал». */
  label?: string | undefined;
  /** Прокручивать ли содержимое внутри панели, когда оно не помещается в отведённую высоту. */
  scrollable?: boolean | undefined;
  class?: string | undefined;
  children: JSX.Element;
}

/**
 * Панель ui-kit — светлая плашка с контуром, в ней собирается интерфейс поверх цеха.
 * @param {Props} props Свойства компонента.
 * @param {string} [props.label] Ярлык над содержимым.
 * @param {boolean} [props.scrollable] Прокручивать содержимое внутри панели.
 * @param {string} [props.class] Дополнительный класс для раскладки снаружи.
 * @param {JSX.Element} props.children Содержимое.
 * @returns {JSX.Element} Панель.
 */
export function Panel(props: Props): JSX.Element {
  return (
    <section class={cx(styles.panel, props.scrollable && styles.scrollable, props.class)}>
      <Show when={props.label}>{(label) => <span class={styles.label}>{label()}</span>}</Show>
      {props.children}
    </section>
  );
}
