import { createMemo, createSignal, onCleanup, Show, type JSX } from "solid-js";
import type { Point } from "@cyberzavod/player";
import { ScrollArea } from "@/shared/ui";
import type { FactoryGraphics, Frame } from "../graphics/factory-graphics.ts";
import { bubbleLeftOf, placeBubble } from "../lib/bubble-placement.ts";
import styles from "./SpeechBubble.module.css";

interface Props {
  /** Factory graphics: converts a plan point to floor coordinates; absent until loaded. */
  graphics: FactoryGraphics | undefined;
  /** Floor field free of the menu and HUD: the bubble does not go past its edges. */
  field: Frame;
  /** Plan point above the speaker; absent if the speaker was not found. */
  position: Point | null;
  /** Label, text and expanded details: when the bubble is cramped, they scroll. */
  children: JSX.Element;
  /** Buttons below the text: they are always visible. */
  actions: JSX.Element;
}

/**
 * A bubble over a factory point: the frame and placement shared by a prompt, intervention and
 * message. Opens vertically toward where there is more room to the field edge, horizontally stays
 * centered over the speaker and shifts into the field at the edge; no wider than the field and no
 * taller than the room to its edge, and cramped text scrolls inside.
 * @param {Props} props Component props.
 * @param {FactoryGraphics | undefined} props.graphics Factory graphics, if already loaded.
 * @param {Frame} props.field Floor field free of the menu and HUD.
 * @param {Point | null} props.position Plan point above the speaker.
 * @param {JSX.Element} props.children Label, text and expanded details.
 * @param {JSX.Element} props.actions Buttons below the text.
 * @returns {JSX.Element} The bubble, or nothing while it is unknown where to place it.
 */
export function SpeechBubble(props: Props): JSX.Element {
  // The text sets the bubble width, so the shift into the field is computed from a measurement, not
  // in advance.
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
