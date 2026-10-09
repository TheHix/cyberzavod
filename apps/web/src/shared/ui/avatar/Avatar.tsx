import type { JSX } from "solid-js";
import { cx } from "@/shared/lib/cx.ts";
import styles from "./Avatar.module.css";

interface Props {
  /** Image URL. */
  src: string;
  /** Image alt text; empty when the name is already shown next to it. */
  alt: string;
  /** Size: for a menu tile icon or next to a heading. */
  size?: "small" | "large" | undefined;
}

/**
 * ui-kit avatar: a round outlined image, the author's portrait next to their login.
 * @param {Props} props Component props.
 * @param {string} props.src Image URL.
 * @param {string} props.alt Image alt text.
 * @param {"small" | "large"} [props.size] Size; `small` by default.
 * @returns {JSX.Element} Image.
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
