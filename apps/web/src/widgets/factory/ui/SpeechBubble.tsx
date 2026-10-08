import { createMemo, createSignal, onCleanup, Show, type JSX } from "solid-js";
import type { Point } from "@cyberzavod/player";
import { ScrollArea } from "@/shared/ui";
import type { FactoryGraphics, Frame } from "../graphics/factory-graphics.ts";
import { bubbleLeftOf, placeBubble } from "../lib/bubble-placement.ts";
import styles from "./SpeechBubble.module.css";

interface Props {
  /** Графика цеха — переводит точку плана в координаты пола; нет, пока не загрузилась. */
  graphics: FactoryGraphics | undefined;
  /** Поле цеха, свободное от меню и HUD: пузырь не выходит за его края. */
  field: Frame;
  /** Точка плана над говорящим; нет, если говорящего не нашли. */
  position: Point | null;
  /** Метка, текст и раскрытые подробности: когда пузырю тесно, они прокручиваются. */
  children: JSX.Element;
  /** Кнопки под текстом: они видны всегда. */
  actions: JSX.Element;
}

/**
 * Пузырь над точкой цеха: рамка и расположение, общие у промпта, вмешательства и реплики.
 * Раскрывается по высоте туда, где до края поля больше места, по ширине стоит серединой над
 * говорящим и сдвигается внутрь поля у края; не шире поля и не выше места до его края, а текст,
 * которому тесно, прокручивается внутри.
 * @param {Props} props Свойства компонента.
 * @param {FactoryGraphics | undefined} props.graphics Графика цеха, если уже загружена.
 * @param {Frame} props.field Поле цеха, свободное от меню и HUD.
 * @param {Point | null} props.position Точка плана над говорящим.
 * @param {JSX.Element} props.children Метка, текст и раскрытые подробности.
 * @param {JSX.Element} props.actions Кнопки под текстом.
 * @returns {JSX.Element} Пузырь или ничего, пока неизвестно, где его поставить.
 */
export function SpeechBubble(props: Props): JSX.Element {
  // Ширину пузыря задаёт текст, поэтому сдвиг внутрь поля считается по замеру, а не заранее.
  const [bubbleWidth, setBubbleWidth] = createSignal(0);
  const placement = createMemo(() => {
    const point = props.position;
    const graphics = props.graphics;

    if (point === null || graphics === undefined) return null;

    return placeBubble(graphics.toScreen(point), props.field);
  });

  const watchWidth = (bubble: HTMLDivElement) => {
    const resizes = new ResizeObserver(() => setBubbleWidth(bubble.getBoundingClientRect().width));

    resizes.observe(bubble);
    onCleanup(() => resizes.disconnect());
  };

  return (
    <Show when={placement()}>
      {(place) => (
        <div
          class={styles.anchor}
          style={{
            transform: `translate(${place().x}px, ${place().y}px)`,
            "--field-width": `${props.field.width}px`,
            "--room-height": `${place().roomHeight}px`,
            "--bubble-left": `${bubbleLeftOf(place().x, bubbleWidth(), props.field)}px`,
          }}
          data-vertical={place().vertical}
        >
          <div ref={watchWidth} class={styles.bubble}>
            <ScrollArea class={styles.text}>{props.children}</ScrollArea>
            {props.actions}
          </div>
        </div>
      )}
    </Show>
  );
}
