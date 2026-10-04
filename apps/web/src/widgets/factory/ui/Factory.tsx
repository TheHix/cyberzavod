import { createSignal, onCleanup, onMount, Show, untrack, type JSX } from "solid-js";
import type { Recording } from "@cyberzavod/core";
import { useStoreValue } from "@/shared/lib/use-store-value.ts";
import { loadFactoryGraphics, type FactoryGraphics } from "../graphics/factory-graphics.ts";
import type { FloorSize } from "../lib/bubble-placement.ts";
import { createFactoryModel, type FactoryModel } from "../model/factory.ts";
import { startFrameClock } from "./frame-clock.ts";
import { FactoryModelProvider } from "./model-context.ts";
import { PlaybackControls } from "./PlaybackControls.tsx";
import { PromptBubble } from "./PromptBubble.tsx";
import styles from "./Factory.module.css";

interface Props {
  recording: Recording;
}

interface LaunchedFactory {
  readonly graphics: FactoryGraphics;
  readonly stop: () => void;
}

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

// Встраивает графику в холст и запускает цех: кадр рисуется по подписке на сцену модели —
// идёт она или её перематывают, — а часы двигают модель.
async function launchFactory(model: FactoryModel, host: HTMLElement): Promise<LaunchedFactory> {
  const graphics = await loadFactoryGraphics();
  try {
    await graphics.mount(host, model.script.layout);
  } catch (err) {
    // Холст и контекст видеокарты не должны остаться под надписью об ошибке.
    graphics.destroy();
    throw err;
  }
  const stopRendering = model.$scene.subscribe((scene) => graphics.render(scene));
  const stopClock = startFrameClock(model, host);
  return {
    graphics,
    stop: () => {
      stopClock();
      stopRendering();
      graphics.destroy();
    },
  };
}

/**
 * Живой цех: проигрывает запись сборки — рабочие у станков, бег с деталью, промпты над
 * рабочими. Собирает модель, графику, часы и компоненты; графика грузится только в браузере.
 * @param {Props} props Свойства компонента.
 * @param {Recording} props.recording Запись сборки, которую проигрывает цех.
 * @returns {JSX.Element} Цех с управлением проигрыванием.
 */
export function Factory(props: Props): JSX.Element {
  // Запись у островка не меняется: модель создаётся один раз.
  const model = createFactoryModel(untrack(() => props.recording));
  const status = useStoreValue(model.$status);
  const [graphics, setGraphics] = createSignal<FactoryGraphics>();
  const [floor, setFloor] = createSignal<FloorSize>({ width: 0, height: 0 });
  // Элемент холста задаётся в разметке через ref и живёт столько же, сколько компонент.
  let canvasHost!: HTMLDivElement;

  onMount(() => {
    let stop: (() => void) | undefined;
    let disposed = false;

    // Сначала графика подстраивается под размер, потом размер видят компоненты: иначе
    // пузырь промпта на паузе встал бы по старому масштабу.
    const resizeObserver = new ResizeObserver(([entry]) => {
      if (entry === undefined) return;
      const { width, height } = entry.contentRect;
      graphics()?.resize(width, height);
      graphics()?.render(model.$scene.get());
      setFloor({ width, height });
    });
    resizeObserver.observe(canvasHost);
    onCleanup(() => {
      disposed = true;
      resizeObserver.disconnect();
      stop?.();
    });

    launchFactory(model, canvasHost).then(
      (launched) => {
        if (disposed) {
          launched.stop();
          return;
        }
        stop = launched.stop;
        setGraphics(launched.graphics);
        model.start(!window.matchMedia(REDUCED_MOTION).matches);
      },
      (err: unknown) => {
        console.error("цех не запустился", err);
        model.fail();
      },
    );
  });

  return (
    <FactoryModelProvider value={model}>
      <figure class={styles.factory}>
        <div class={styles.floor}>
          {/* Картинка — только холст: пузырь промпта рядом, его читают и программы чтения. */}
          <div
            ref={(element) => (canvasHost = element)}
            class={styles.canvas}
            role="img"
            aria-label={`Цех проигрывает сборку «${props.recording.title}»`}
          />
          <Show when={status() === "loading"}>
            <p class={styles.notice}>Цех запускается…</p>
          </Show>
          <Show when={status() === "failed"}>
            <p class={styles.notice}>Цех не запустился — попробуйте обновить страницу.</p>
          </Show>
          <PromptBubble graphics={graphics()} floor={floor()} />
        </div>
        <PlaybackControls />
      </figure>
    </FactoryModelProvider>
  );
}
