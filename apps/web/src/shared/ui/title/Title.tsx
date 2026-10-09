import type { JSX } from "solid-js";
import { Dynamic } from "solid-js/web";
import { cx } from "@/shared/lib/cx.ts";
import styles from "./Title.module.css";

interface Props {
  /** Element: a heading of the needed level or inline text inside a link and `<summary>`. */
  as?: "h1" | "h2" | "h3" | "p" | "span" | undefined;
  size?: "m" | "l" | "xl" | undefined;
  /** How many lines the text takes: a fixed-height block, the rest is clipped. */
  lines?: number | undefined;
  class?: string | undefined;
  /** Text language when it differs from the page language: for example, an original recording. */
  lang?: string | undefined;
  children: JSX.Element;
}

/**
 * ui-kit title in a dense font: a build name, the main instruction of a prompt.
 * @param {Props} props Component props.
 * @param {"h1" | "h2" | "h3" | "p" | "span"} [props.as] Element; `p` by default.
 * @param {"m" | "l" | "xl"} [props.size] Size; `l` by default.
 * @param {number} [props.lines] Number of lines of fixed height; without it the text grows as is.
 * @param {string} [props.class] Extra class for layout from outside.
 * @param {string} [props.lang] Text language when it differs from the page language.
 * @param {JSX.Element} props.children Text.
 * @returns {JSX.Element} Title.
 */
export function Title(props: Props): JSX.Element {
  return (
    <Dynamic
      component={props.as ?? "p"}
      class={cx(
        styles.title,
        styles[props.size ?? "l"],
        props.lines !== undefined && styles.clamped,
        props.class,
      )}
      style={props.lines === undefined ? undefined : { "--lines": props.lines }}
      lang={props.lang}
    >
      {props.children}
    </Dynamic>
  );
}
