import { For, type JSX } from "solid-js";
import { cx } from "@/shared/lib/cx.ts";
import { plaqueArt, plaqueRuns } from "@/shared/lib/pixel-plaque.ts";
import styles from "./PixelPlaque.module.css";

interface Props {
  lines: readonly string[];
  class?: string | undefined;
}

/**
 * ui-kit pixel plaque: a label in the same font and frame as the machine plaques on the factory
 * floor. The image means nothing to screen readers; the wrapper provides the label.
 * The pixel size is set by `--plaque-pixel` from outside, in whole CSS pixels, so edges stay crisp.
 * @param {Props} props Component props.
 * @param {readonly string[]} props.lines Label lines; lowercase letters become uppercase.
 * @param {string} [props.class] Extra class for layout from outside.
 * @returns {JSX.Element} SVG plaque.
 */
export function PixelPlaque(props: Props): JSX.Element {
  const art = () => plaqueArt(props.lines);
  const width = () => art()[0]?.length ?? 0;
  const height = () => art().length;

  return (
    <svg
      class={cx(styles.plaque, props.class)}
      style={{ "--plaque-width": width(), "--plaque-height": height() }}
      viewBox={`0 0 ${String(width())} ${String(height())}`}
      shape-rendering="crispEdges"
      aria-hidden="true"
    >
      <For each={plaqueRuns(art())}>
        {(run) => <rect class={styles[run.ink]} x={run.x} y={run.y} width={run.width} height={1} />}
      </For>
    </svg>
  );
}
