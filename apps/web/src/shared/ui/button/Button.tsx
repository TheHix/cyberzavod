import { Root as ButtonRoot } from "@kobalte/core/button";
import { splitProps, type JSX } from "solid-js";
import { cx } from "@/shared/lib/cx.ts";
import styles from "./Button.module.css";

/** Button variant: primary (yellow), secondary (light), tileless, or as text inside content. */
export type ButtonVariant = "primary" | "secondary" | "ghost" | "link";

/**
 * Button layout: with text, square for an icon, round, a menu tile with a label, or a tile half
 * a menu row wide, two of which stand side by side.
 */
export type ButtonLayout = "text" | "icon" | "round" | "tile" | "halfTile";

/**
 * Button variant, size and layout, shared by the button and the button-styled link. The names
 * differ from HTML attributes (`<a>` has its own `shape`) so they do not clash in the types.
 */
export interface ButtonLook {
  variant?: ButtonVariant | undefined;
  size?: "medium" | "large" | undefined;
  layout?: ButtonLayout | undefined;
}

const LOOK_KEYS = ["variant", "size", "layout", "class"] as const;

/**
 * Kit button look classes, for elements that cannot be a button or a link,
 * such as the "more" label inside `<summary>`.
 * @param {ButtonLook & { class?: string | undefined }} look Variant, size, layout and own class.
 * @returns {string} Button classes.
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
 * ui-kit button on Kobalte: accessibility and states come from the library, the look is ours.
 * @param {ButtonLook & JSX.ButtonHTMLAttributes<HTMLButtonElement>} props Button look and
 * attributes.
 * @returns {JSX.Element} Button.
 */
export function Button(
  props: ButtonLook & JSX.ButtonHTMLAttributes<HTMLButtonElement>,
): JSX.Element {
  const [look, rest] = splitProps(props, LOOK_KEYS);

  return <ButtonRoot type="button" {...rest} class={buttonClass(look)} />;
}

/**
 * A link that looks like a ui-kit button.
 * @param {ButtonLook & JSX.AnchorHTMLAttributes<HTMLAnchorElement>} props Link look and attributes.
 * @returns {JSX.Element} Link.
 */
export function ButtonLink(
  props: ButtonLook & JSX.AnchorHTMLAttributes<HTMLAnchorElement>,
): JSX.Element {
  const [look, rest] = splitProps(props, LOOK_KEYS);

  return <a {...rest} class={buttonClass(look)} />;
}
