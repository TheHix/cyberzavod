import { createMemo, Show, type JSX } from "solid-js";
import type { Point } from "@cyberzavod/player";
import type { FactoryGraphics, Frame } from "../graphics/factory-graphics.ts";
import { placeBubble } from "../lib/bubble-placement.ts";
import styles from "./SpeechBubble.module.css";

interface Props {
  /** Графика цеха — переводит точку плана в координаты пола; нет, пока не загрузилась. */
  graphics: FactoryGraphics | undefined;
  /** Поле цеха, свободное от меню и HUD: пузырь раскрывается к его середине. */
  field: Frame;
  /** Точка плана над говорящим; нет, если говорящего не нашли. */
  position: Point | null;
  children: JSX.Element;
}

/**
 * Пузырь над точкой цеха: рамка и расположение, общие у промпта и реплики. Раскрывается
 * к середине поля, чтобы не уйти за край.
 * @param {Props} props Свойства компонента.
 * @param {FactoryGraphics | undefined} props.graphics Графика цеха, если уже загружена.
 * @param {Frame} props.field Поле цеха, свободное от меню и HUD.
 * @param {Point | null} props.position Точка плана над говорящим.
 * @param {JSX.Element} props.children Содержимое пузыря.
 * @returns {JSX.Element} Пузырь или ничего, пока неизвестно, где его поставить.
 */
export function SpeechBubble(props: Props): JSX.Element {
  const placement = createMemo(() => {
    const point = props.position;
    const graphics = props.graphics;
    if (point === null || graphics === undefined) return null;
    return placeBubble(graphics.toScreen(point), props.field);
  });

  return (
    <Show when={placement()}>
      {(place) => (
        <div
          class={styles.anchor}
          style={{
            transform: `translate(${place().x}px, ${place().y}px)`,
            // Пузырь не шире поля: на узком поле 80vw шире самого поля.
            "--field-width": `${props.field.width}px`,
          }}
          data-vertical={place().vertical}
          data-horizontal={place().horizontal}
        >
          <div class={styles.bubble}>{props.children}</div>
        </div>
      )}
    </Show>
  );
}
