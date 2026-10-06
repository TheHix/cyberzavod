import { Root as ButtonRoot } from "@kobalte/core/button";
import { splitProps, type JSX } from "solid-js";
import { cx } from "@/shared/lib/cx.ts";
import styles from "./Button.module.css";

/** Вид кнопки: главная (жёлтая), обычная (светлая), без плашки или текстом внутри содержимого. */
export type ButtonVariant = "primary" | "secondary" | "ghost" | "link";

/**
 * Раскладка кнопки: с текстом, квадратная под иконку, круглая, плитка меню с подписью или плитка
 * на половину строки меню — две такие стоят в ряд.
 */
export type ButtonLayout = "text" | "icon" | "round" | "tile" | "halfTile";

/**
 * Вид, размер и раскладка кнопки — общие для кнопки и ссылки-кнопки. Имена не совпадают
 * с атрибутами HTML (у `<a>` есть свой `shape`), чтобы не пересекаться с ними в типах.
 */
export interface ButtonLook {
  variant?: ButtonVariant | undefined;
  size?: "medium" | "large" | undefined;
  layout?: ButtonLayout | undefined;
}

const LOOK_KEYS = ["variant", "size", "layout", "class"] as const;

/**
 * Классы вида кнопки kit — для элементов, которые не могут быть кнопкой или ссылкой,
 * например подписи «подробнее» внутри `<summary>`.
 * @param {ButtonLook & { class?: string | undefined }} look Вид, размер, раскладка и свой класс.
 * @returns {string} Классы кнопки.
 */
export function buttonClass(look: ButtonLook & { class?: string | undefined }): string {
  return cx(
    styles.button,
    styles[look.variant ?? "secondary"],
    look.size === "large" && styles.large,
    look.layout === "icon" && styles.icon,
    look.layout === "round" && cx(styles.icon, styles.round),
    look.layout === "tile" && styles.tile,
    look.layout === "halfTile" && cx(styles.tile, styles.halfTile),
    look.class,
  );
}

/**
 * Кнопка ui-kit на Kobalte: доступность и состояния — от библиотеки, вид — наш.
 * @param {ButtonLook & JSX.ButtonHTMLAttributes<HTMLButtonElement>} props Вид кнопки и атрибуты.
 * @returns {JSX.Element} Кнопка.
 */
export function Button(
  props: ButtonLook & JSX.ButtonHTMLAttributes<HTMLButtonElement>,
): JSX.Element {
  const [look, rest] = splitProps(props, LOOK_KEYS);
  return <ButtonRoot type="button" {...rest} class={buttonClass(look)} />;
}

/**
 * Ссылка, которая выглядит как кнопка ui-kit.
 * @param {ButtonLook & JSX.AnchorHTMLAttributes<HTMLAnchorElement>} props Вид и атрибуты ссылки.
 * @returns {JSX.Element} Ссылка.
 */
export function ButtonLink(
  props: ButtonLook & JSX.AnchorHTMLAttributes<HTMLAnchorElement>,
): JSX.Element {
  const [look, rest] = splitProps(props, LOOK_KEYS);
  return <a {...rest} class={buttonClass(look)} />;
}
