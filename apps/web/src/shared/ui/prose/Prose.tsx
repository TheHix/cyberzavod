import type { JSX } from "solid-js";
import { cx } from "@/shared/lib/cx.ts";
import styles from "./Prose.module.css";

interface Props {
  /** id контейнера: по нему островки находят текст, например чтобы добавить кнопки блокам кода. */
  id?: string | undefined;
  class?: string | undefined;
  children: JSX.Element;
}

/**
 * Вид блока кода с местом под кнопку: обёртка, в которую встаёт `<pre>` и кнопка действия
 * рядом с ним. Без обёртки `<pre>` выглядит так же, просто без кнопки.
 * @returns {string} Класс обёртки блока кода.
 */
export function codeBlockClass(): string {
  return cx(styles.codeBlock);
}

/**
 * Контейнер текста статьи ui-kit: оформляет заголовки второго и третьего уровня, абзацы, списки,
 * ссылки, код, цитаты и разделители, которые приходят готовой разметкой, например из Markdown.
 * Статичный: ничего не делает сам.
 * @param {Props} props Свойства компонента.
 * @param {string} [props.id] id контейнера.
 * @param {string} [props.class] Дополнительный класс для раскладки снаружи.
 * @param {JSX.Element} props.children Текст статьи.
 * @returns {JSX.Element} Контейнер текста.
 */
export function Prose(props: Props): JSX.Element {
  return (
    <div id={props.id} class={cx(styles.prose, props.class)}>
      {props.children}
    </div>
  );
}
