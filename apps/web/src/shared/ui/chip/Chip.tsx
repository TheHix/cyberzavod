import type { JSX } from "solid-js";
import { cx } from "@/shared/lib/cx.ts";
import styles from "./Chip.module.css";

/** Chip color: yellow for the main thing, blue for who writes to whom, light for reference. */
export type ChipTone = "sun" | "sky" | "paper";

interface Props {
  tone?: ChipTone | undefined;
  class?: string | undefined;
  children: JSX.Element;
}

/**
 * ui-kit pill chip: a short label next to content.
 * @param {Props} props Component props.
 * @param {ChipTone} [props.tone] Chip color; light by default.
 * @param {string} [props.class] Extra class for layout from outside.
 * @param {JSX.Element} props.children Chip text.
 * @returns {JSX.Element} Chip.
 */
export function Chip(props: Props): JSX.Element {
  return (
    <span class={cx(styles.chip, styles[props.tone ?? "paper"], props.class)}>
      {props.children}
    </span>
  );
}
