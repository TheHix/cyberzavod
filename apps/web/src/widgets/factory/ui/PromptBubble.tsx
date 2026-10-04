import { createMemo, For, Show, type JSX } from "solid-js";
import { recipientOf } from "@/entities/prompt";
import { useStoreValue } from "@/shared/lib/use-store-value.ts";
import type { FactoryGraphics } from "../graphics/factory-graphics.ts";
import { placeBubble, type FloorSize } from "../lib/bubble-placement.ts";
import { useFactoryModel } from "./model-context.ts";
import styles from "./PromptBubble.module.css";

interface Props {
  /** Графика цеха — переводит место рабочего в координаты пола; нет, пока не загрузилась. */
  graphics: FactoryGraphics | undefined;
  floor: FloorSize;
}

/**
 * Промпт над рабочим, который его получил: кому, главное указание и раскрываемые уточнения.
 * @param {Props} props Свойства компонента.
 * @param {FactoryGraphics | undefined} props.graphics Графика цеха, если уже загружена.
 * @param {FloorSize} props.floor Размер пола цеха.
 * @returns {JSX.Element} Пузырь промпта или ничего, если промпта нет.
 */
export function PromptBubble(props: Props): JSX.Element {
  const model = useFactoryModel();
  const cue = useStoreValue(model.$prompt);
  const position = useStoreValue(model.$promptPosition);
  const detailsOpen = useStoreValue(model.$promptDetailsOpen);

  const placement = createMemo(() => {
    const point = position();
    const graphics = props.graphics;
    if (point === null || graphics === undefined) return null;
    return placeBubble(graphics.toScreen(point), props.floor);
  });

  return (
    <Show when={cue()}>
      {(current) => (
        <Show when={placement()}>
          {(place) => (
            <div
              class={styles.anchor}
              style={{ transform: `translate(${place().x}px, ${place().y}px)` }}
              data-vertical={place().vertical}
              data-horizontal={place().horizontal}
            >
              <div class={styles.bubble}>
                <p class={styles.route}>человек → {recipientOf(current().prompt)}</p>
                <p class={styles.goal}>{current().prompt.goal}</p>
                <Show when={current().prompt.requirements.length > 0}>
                  <button
                    type="button"
                    class={styles.more}
                    aria-expanded={detailsOpen()}
                    onClick={() => model.togglePromptDetails()}
                  >
                    {detailsOpen() ? "свернуть" : "подробнее"}
                  </button>
                  <Show when={detailsOpen()}>
                    <ul class={styles.requirements}>
                      <For each={current().prompt.requirements}>
                        {(requirement) => <li>{requirement}</li>}
                      </For>
                    </ul>
                  </Show>
                </Show>
              </div>
            </div>
          )}
        </Show>
      )}
    </Show>
  );
}
