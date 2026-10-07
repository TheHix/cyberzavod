import type { JSX } from "solid-js";
import { cx } from "@/shared/lib/cx.ts";
import styles from "./Avatar.module.css";

interface Props {
  /** Адрес картинки. */
  src: string;
  /** Подпись картинки; пустая, если рядом и так стоит имя. */
  alt: string;
  /** Размер: под иконку плитки меню или рядом с заголовком. */
  size?: "small" | "large" | undefined;
}

/**
 * Аватар ui-kit: круглая картинка в контуре — портрет автора рядом с его логином.
 * @param {Props} props Свойства компонента.
 * @param {string} props.src Адрес картинки.
 * @param {string} props.alt Подпись картинки.
 * @param {"small" | "large"} [props.size] Размер; по умолчанию `small`.
 * @returns {JSX.Element} Картинка.
 */
export function Avatar(props: Props): JSX.Element {
  return (
    <img
      class={cx(styles.avatar, styles[props.size ?? "small"])}
      src={props.src}
      alt={props.alt}
      decoding="async"
    />
  );
}
