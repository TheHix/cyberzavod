import { For, type JSX } from "solid-js";
import { cx } from "@/shared/lib/cx.ts";
import styles from "./BulletList.module.css";

interface Props {
  items: readonly string[];
  class?: string | undefined;
  /** Язык пунктов, если он не совпадает с языком страницы. */
  lang?: string | undefined;
}

/**
 * Список ui-kit с яркими маркерами: уточнения промпта и подобные перечни.
 * @param {Props} props Свойства компонента.
 * @param {readonly string[]} props.items Пункты по порядку.
 * @param {string} [props.class] Дополнительный класс для раскладки снаружи.
 * @param {string} [props.lang] Язык пунктов, если он не совпадает с языком страницы.
 * @returns {JSX.Element} Маркированный список.
 */
export function BulletList(props: Props): JSX.Element {
  return (
    <ul class={cx(styles.list, props.class)} lang={props.lang}>
      <For each={props.items}>{(item) => <li>{item}</li>}</For>
    </ul>
  );
}
