import { For, type JSX } from "solid-js";
import { cx } from "@/shared/lib/cx.ts";
import { plaqueArt, plaqueRuns } from "@/shared/lib/pixel-plaque.ts";
import styles from "./PixelPlaque.module.css";

interface Props {
  lines: readonly string[];
  class?: string | undefined;
}

/**
 * Пиксельная табличка ui-kit: надпись тем же шрифтом и в той же рамке, что таблички станков
 * в цехе. Картинка без смысла для программ чтения — подпись даёт обёртка.
 * Размер пикселя задаёт `--plaque-pixel` снаружи, целым числом CSS-пикселей, чтобы края были чёткими.
 * @param {Props} props Свойства компонента.
 * @param {readonly string[]} props.lines Строки надписи; строчные буквы становятся заглавными.
 * @param {string} [props.class] Дополнительный класс для раскладки снаружи.
 * @returns {JSX.Element} Табличка в SVG.
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
